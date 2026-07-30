import { defineConfig } from "vitepress";

const base = process.env.DOCS_BASE?.trim() || "/";

export default defineConfig({
  title: "Imperium",
  description: "NestJS-inspired DI container with unified HTTP + Connect RPC + WebSocket server.",
  base,
  lastUpdated: true,
  cleanUrls: true,
  themeConfig: {
    siteTitle: "Imperium",
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Reference", link: "/reference/api-surface" },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Guide",
          items: [
            { text: "Getting Started", link: "/guide/getting-started" },
            { text: "Application Bootstrap", link: "/guide/application-bootstrap" },
            { text: "Modules and DI", link: "/guide/modules-and-di" },
            { text: "HTTP", link: "/guide/http" },
            { text: "RPC", link: "/guide/rpc" },
            { text: "WebSocket", link: "/guide/websocket" },
            { text: "Cron", link: "/guide/cron" },
            { text: "Events", link: "/guide/events" },
            { text: "Logger Transports", link: "/guide/logger-transports" },
            { text: "Config and Logging", link: "/guide/config-and-logging" },
            { text: "Errors and Filters", link: "/guide/errors-and-filters" },
          ],
        },
      ],
      "/reference/": [
        {
          text: "Reference",
          items: [
            { text: "API Surface", link: "/reference/api-surface" },
            { text: "Server Options", link: "/reference/server-options" },
          ],
        },
      ],
    },
    socialLinks: [{ icon: "github", link: "https://github.com/smounters/smounters-packages" }],
    footer: {
      message: "Inspired by NestJS. Built for internal and public TypeScript backends.",
      copyright: "MIT License",
    },
  },
});
