// Реестр иконок (Iconify «solar», linear). В разметке — только ICONS.*, не строковые литералы.
//
// Набор бандлится ОФЛАЙН: solar-icons.ts содержит ровно перечисленные ниже иконки (генерит
// `pnpm run gen:icons`). Без этого @iconify/react ходит за каждой иконкой в HTTP-API и они появляются
// с задержкой. После правки ICONS — перегенерировать и закоммитить.
import { addCollection } from "@iconify/react";
import { solarIcons } from "./solar-icons";

addCollection(solarIcons);

export { Icon } from "@iconify/react";

export const ICONS = {
  // Разделы
  dashboard: "solar:graph-new-linear",
  builder: "solar:widget-2-linear",
  backtest: "solar:chart-square-linear",
  trades: "solar:clipboard-list-linear",
  settings: "solar:tuning-2-linear",
  users: "solar:user-id-linear",
  bot: "solar:cpu-bolt-linear",

  // Каркас
  menu: "solar:hamburger-menu-linear",
  chevronDown: "solar:alt-arrow-down-linear",
  chevronRight: "solar:alt-arrow-right-linear",
  chevronLeft: "solar:alt-arrow-left-linear",

  // Тема
  sun: "solar:sun-2-linear",
  moon: "solar:moon-linear",
  system: "solar:monitor-linear",

  // Аккаунт и действия
  logout: "solar:logout-2-linear",
  user: "solar:user-circle-linear",
  globe: "solar:global-linear",
  eye: "solar:eye-linear",
  play: "solar:play-linear",
  stop: "solar:stop-linear",
  add: "solar:add-circle-linear",
  copy: "solar:copy-linear",
  delete: "solar:trash-bin-minimalistic-linear",
} as const;

export type IconName = keyof typeof ICONS;
