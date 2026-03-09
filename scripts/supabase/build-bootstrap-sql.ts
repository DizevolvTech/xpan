import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const sections = [
  {
    title: "Initial schema",
    file: resolve(process.cwd(), "supabase/migrations/20260309130000_initial_schema.sql"),
  },
  {
    title: "Row level security",
    file: resolve(process.cwd(), "supabase/migrations/20260309170000_row_level_security.sql"),
  },
  {
    title: "Seed",
    file: resolve(process.cwd(), "supabase/seed.sql"),
  },
];

async function main() {
  const outputPath = resolve(process.cwd(), "supabase/bootstrap.sql");
  const contents = await Promise.all(
    sections.map(async (section) => {
      const fileContents = await readFile(section.file, "utf-8");
      return [
        `-- ============================================================`,
        `-- ${section.title}`,
        `-- Source: ${section.file.replace(`${process.cwd()}/`, "")}`,
        `-- ============================================================`,
        fileContents.trim(),
        "",
      ].join("\n");
    }),
  );

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${contents.join("\n")}\n`, "utf-8");
  console.log(outputPath);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
