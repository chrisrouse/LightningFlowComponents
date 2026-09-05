const { jestConfig } = require("@salesforce/sfdx-lwc-jest/config");

// Only Flow Grid and the vendored kit are under test. The UnofficialSF folders
// this fork is based on ship no tests and are not on the rewrite path.
module.exports = {
    ...jestConfig,
    testMatch: ["**/flowgrid/**/__tests__/**/*.test.js", "**/vendor/flow-config-editor-kit/**/__tests__/**/*.test.js"],
    moduleNameMapper: {
        ...jestConfig.moduleNameMapper,
        // sfdx-lwc-jest 7.9.0 stubs modalBody/modalFooter/modalHeader but not
        // `modal`, so LightningModal has no stub. See the file for details.
        "^lightning/modal$": "<rootDir>/flowgrid/test/jest-mocks/lightning/modal"
    }
};
