const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// inlineRem 16 keeps rem-based utilities the same size as the browser's 16px root.
module.exports = withNativeWind(config, { input: "./src/global.css", inlineRem: 16 });
