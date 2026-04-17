module.exports = {
  root: true,
  extends: ["expo", "prettier"],
  plugins: ["prettier"],
  rules: {
    "prettier/prettier": "warn",
    "react-hooks/exhaustive-deps": "error",
    "@typescript-eslint/consistent-type-imports": ["warn", { prefer: "type-imports" }],
    "no-console": ["warn", { allow: ["warn", "error"] }],
  },
  ignorePatterns: ["node_modules", ".expo", "dist", "coverage"],
};
