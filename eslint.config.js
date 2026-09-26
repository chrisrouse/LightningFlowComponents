const eslintJs = require("@eslint/js");
const salesforceLwcConfig = require("@salesforce/eslint-config-lwc/recommended");

module.exports = [
    { ignores: ["node_modules/**", "crlabs/flow-config-editor-kit/**", "**/__tests__/**/data/**"] },
    eslintJs.configs.recommended,
    ...(Array.isArray(salesforceLwcConfig) ? salesforceLwcConfig : [salesforceLwcConfig]),
    {
        files: ["flowgrid/**/lwc/**/*.js", "recordlistlwr/**/lwc/**/*.js", "flowautonavigate/**/lwc/**/*.js"],
        languageOptions: { ecmaVersion: 2023, sourceType: "module" }
    },
    {
        // Jest specs are not component code: they need timers to flush promises
        // and the jest globals, neither of which the LWC rules expect.
        files: ["**/__tests__/**/*.js"],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: "module",
            globals: {
                jest: "readonly",
                describe: "readonly",
                it: "readonly",
                test: "readonly",
                expect: "readonly",
                beforeEach: "readonly",
                afterEach: "readonly",
                beforeAll: "readonly",
                afterAll: "readonly",
                setTimeout: "readonly"
            }
        },
        rules: {
            "@lwc/lwc/no-async-operation": "off",
            // Driving a wire adapter outside @wire is exactly what a test wire
            // adapter is for -- `adapter.emit(data)` is the documented API.
            "@lwc/lwc/no-unexpected-wire-adapter-usages": "off"
        }
    }
];
