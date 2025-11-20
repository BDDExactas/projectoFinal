import nextPlugin from "@next/eslint-plugin-next"
import tsParser from "@typescript-eslint/parser"

export default [
  {
    ignores: ["**/node_modules/**", ".next/**", "dist/**"]
  },
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true }
      }
    }
  },
  nextPlugin.configs["core-web-vitals"]
]
