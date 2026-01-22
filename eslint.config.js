const js = require("@eslint/js");

module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
    },
    rules: {
      // 這裡可以加自訂規則
    },
  },
];
