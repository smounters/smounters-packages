// Собирает офлайн-коллекцию Iconify из иконок, перечисленных в src/icons.ts, чтобы <Icon> рисовал их
// синхронно из бандла, а не тянул каждую из HTTP-API Iconify на первом рендере.
//
// Результат — .ts, а не .json: пакет собирается tsc, а он JSON в dist не переносит.
// Запуск после правки ICONS:  pnpm run gen:icons   (из packages/ui). Коммитить src/solar-icons.ts.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getIconData } from "@iconify/utils";
import solar from "@iconify-json/solar/icons.json" with { type: "json" };

const here = dirname(fileURLToPath(import.meta.url));
const iconsTs = readFileSync(join(here, "../src/icons.ts"), "utf8");
const names = [...new Set([...iconsTs.matchAll(/solar:([a-z0-9-]+)/g)].map((m) => m[1]))].sort();

const icons = {};
const missing = [];
for (const name of names) {
  const data = getIconData(solar, name);
  if (data) icons[name] = data;
  else missing.push(name);
}
if (missing.length) {
  console.error("Нет в @iconify-json/solar:", missing.join(", "));
  process.exit(1);
}

const body = JSON.stringify({ prefix: "solar", icons });
writeFileSync(
  join(here, "../src/solar-icons.ts"),
  `// СГЕНЕРИРОВАНО scripts/gen-icons.mjs — не править руками.\nexport const solarIcons = ${body} as const;\n`,
);
console.log(`Записано ${names.length} иконок → src/solar-icons.ts`);
