import rnxKit from "@rnx-kit/oxlint-config";
import { defineConfig } from "oxlint";

export default defineConfig({
  extends: [rnxKit],
  env: { builtin: true },
  rules: {
    "typescript/no-explicit-any": "error",
    "typescript/no-non-null-assertion": "error",
    "typescript/array-type": ["error", { default: "array" }],
    "react/rules-of-hooks": "error",
    "react/exhaustive-deps": "error",
    // Metro doesn't tree-shake: the barrel import bundles all ~3,800 icons (+3.5 MB).
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "lucide-react-native",
            message: 'Import icons one by one: import Plus from "lucide-react-native/icons/plus".',
            allowTypeImports: true,
          },
        ],
      },
    ],
  },
  ignorePatterns: ["dist/**", ".expo/**", "expo-env.d.ts", "ai-logs/**"],
});
