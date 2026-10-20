import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "CashMine Task",
  slug: "cashmine-task",
  owner: "smihajlo",
  scheme: "cashminetask",
  version: "1.0.0",
  icon: "./assets/images/icon.png",
  userInterfaceStyle: "light",
  web: {
    bundler: "metro",
    // "server" so API routes (src/app/api) run on EAS Hosting. HTML is still pre-rendered at export.
    output: "server",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [["expo-router", { sitemap: false }], "expo-localization"],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    eas: {
      projectId: "db8f1f09-4e95-460a-b49f-6bb92d32b518",
    },
  },
};

export default config;
