import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generate } from "../commands/generate";

describe("generate output directory", () => {
	it("keeps the schema import relative to the selected output directory", async () => {
		const originalCwd = process.cwd();
		const projectDir = await fs.mkdtemp(
			path.join(os.tmpdir(), "shadcn-zod-form-output-"),
		);

		try {
			const schemaDir = path.join(projectDir, "src");
			const outputDir = path.join(schemaDir, "generated");
			await fs.mkdir(schemaDir, { recursive: true });
			await fs.writeFile(
				path.join(projectDir, "components.json"),
				JSON.stringify({
					aliases: {
						components: "@/components",
						ui: "@/components/ui",
						form: "@/components/forms",
					},
					form: "react-hook-form",
				}),
			);
			await fs.writeFile(
				path.join(projectDir, "tsconfig.json"),
				JSON.stringify({
					compilerOptions: {
						baseUrl: ".",
						paths: { "@/*": ["./src/*"] },
					},
				}),
			);
			await fs.writeFile(
				path.join(schemaDir, "schemas.ts"),
				'import { z } from "zod";\nexport const UserSchema = z.object({ name: z.string() });\n',
			);

			process.chdir(projectDir);
			await generate.parseAsync([
				"node",
				"generate",
				path.join(schemaDir, "schemas.ts"),
				"--name",
				"user-form",
				"--output",
				outputDir,
				"--package",
				"react-hook-form",
			]);

			const generated = await fs.readFile(
				path.join(outputDir, "user-form.tsx"),
				"utf8",
			);
			expect(generated).toContain('import { UserSchema } from "../schemas";');
		} finally {
			process.chdir(originalCwd);
			await fs.rm(projectDir, { recursive: true, force: true });
		}
	});
});
