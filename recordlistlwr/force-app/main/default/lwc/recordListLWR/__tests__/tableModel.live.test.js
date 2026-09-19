/**
 * The same model, driven by payloads captured verbatim from the org's UI API for
 * Account / AllAccounts (Preview Org, 2026-09-16) rather than by hand-written
 * fixtures. Hand-written fixtures encode what I believe the API returns; these
 * encode what it actually returns.
 *
 * Refresh with:
 *   sf api request rest "/services/data/v62.0/ui-api/list-info/Account/AllAccounts"
 *   sf api request rest "/services/data/v62.0/ui-api/list-records/Account/AllAccounts?pageSize=2"
 *   sf api request rest "/services/data/v62.0/ui-api/object-info/Account"
 */
import { buildTableModel } from "../tableModel";
import listInfo from "./data/accountListInfo.json";
import listRecords from "./data/accountListRecords.json";
import objectInfo from "./data/accountObjectInfo.json";

describe("against real Account/AllAccounts payloads", () => {
    const { columns, rows } = buildTableModel(listInfo, objectInfo, listRecords.records);

    it("builds a column per display column, in order", () => {
        expect(columns.map((c) => c.label)).toEqual([
            "Account Name",
            "Account Site",
            "Billing State/Province",
            "Phone",
            "Type",
            "Account Owner Alias"
        ]);
    });

    it("types the columns from the object info", () => {
        const byField = Object.fromEntries(columns.map((c) => [c.fieldApiName, c.type]));
        expect(byField.Name).toBe("text");
        expect(byField.Phone).toBe("phone");
        expect(byField.Type).toBe("text");
    });

    it("populates a row per record, keyed by id", () => {
        expect(rows).toHaveLength(listRecords.records.length);
        rows.forEach((row) => expect(row.id).toMatch(/^001/));
    });

    it("carries the actual field values through to the rows", () => {
        const first = rows[0];
        const expected = listRecords.records[0].fields;

        expect(first.Name).toBe(expected.Name.value);
        expect(first.BillingState).toBe(expected.BillingState.value);
    });

    it("resolves the Owner.Alias relationship path", () => {
        const alias = listRecords.records[0].fields.Owner?.value?.fields?.Alias;

        // Guard rather than assume: if the capture lacks the nested parent, the
        // assertion below would pass vacuously.
        expect(alias).toBeDefined();
        expect(rows[0].Owner_Alias).toBe(alias.displayValue ?? alias.value);
    });

    it("leaves no column with an all-undefined row value", () => {
        const dead = columns
            .filter((c) => rows.every((row) => row[c.fieldName] === undefined))
            .map((c) => c.fieldApiName);

        // Columns can legitimately be empty in the data (Site, Type are often null),
        // so this checks for a KEY that never got written, not for a null value.
        const missingKeys = columns
            .filter((c) => rows.every((row) => !(c.fieldName in row)))
            .map((c) => c.fieldApiName);

        expect({ dead, missingKeys }).toEqual({ dead: dead, missingKeys: [] });
    });
});
