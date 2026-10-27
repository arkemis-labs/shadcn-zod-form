import * as path from "node:path";
import * as vm from "node:vm";
import {
	type Node,
	Project,
	type SourceFile,
	SyntaxKind,
	type VariableDeclaration,
} from "ts-morph";
import { z } from "zod";
import type { Config } from "./get-config";

export type ParsedSchema = {
	schema: z.ZodObject<z.ZodRawShape>;
	import: string;
};

export function parseZodSchemasFromFile(
	config: Config,
	filePath: string,
	outputDir = config.resolvedPaths.forms,
): Record<string, ParsedSchema> {
	const project = new Project();
	const sourceFile = project.addSourceFileAtPath(filePath);
	const schemas: Record<string, ParsedSchema> = {};

	for (const declaration of sourceFile.getVariableDeclarations()) {
		const initializer = declaration.getInitializer();
		if (initializer && isZodObjectSchema(initializer)) {
			const schemaName = declaration.getName();
			const schemaCode = initializer.getText();
			schemas[schemaName] = {
				schema: evaluateZodSchema(schemaCode, filePath),
				import: buildImportString(sourceFile, declaration, filePath, outputDir),
			};
		}
	}

	return schemas;
}

function buildImportString(
	sourceFile: SourceFile,
	declaration: VariableDeclaration,
	filePath: string,
	outputDir: string,
) {
	const isDefaultExport = sourceFile
		.getExportedDeclarations()
		.get("default")
		?.some((d) => d === declaration);

	let importPath = path.relative(outputDir, filePath);
	importPath = importPath.replace(/\.(ts|tsx|js|jsx)$/, "");
	importPath = importPath.replace(/\\/g, "/");

	const importName = declaration.getName();

	if (isDefaultExport) {
		return `import ${importName} from "${importPath}";`;
	}

	return `import { ${importName} } from "${importPath}";`;
}

function isZodObjectSchema(node: Node) {
	return (
		node.getKind() === SyntaxKind.CallExpression &&
		node.getFirstChild()?.getText().startsWith("z.object")
	);
}

function evaluateZodSchema(
	schemaCode: string,
	filePath: string,
): z.ZodObject<z.ZodRawShape> {
	const context = {
		z,
		require: (id: string) => {
			if (id === "zod") return z;
			return require(path.resolve(path.dirname(filePath), id));
		},
		console,
	};

	const script = `const schema = ${schemaCode}; schema;`;
	return vm.runInNewContext(script, context) as z.ZodObject<z.ZodRawShape>;
}
