import { defineConfig } from "vitepress";

export default defineConfig({
  title: "skli",
  description:
    "CLI to manage AI IDE skills, rules, and agents like packages",
  base: "/skli/",
  cleanUrls: true,
  ignoreDeadLinks: true,
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Commands", link: "/commands/" },
      { text: "Reference", link: "/reference/configuration" },
      { text: "Specs", link: "/specs/" },
      {
        text: "GitHub",
        link: "https://github.com/zortracks/skli",
      },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Guide",
          items: [
            { text: "Getting started", link: "/guide/getting-started" },
            { text: "Concepts", link: "/guide/concepts" },
            { text: "Configuration", link: "/guide/configuration" },
            { text: "GitHub sources", link: "/guide/sources" },
            { text: "IDE targets", link: "/guide/ide-targets" },
          ],
        },
      ],
      "/commands/": [
        {
          text: "Commands",
          items: [
            { text: "Overview", link: "/commands/" },
            { text: "init", link: "/commands/init" },
            { text: "add", link: "/commands/add" },
            { text: "install", link: "/commands/install" },
            { text: "link", link: "/commands/link" },
            { text: "update", link: "/commands/update" },
            { text: "restore", link: "/commands/restore" },
            { text: "remove", link: "/commands/remove" },
            { text: "unlink", link: "/commands/unlink" },
          ],
        },
      ],
      "/reference/": [
        {
          text: "Reference",
          items: [
            { text: "Configuration files", link: "/reference/configuration" },
            { text: "Project schema", link: "/reference/schema" },
            { text: "Errors and exit codes", link: "/reference/errors" },
          ],
        },
      ],
      "/specs/": [
        {
          text: "Specifications",
          items: [
            { text: "Index", link: "/specs/" },
            { text: "domain-glossary", link: "/specs/features/domain-glossary" },
            { text: "cli-core", link: "/specs/features/cli-core" },
            { text: "config-manifests", link: "/specs/features/config-manifests" },
            { text: "cmd-init", link: "/specs/features/cmd-init" },
            { text: "cmd-install", link: "/specs/features/cmd-install" },
            { text: "cmd-add", link: "/specs/features/cmd-add" },
            { text: "cmd-link", link: "/specs/features/cmd-link" },
            { text: "cmd-update", link: "/specs/features/cmd-update" },
            { text: "cmd-restore", link: "/specs/features/cmd-restore" },
            { text: "cmd-remove", link: "/specs/features/cmd-remove" },
            { text: "cmd-unlink", link: "/specs/features/cmd-unlink" },
            { text: "github-source", link: "/specs/features/github-source" },
            { text: "ide-targets", link: "/specs/features/ide-targets" },
          ],
        },
      ],
    },
    socialLinks: [
      { icon: "github", link: "https://github.com/zortracks/skli" },
    ],
    search: {
      provider: "local",
    },
    editLink: {
      pattern: "https://github.com/zortracks/skli/edit/main/:path",
      text: "Edit this page on GitHub",
    },
    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © zortracks",
    },
  },
});
