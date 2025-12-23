import tseslint from "typescript-eslint";
import tsparser from "@typescript-eslint/parser";
import obsidianmd from "eslint-plugin-obsidianmd";
import sdl from "@microsoft/eslint-plugin-sdl";
import importPlugin from "eslint-plugin-import";
import globals from "globals";

export default [
  // 忽略不需要检查的文件
  {
    ignores: [
      "node_modules/**",
      "main.js",
      "*.backup",
      "backup/**",
      ".obsidian/**",
      "src/emojiTest.ts"  // 排除测试文件（包含 innerHTML 用于测试）
    ]
  },

  // TypeScript 文件配置
  {
    files: ["src/**/*.ts"],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "@microsoft/sdl": sdl,
      "import": importPlugin,
      obsidianmd: obsidianmd
    },
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: "./tsconfig.json",
        ecmaVersion: 2020,
        sourceType: "module"
      },
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      // TypeScript 规则
      "@typescript-eslint/no-unused-vars": ["error", { "args": "none" }],
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-explicit-any": ["error", { "fixToUnknown": true }],
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/no-deprecated": "error",
      "@typescript-eslint/require-await": "off",

      // JavaScript 基础规则
      "no-unused-vars": "off",
      "no-prototype-builtins": "off",
      "no-console": ["error", { "allow": ["warn", "error", "debug"] }],
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-alert": "error",
      "no-self-compare": "warn",
      "no-implicit-globals": "error",
      "no-undef": "error",

      // 禁止使用全局对象
      "no-restricted-globals": [
        "error",
        {
          "name": "app",
          "message": "Avoid using the global app object. Instead use the reference provided by your plugin instance."
        },
        {
          "name": "fetch",
          "message": "Use the built-in `requestUrl` function instead of `fetch` for network requests in Obsidian."
        },
        {
          "name": "localStorage",
          "message": "Prefer `App#saveLocalStorage` / `App#loadLocalStorage` functions to write / read localStorage data that's unique to a vault."
        }
      ],

      // 禁止导入特定库
      "no-restricted-imports": [
        "error",
        {
          "name": "axios",
          "message": "Use the built-in `requestUrl` function instead of `axios`."
        },
        {
          "name": "superagent",
          "message": "Use the built-in `requestUrl` function instead of `superagent`."
        },
        {
          "name": "got",
          "message": "Use the built-in `requestUrl` function instead of `got`."
        },
        {
          "name": "ofetch",
          "message": "Use the built-in `requestUrl` function instead of `ofetch`."
        },
        {
          "name": "ky",
          "message": "Use the built-in `requestUrl` function instead of `ky`."
        },
        {
          "name": "node-fetch",
          "message": "Use the built-in `requestUrl` function instead of `node-fetch`."
        },
        {
          "name": "moment",
          "message": "The 'moment' package is bundled with Obsidian. Please import it from 'obsidian' instead."
        }
      ],

      // Microsoft SDL 安全规则
      "@microsoft/sdl/no-document-write": "error",
      "@microsoft/sdl/no-inner-html": "error",

      // Import 插件规则
      "import/no-extraneous-dependencies": "error",

      // Obsidian 插件专用规则（完整的 23 个推荐规则）
      "obsidianmd/commands/no-command-in-command-id": "error",
      "obsidianmd/commands/no-command-in-command-name": "error",
      "obsidianmd/commands/no-default-hotkeys": "error",
      "obsidianmd/commands/no-plugin-id-in-command-id": "error",
      "obsidianmd/commands/no-plugin-name-in-command-name": "error",
      "obsidianmd/settings-tab/no-manual-html-headings": "error",
      "obsidianmd/settings-tab/no-problematic-settings-headings": "error",
      "obsidianmd/vault/iterate": "error",
      "obsidianmd/detach-leaves": "error",
      "obsidianmd/hardcoded-config-path": "error",
      "obsidianmd/no-forbidden-elements": "error",
      "obsidianmd/no-plugin-as-component": "error",
      "obsidianmd/no-sample-code": "error",
      "obsidianmd/no-tfile-tfolder-cast": "error",
      "obsidianmd/no-view-references-in-plugin": "error",
      "obsidianmd/no-static-styles-assignment": "error",
      "obsidianmd/object-assign": "error",
      "obsidianmd/platform": "error",
      "obsidianmd/prefer-file-manager-trash-file": "warn",
      "obsidianmd/prefer-abstract-input-suggest": "error",
      "obsidianmd/regex-lookbehind": "error",
      "obsidianmd/sample-names": "error",
      "obsidianmd/validate-manifest": "error",
      "obsidianmd/validate-license": "error",
      "obsidianmd/ui/sentence-case": ["error", { "enforceCamelCaseLower": true }]
    }
  }
];
