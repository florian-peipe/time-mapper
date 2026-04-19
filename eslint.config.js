const expoConfig = require("eslint-config-expo/flat");
const prettierConfig = require("eslint-config-prettier");
const prettierPlugin = require("eslint-plugin-prettier");

module.exports = [
  ...expoConfig,
  prettierConfig,
  {
    plugins: { prettier: prettierPlugin },
    rules: {
      "prettier/prettier": "warn",
      "react-hooks/exhaustive-deps": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/consistent-type-imports": ["warn", { prefer: "type-imports" }],
    },
  },
  {
    // One-time Node scripts live under scripts/*.js. Tell eslint they
    // run in Node (so `__dirname`, `require`, `module`, `process` are
    // ambient) and suppress the browser-centric no-console rule we keep
    // on the rest of the source tree.
    files: ["scripts/**/*.js"],
    languageOptions: {
      globals: {
        __dirname: "readonly",
        __filename: "readonly",
        require: "readonly",
        module: "readonly",
        process: "readonly",
        console: "readonly",
      },
    },
    rules: {
      "no-console": "off",
      "no-undef": "off",
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".expo/**",
      "dist/**",
      "coverage/**",
      "android/**",
      "ios/**",
      "docs/**",
      "src/db/migrations/**",
    ],
  },
];
