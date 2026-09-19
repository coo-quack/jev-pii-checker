import { defineConfig } from "vitepress";

export default defineConfig({
  title: "jev-pii-checker",
  description: "Find PII in text with TypeSafe's Jev model",
  base: "/jev-pii-checker/",

  themeConfig: {
    logo: "/logo.svg",

    nav: [
      { text: "Home", link: "/" },
      { text: "Getting Started", link: "/getting-started" },
      { text: "Install", link: "/install" },
      { text: "CLI Reference", link: "/cli" },
      { text: "How It Works", link: "/how-it-works" },
      { text: "Categories & Sensitivity", link: "/categories" },
      { text: "Limitations", link: "/limitations" },
      { text: "Changelog", link: "/changelog" },
    ],

    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting Started", link: "/getting-started" },
          { text: "Installation", link: "/install" },
          { text: "How It Works", link: "/how-it-works" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "CLI Reference", link: "/cli" },
          { text: "Categories & Sensitivity", link: "/categories" },
          { text: "Limitations", link: "/limitations" },
        ],
      },
      {
        text: "Support",
        items: [{ text: "Changelog", link: "/changelog" }],
      },
    ],

    socialLinks: [
      { icon: "github", link: "https://github.com/coo-quack/jev-pii-checker" },
      {
        icon: "npm",
        link: "https://www.npmjs.com/package/@coo-quack/jev-pii-checker",
      },
    ],

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2026 coo-quack",
    },

    search: {
      provider: "local",
    },
  },

  head: [["link", { rel: "icon", type: "image/svg+xml", href: "/jev-pii-checker/logo.svg" }]],
});
