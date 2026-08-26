import { collectFlowResources } from "c/flowConfigEditorUtils";

// FORK PATCH coverage — see VENDOR.md. The kit did not enumerate Collection Filter
// or Collection Sort outputs, so a filtered collection was unreachable from every
// kit picker even though the native Flow picker offers it.
describe("collectFlowResources with collection processors", () => {
    const GET_RECORDS = { name: "Get_Accounts", object: "Account", getFirstRecordOnly: false };

    it("offers a Collection Filter output as a record collection", () => {
        const resources = collectFlowResources({
            recordLookups: [GET_RECORDS],
            collectionProcessors: [
                {
                    name: "Accounts_from_energy",
                    label: "Accounts from energy",
                    elementSubtype: "FilterCollectionProcessor",
                    collectionReference: "{!Get_Accounts}",
                    outputSObjectType: "Account"
                }
            ]
        });

        const filtered = resources.find((r) => r.name === "Accounts_from_energy");
        expect(filtered).toBeDefined();
        expect(filtered.dataType).toBe("SObject");
        expect(filtered.objectType).toBe("Account");
        expect(filtered.isCollection).toBe(true);
    });

    it("inherits the object from its input when the element does not name one", () => {
        const resources = collectFlowResources({
            recordLookups: [GET_RECORDS],
            collectionProcessors: [
                {
                    name: "Filtered",
                    elementSubtype: "FilterCollectionProcessor",
                    collectionReference: "{!Get_Accounts}"
                }
            ]
        });

        expect(resources.find((r) => r.name === "Filtered").objectType).toBe("Account");
    });

    it("distinguishes a sort from a filter", () => {
        const resources = collectFlowResources({
            collectionProcessors: [
                { name: "Sorted", elementSubtype: "SortCollectionProcessor", outputSObjectType: "Contact" },
                { name: "Filtered", elementSubtype: "FilterCollectionProcessor", outputSObjectType: "Contact" }
            ]
        });

        expect(resources.find((r) => r.name === "Sorted").source).toBe("Collection Sort");
        expect(resources.find((r) => r.name === "Filtered").source).toBe("Collection Filter");
    });

    it("skips a processor with no name rather than throwing", () => {
        expect(() => collectFlowResources({ collectionProcessors: [{ elementSubtype: "FilterCollectionProcessor" }] })).not.toThrow();
    });

    it("leaves a context without processors untouched", () => {
        const resources = collectFlowResources({ recordLookups: [GET_RECORDS] });
        expect(resources.some((r) => r.name === "Get_Accounts")).toBe(true);
    });
});
