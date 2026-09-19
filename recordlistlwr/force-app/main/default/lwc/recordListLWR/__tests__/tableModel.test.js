import { buildTableModel, findReferencePaths, linkNameColumn } from "../tableModel";

const objectInfo = {
    fields: {
        Name: { dataType: "String" },
        AnnualRevenue: { dataType: "Currency" },
        Founded__c: { dataType: "Date" },
        LastActivity__c: { dataType: "DateTime" },
        Margin__c: { dataType: "Percent" },
        IsActive__c: { dataType: "Boolean" },
        Status__c: { dataType: "Picklist" },
        OwnerId: { dataType: "Reference" }
    }
};

function listInfo(columns) {
    return { displayColumns: columns };
}

function column(fieldApiName, overrides = {}) {
    return { fieldApiName, label: fieldApiName, sortable: true, ...overrides };
}

describe("column types", () => {
    it("maps Salesforce data types onto datatable types", () => {
        const { columns } = buildTableModel(
            listInfo([column("Name"), column("AnnualRevenue"), column("LastActivity__c"), column("IsActive__c")]),
            objectInfo,
            []
        );

        expect(columns.map((c) => c.type)).toEqual(["text", "currency", "date", "boolean"]);
    });

    it("maps a Date field to date-local so it cannot shift a day across timezones", () => {
        const { columns } = buildTableModel(listInfo([column("Founded__c")]), objectInfo, []);

        expect(columns[0].type).toBe("date-local");
    });

    it("maps Percent to number, because datatable's percent type would render 50 as 5,000%", () => {
        const { columns } = buildTableModel(listInfo([column("Margin__c")]), objectInfo, []);

        expect(columns[0].type).toBe("number");
    });

    it("falls back to text for a field absent from the object info", () => {
        const { columns } = buildTableModel(listInfo([column("Mystery__c")]), objectInfo, []);

        expect(columns[0].type).toBe("text");
    });

    it("carries the list view's sortable flag through, defaulting to false", () => {
        const { columns } = buildTableModel(
            listInfo([column("Name", { sortable: false }), column("Status__c", { sortable: undefined })]),
            objectInfo,
            []
        );

        expect(columns.map((c) => c.sortable)).toEqual([false, false]);
    });

    it("tolerates a list info with no display columns", () => {
        expect(buildTableModel(undefined, objectInfo, undefined)).toEqual({ columns: [], rows: [] });
    });
});

describe("rows", () => {
    const records = [
        {
            id: "001000000000001",
            fields: {
                Name: { value: "Acme", displayValue: null },
                AnnualRevenue: { value: 1000, displayValue: "$1,000.00" },
                Status__c: { value: "PROSPECT", displayValue: "Prospect" },
                OwnerId: { value: "005000000000001", displayValue: "Ada Lovelace" }
            }
        }
    ];

    it("keys each row by the record id", () => {
        const { rows } = buildTableModel(listInfo([column("Name")]), objectInfo, records);

        expect(rows[0].id).toBe("001000000000001");
    });

    it("uses the raw value for typed fields so datatable can format them", () => {
        const { rows } = buildTableModel(listInfo([column("AnnualRevenue")]), objectInfo, records);

        expect(rows[0].AnnualRevenue).toBe(1000);
    });

    it("uses displayValue for a picklist, which stores a code", () => {
        const { rows } = buildTableModel(listInfo([column("Status__c")]), objectInfo, records);

        expect(rows[0].Status__c).toBe("Prospect");
    });

    it("uses displayValue for a reference, so a row shows a name rather than an id", () => {
        const { rows } = buildTableModel(listInfo([column("OwnerId")]), objectInfo, records);

        expect(rows[0].OwnerId).toBe("Ada Lovelace");
    });

    it("omits a field the record does not carry rather than writing undefined", () => {
        const { rows } = buildTableModel(listInfo([column("Missing__c")]), objectInfo, records);

        expect("Missing__c" in rows[0]).toBe(false);
    });
});

