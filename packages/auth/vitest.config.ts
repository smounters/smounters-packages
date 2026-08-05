import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // SWC вместо esbuild: тесты используют конструкторный DI (tsyringe), которому нужен
  // design:paramtypes из emitDecoratorMetadata. esbuild его не эмитит — контейнер падает
  // с «TypeInfo not known for X». Сборку пакета (tsc) это не затрагивает.
  plugins: [swc.vite({ module: { type: "es6" } })],
  test: {
    include: ["tests/**/*.test.ts"],
    globals: false,
    testTimeout: 10_000,
  },
});
