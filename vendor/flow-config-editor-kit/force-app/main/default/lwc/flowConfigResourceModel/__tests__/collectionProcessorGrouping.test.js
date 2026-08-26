import { CATEGORY_ORDER, CATEGORY_ICONS } from "c/flowConfigResourceModel";

// FORK PATCH coverage — see VENDOR.md.
describe("collection processor categories", () => {
    it("sorts them beside record variables, not at the bottom", () => {
        // An unknown category falls to index 999 and lands below Global Variables.
        const record = CATEGORY_ORDER.indexOf("Record Variables");
        const filter = CATEGORY_ORDER.indexOf("Collection Filter");
        const simple = CATEGORY_ORDER.indexOf("Simple Variables");

        expect(filter).toBeGreaterThan(record);
        expect(filter).toBeLessThan(simple);
        expect(CATEGORY_ORDER.indexOf("Collection Sort")).toBeGreaterThan(filter);
    });

    it("uses the record icon, since the value is a record collection either way", () => {
        expect(CATEGORY_ICONS["Collection Filter"]).toBe(CATEGORY_ICONS["Record Variables"]);
        expect(CATEGORY_ICONS["Collection Sort"]).toBe(CATEGORY_ICONS["Record Variables"]);
    });
});
