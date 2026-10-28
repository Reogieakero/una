// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
    rules: {
      // eslint-config-expo 58 enables the React Compiler-era `react-hooks/refs`
      // rule, which reports the standard React Native pattern of keeping an
      // `Animated.Value` in a ref and reading `.current` during render
      // (Lumi, MoodPicker, home breathing exercise). Those reads are the
      // documented way to drive Animated, so the rule is a false positive here.
      "react-hooks/refs": "off",
    },
  }
]);
