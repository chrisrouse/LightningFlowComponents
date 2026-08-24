const eslintJs = require("@eslint/js");
const salesforceLwcConfig = require("@salesforce/eslint-config-lwc/recommended");

module.exports = [
    { ignores: ["node_modules/**", "vendor/**", "**/__tests__/**/data/**"] },
    eslintJs.configs.recommended,
    ...(Array.isArray(salesforceLwcConfig) ? salesforceLwcConfig : [salesforceLwcConfig]),
    {
        files: ["flowgrid/**/lwc/**/*.js"],
        languageOptions: { ecmaVersion: 2023, sourceType: "module" }
    }
];
