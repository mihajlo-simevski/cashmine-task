// jest-expo's default list, plus UI packages that ship untranspiled code.
const TRANSFORMED_PACKAGES = [
  ".pnpm",
  "react-native",
  "@react-native",
  "@react-native-community",
  "expo",
  "@expo",
  "@expo-google-fonts",
  "react-navigation",
  "@react-navigation",
  "native-base",
  "standard-navigation",
  "@rn-primitives",
  "nativewind",
  "react-native-css-interop",
];

module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  transformIgnorePatterns: [
    `/node_modules/(?!(${TRANSFORMED_PACKAGES.join("|")}))`,
    "/node_modules/react-native-reanimated/plugin/",
    "/node_modules/@react-native/babel-preset/",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    // Jest picks lucide's ESM build (.mjs, which isn't transformed). The prebuilt
    // CommonJS build loads without any transform.
    "^lucide-react-native$":
      "<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js",
    "^lucide-react-native/icons/(.*)$":
      "<rootDir>/node_modules/lucide-react-native/dist/cjs/icons/$1.js",
  },
};
