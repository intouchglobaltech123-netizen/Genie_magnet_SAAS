import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// The type standard: one font (Inter), three sizes (text-heading 24px, text-subheading 16px, text-body 14px), and
// semibold as the heaviest weight. Any other size, family or weight in a class name fails the lint. Printed A4
// documents (invoice, payslip, monthly report) and the public website's headline are the only, marked, exceptions.
const OFF_STANDARD = String.raw`(^|[\s:"'])(text-(xs|sm|base|lg|[2-9]?xl)|text-\[\d[^\]]*(px|rem|em)\]|font-(mono|serif|bold|extrabold|black|light|thin|extralight|\[[^\]]*\])|italic)(?=$|[\s"'])`;
const typeMessage = "Use only text-heading, text-subheading or text-body, the one font, and at most font-semibold (see eslint.config.mjs).";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: `Literal[value=/${OFF_STANDARD}/]`, message: typeMessage },
        { selector: `TemplateElement[value.raw=/${OFF_STANDARD}/]`, message: typeMessage },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
