import { CATEGORY_ORDER, CATEGORY_ICONS } from "c/flowConfigResourceModel";

// FORK PATCH coverage — see VENDOR.md.
describe("collection processor categories", () => {
    it("orders them ahead of record variables, matching the native picker", () => {
        // Native lists Screen, then Collection Filter, then Get Records — and the
        // kit keeps Get Records outputs under Record Variables.
        const screen = CATEGORY_ORDER.indexOf("Screen");
        const filter = CATEGORY_ORDER.indexOf("Collection Filter");
        const sort = CATEGORY_ORDER.indexOf("Collection Sort");
        const record = CATEGORY_ORDER.indexOf("Record Variables");

        expect(screen).toBeLessThan(filter);
        expect(filter).toBeLessThan(sort);
        expect(sort).toBeLessThan(record);
    });

    it("keeps them out of the unknown-category bucket", () => {
        // An unrecognised category falls to index 999 and lands below Global
        // Variables, which is where these started.
        expect(CATEGORY_ORDER).toContain("Collection Filter");
        expect(CATEGORY_ORDER).toContain("Collection Sort");
    });

    it("uses the record icon, since the value is a record collection either way", () => {
        expect(CATEGORY_ICONS["Collection Filter"]).toBe(CATEGORY_ICONS["Record Variables"]);
        expect(CATEGORY_ICONS["Collection Sort"]).toBe(CATEGORY_ICONS["Record Variables"]);
    });
});
