import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // SWC вместо esbuild: тестам нужен design:paramtypes из emitDecoratorMetadata для
  // конструкторного DI (tsyringe). esbuild его не эмитит — контейнер падает с
  // «TypeInfo not known for X». Сборку пакета (tsc) это не затрагивает.
  plugins: [swc.vite({ module: { type: "es6" } })],
  resolve: {
    extensions: [".ts", ".js", ".mjs"],
  },
  test: {
    include: ["tests/**/*.test.ts"],
    globals: false,
    testTimeout: 10_000,
  },
});