describe("relationship paths", () => {
    // A display column such as Case__r.CaseNumber nests its value two levels down,
    // and datatable cannot index a row by a dotted key.
    const records = [
        {
            id: "a01000000000001",
            fields: {
                Case__r: {
                    value: {
                        fields: {
                            CaseNumber: { value: "03043674", displayValue: null }
                        }
                    }
                }
            }
        }
    ];

    it("flattens a dotted path to a dot-free row key", () => {
        const { columns, rows } = buildTableModel(listInfo([column("Case__r.CaseNumber")]), objectInfo, records);

        expect(columns[0].fieldName).toBe("Case__r_CaseNumber");
        expect(rows[0].Case__r_CaseNumber).toBe("03043674");
    });

    it("keeps the original path, because sortBy needs the field api name", () => {
        const { columns } = buildTableModel(listInfo([column("Case__r.CaseNumber")]), objectInfo, records);

        expect(columns[0].fieldApiName).toBe("Case__r.CaseNumber");
    });

    it("does not blow up when a parent relationship is null", () => {
        const withNullParent = [{ id: "a01000000000002", fields: { Case__r: { value: null } } }];

        const { rows } = buildTableModel(listInfo([column("Case__r.CaseNumber")]), objectInfo, withNullParent);

        expect(rows[0]).toEqual({ id: "a01000000000002" });
    });
});

describe("linking the name column", () => {
    const records = [
        { id: "001000000000001", fields: { Name: { value: "Acme", displayValue: null } } },
        { id: "001000000000002", fields: { Name: { value: "Globex", displayValue: null } } }
    ];
    const urls = {
        "001000000000001": "/account/001000000000001",
        "001000000000002": "/account/001000000000002"
    };

    function linked() {
        const model = buildTableModel(listInfo([column("Name"), column("Status__c")]), objectInfo, records);
        return linkNameColumn(model, "Name", urls);
    }

    it("makes the name column a url column pointing at a generated href", () => {
        const nameColumn = linked().columns[0];

        expect(nameColumn.type).toBe("url");
        expect(nameColumn.fieldName).toBe("Name__url");
    });

    it("keeps the name as the link text", () => {
        expect(linked().columns[0].typeAttributes).toEqual({
            label: { fieldName: "Name" },
            target: "_self"
        });
    });

    it("keeps fieldApiName intact, because sorting still sorts by the real field", () => {
        expect(linked().columns[0].fieldApiName).toBe("Name");
    });

    it("puts each record's url on its own row, alongside the name", () => {
        const [first] = linked().rows;

        expect(first.Name__url).toBe("/account/001000000000001");
        expect(first.Name).toBe("Acme");
    });

    it("leaves other columns untouched", () => {
        expect(linked().columns[1].type).toBe("text");
    });

    it.each([
        ["no urls have been generated yet", "Name", undefined],
        ["the name field is unknown", undefined, { "001000000000001": "/x" }],
        ["the name field is not a display column", "Mystery__c", { "001000000000001": "/x" }]
    ])("returns the model unchanged when %s", (label, nameField, urlMap) => {
        const model = buildTableModel(listInfo([column("Name")]), objectInfo, records);

        expect(linkNameColumn(model, nameField, urlMap)).toBe(model);
    });
});

describe("finding reference paths", () => {
    const accountInfo = {
        fields: {
            Name: { dataType: "String" },
            OwnerId: { dataType: "Reference", relationshipName: "Owner", referenceToInfos: [{ apiName: "User" }] },
            ParentId: { dataType: "Reference", relationshipName: "Parent", referenceToInfos: [{ apiName: "Account" }] }
        }
    };

    it("ignores plain columns", () => {
        expect(findReferencePaths(listInfo([column("Name")]), accountInfo)).toEqual([]);
    });

    it("works out the parent id path and the target object", () => {
        expect(findReferencePaths(listInfo([column("Owner.Alias")]), accountInfo)).toEqual([
            { fieldApiName: "Owner.Alias", idPath: "Owner.Id", targetObject: "User" }
        ]);
    });

    it("resolves a self-reference", () => {
        expect(findReferencePaths(listInfo([column("Parent.Name")]), accountInfo)[0].targetObject).toBe("Account");
    });

    it("reports an unknown target rather than guessing one", () => {
        expect(findReferencePaths(listInfo([column("Mystery__r.Name")]), accountInfo)[0]).toEqual({
            fieldApiName: "Mystery__r.Name",
            idPath: "Mystery__r.Id",
            targetObject: null
        });
    });

    it("only resolves the first hop, so a two-hop path names the wrong object", () => {
        // Documented limitation, asserted so it is a decision rather than a surprise:
        // the target here is Parent's type, not Owner's.
        const [reference] = findReferencePaths(listInfo([column("Parent.Owner.Alias")]), accountInfo);

        expect(reference.idPath).toBe("Parent.Owner.Id");
        expect(reference.targetObject).toBe("Account");
    });

    it("survives missing object info", () => {
        expect(findReferencePaths(listInfo([column("Owner.Alias")]), undefined)[0].targetObject).toBeNull();
    });
});
