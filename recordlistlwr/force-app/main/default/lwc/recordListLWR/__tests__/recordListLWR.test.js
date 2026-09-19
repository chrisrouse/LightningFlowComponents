import { createElement } from "lwc";
import RecordListLWR from "c/recordListLWR";
import { getListInfoByName, getListInfosByObjectName, getListRecordsByName } from "lightning/uiListsApi";
import { getObjectInfo } from "lightning/uiObjectInfoApi";

const LIST_INFO = {
    label: "All Internal Asset Requests",
    displayColumns: [
        { fieldApiName: "Name", label: "Internal Asset Request Name", sortable: true },
        { fieldApiName: "Status__c", label: "Status", sortable: true }
    ],
    orderedByInfo: [{ fieldApiName: "Name", isAscending: true }]
};

const OBJECT_INFO = {
    themeInfo: { iconUrl: "https://example.com/icon.svg", color: "5DBA4A" },
    nameFields: ["Name"],
    fields: { Name: { dataType: "String" }, Status__c: { dataType: "Picklist" } }
};

function records(count, { nextPageToken = null, previousPageToken = null } = {}) {
    return {
        count,
        nextPageToken,
        previousPageToken,
        records: Array.from({ length: count }, (unused, i) => ({
            id: `a0100000000000${i}`,
            fields: {
                Name: { value: `IAR ${i}`, displayValue: null },
                Status__c: { value: "NEW", displayValue: "New" }
            }
        }))
    };
}

/**
 * Object and list view now arrive as one `listSource` value, so the helper accepts
 * the old flat props and folds them in — keeping each test's intent readable rather
 * than restating the bundle shape in every case.
 */
function build(props = {}) {
    const element = createElement("c-record-list-l-w-r", { is: RecordListLWR });

    // `in` rather than a truthiness check, so a test can pass
    // `{ objectApiName: undefined }` to mean "deliberately unset" and still get the
    // default when it says nothing at all.
    Object.assign(element, {
        objectApiName: "objectApiName" in props ? props.objectApiName : "Internal_Asset_Request__c",
        listView: "listView" in props ? props.listView : "AllInternalAssetRequests",
        ...props
    });
    document.body.appendChild(element);
    return element;
}

function emitAll(overrides = {}) {
    getObjectInfo.emit(overrides.objectInfo ?? OBJECT_INFO);
    getListInfoByName.emit(overrides.listInfo ?? LIST_INFO);
    getListInfosByObjectName.emit(overrides.lists ?? { lists: [] });
    getListRecordsByName.emit(overrides.records ?? records(2));
}

/** Record URLs resolve over two awaits: the batch, then the re-render. */
function flushPromises() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Sorts by the column with the given LABEL, dispatching whatever fieldName that
 * column currently carries.
 *
 * Deliberately not hardcoding the fieldName: linking the name column renames its
 * fieldName to `<name>__url`, and datatable emits the column's current fieldName.
 * A test that hardcodes `Name` passes before links are applied and fails after,
 * which says nothing about whether sorting works.
 */
async function sortByColumnLabel(element, label, sortDirection) {
    const table = element.shadowRoot.querySelector("lightning-datatable");
    const { fieldName } = table.columns.find((column) => column.label === label);
    table.dispatchEvent(new CustomEvent("sort", { detail: { fieldName, sortDirection } }));
    await flushPromises();
    return table;
}

afterEach(() => {
    while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
    }
    jest.clearAllMocks();
});

describe("requesting fields", () => {
    // Through the LDS wire a record carries ONLY the fields asked for. Omit these
    // and the list returns records holding nothing but `id` — ten blank rows, no
    // error. The REST resource returns display columns automatically, so this is
    // not reproducible outside a wire.
    it("asks for every display column, object-qualified", async () => {
        build();
        emitAll();
        await Promise.resolve();

        expect(getListRecordsByName.getLastConfig().optionalFields).toEqual([
            "Internal_Asset_Request__c.Name",
            "Internal_Asset_Request__c.Status__c"
        ]);
    });

    it("qualifies a relationship path without mangling it", async () => {
        build({ objectApiName: "Account" });
        emitAll({
            listInfo: {
                ...LIST_INFO,
                displayColumns: [{ fieldApiName: "Owner.Alias", label: "Owner", sortable: false }]
            }
        });
        await Promise.resolve();

        // The parent Id rides along: Owner.Alias says what to show, Owner.Id says
        // what it could link to, and the wire returns nothing it was not asked for.
        expect(getListRecordsByName.getLastConfig().optionalFields).toEqual([
            "Account.Owner.Alias",
            "Account.Owner.Id"
        ]);
    });

    it("holds the records wire until the list metadata says which fields to ask for", async () => {
        build();
        await Promise.resolve();

        // No list info yet, so there is nothing to request and the config stays
        // incomplete on purpose.
        expect(getListRecordsByName.getLastConfig().optionalFields).toBeUndefined();
    });
});

describe("unconfigured", () => {
    // Without this, no wire config is complete, nothing provisions, and the
    // component spins forever — which is what an admin sees on the canvas.
    it.each([
        ["no object", { objectApiName: undefined }],
        ["no list view", { listView: undefined }],
        ["neither", { objectApiName: undefined, listView: undefined }]
    ])("prompts for settings and never spins when there is %s", async (label, props) => {
        const element = build(props);
        await Promise.resolve();

        expect(element.shadowRoot.textContent).toContain("Select an object and a list view");
        expect(element.shadowRoot.querySelector("lightning-spinner")).toBeNull();
        expect(element.shadowRoot.querySelector("lightning-datatable")).toBeNull();
    });

    it("hides the header and pagination too, so it does not look half broken", async () => {
        const element = build({
            objectApiName: undefined,
            showHeader: true,
            showSearch: true,
            showPagination: true
        });
        await Promise.resolve();

        expect(element.shadowRoot.querySelector("lightning-input")).toBeNull();
        expect(element.shadowRoot.querySelector("lightning-button")).toBeNull();
    });
});

describe("loading and empty states", () => {
    it("shows a spinner until both metadata and records arrive", async () => {
        const element = build();
        await Promise.resolve();

        expect(element.shadowRoot.querySelector("lightning-spinner")).not.toBeNull();
        expect(element.shadowRoot.querySelector("lightning-datatable")).toBeNull();
    });

    it("renders the table once data arrives", async () => {
        const element = build();
        emitAll();
        await Promise.resolve();

        const table = element.shadowRoot.querySelector("lightning-datatable");
        expect(table).not.toBeNull();
        expect(table.data).toHaveLength(2);
        expect(element.shadowRoot.querySelector("lightning-spinner")).toBeNull();
    });

    it("says so when the list view returns no records", async () => {
        const element = build();
        emitAll({ records: records(0) });
        await Promise.resolve();

        expect(element.shadowRoot.textContent).toContain("No items to display.");
        expect(element.shadowRoot.querySelector("lightning-datatable")).toBeNull();
    });

    it("shows the platform's message when a wire errors", async () => {
        const element = build();
        getListRecordsByName.emitError({ body: { message: "Insufficient access" } });
        await Promise.resolve();

        expect(element.shadowRoot.textContent).toContain("Insufficient access");
    });
});

describe("header", () => {
    it("renders nothing of the header when Show Header is off", async () => {
        const element = build();
        emitAll();
        await Promise.resolve();

        expect(element.shadowRoot.querySelector("h2")).toBeNull();
    });

    it("shows the list view label as the title", async () => {
        const element = build({ showHeader: true, showTitle: true });
        emitAll();
        await Promise.resolve();

        expect(element.shadowRoot.querySelector("h2").textContent).toBe("All Internal Asset Requests");
    });

    it("reports the item count and the list view's own sort field", async () => {
        const element = build({ showHeader: true, showStatus: true });
        emitAll();
        await Promise.resolve();

        expect(element.shadowRoot.querySelector("p").textContent).toBe(
            "2 items • Sorted by Internal Asset Request Name"
        );
    });

    it("says item, singular, for one record", async () => {
        const element = build({ showHeader: true, showStatus: true });
        emitAll({ records: records(1) });
        await Promise.resolve();

        expect(element.shadowRoot.querySelector("p").textContent).toContain("1 item •");
    });

    it("paints the object icon badge with the theme colour", async () => {
        const element = build({ showHeader: true, showObjectIcon: true });
        emitAll();
        await Promise.resolve();

        const badge = element.shadowRoot.querySelector(".record-list__icon");
        expect(badge.style.backgroundColor).toBe("rgb(93, 186, 74)");
        expect(badge.querySelector("img").src).toBe("https://example.com/icon.svg");
    });

    it("offers every list view for the object in the picker", async () => {
        const element = build({ showHeader: true, showListViewPicker: true });
        emitAll({
            lists: {
                lists: [
                    { label: "All", listViewApiName: "AllInternalAssetRequests" },
                    { label: "Mine", listViewApiName: "MyRequests" }
                ]
            }
        });
        await Promise.resolve();

        const items = element.shadowRoot.querySelectorAll("lightning-menu-item");
        expect(Array.from(items).map((i) => i.label)).toEqual(["All", "Mine"]);
        // The configured view is the checked one.
        expect(items[0].checked).toBe(true);
        expect(items[1].checked).toBe(false);
    });
});

describe("record links", () => {
    // The stubbed navigation resolves a constant URL, so this checks the WIRING —
    // that the name field is read from metadata and the generated href reaches the
    // table. The URL's actual shape is only observable in a real site.
    it("turns the name column into a link once navigation resolves", async () => {
        const element = build();
        emitAll();
        await flushPromises();

        const nameColumn = element.shadowRoot.querySelector("lightning-datatable").columns[0];
        expect(nameColumn.type).toBe("url");
        expect(nameColumn.typeAttributes.label).toEqual({ fieldName: "Name" });
    });

    it("puts a generated url on every row", async () => {
        const element = build();
        emitAll();
        await flushPromises();

        const rows = element.shadowRoot.querySelector("lightning-datatable").data;
        rows.forEach((row) => expect(row.Name__url).toBe("https://www.example.com"));
    });

    it("takes the name field from the object metadata, not the literal name Name", async () => {
        const element = build();
        emitAll({
            objectInfo: { ...OBJECT_INFO, nameFields: ["Status__c"] },
            listInfo: LIST_INFO
        });
        await flushPromises();

        const columns = element.shadowRoot.querySelector("lightning-datatable").columns;
        expect(columns[0].type).toBe("text");
        expect(columns[1].type).toBe("url");
    });

    it("still shows the table unlinked when no name field is known", async () => {
        const element = build();
        emitAll({ objectInfo: { ...OBJECT_INFO, nameFields: undefined } });
        await flushPromises();

        const table = element.shadowRoot.querySelector("lightning-datatable");
        expect(table.data).toHaveLength(2);
        expect(table.columns.every((c) => c.type !== "url")).toBe(true);
    });
});

describe("reference links", () => {
    const ACCOUNT_INFO = {
        ...OBJECT_INFO,
        fields: {
            Name: { dataType: "String" },
            OwnerId: { dataType: "Reference", relationshipName: "Owner", referenceToInfos: [{ apiName: "User" }] }
        }
    };
    const OWNER_LIST_INFO = {
        ...LIST_INFO,
        displayColumns: [
            { fieldApiName: "Name", label: "Account Name", sortable: true },
            { fieldApiName: "Owner.Alias", label: "Account Owner Alias", sortable: false }
        ]
    };

    function ownedRecords(ownerIds) {
        return {
            count: ownerIds.length,
            nextPageToken: null,
            previousPageToken: null,
            records: ownerIds.map((ownerId, i) => ({
                id: `00100000000000${i}`,
                fields: {
                    Name: { value: `Acme ${i}`, displayValue: null },
                    Owner: { value: { fields: { Alias: { value: "CRous" }, Id: { value: ownerId } } } }
                }
            }))
        };
    }

    async function render(ownerIds) {
        const element = build({ objectApiName: "Account" });
        emitAll({ objectInfo: ACCOUNT_INFO, listInfo: OWNER_LIST_INFO, records: ownedRecords(ownerIds) });
        await flushPromises();
        return element.shadowRoot.querySelector("lightning-datatable");
    }

    it("links a relationship column to its parent record", async () => {
        const table = await render(["005000000000001"]);

        const ownerColumn = table.columns[1];
        expect(ownerColumn.type).toBe("url");
        expect(ownerColumn.typeAttributes.label).toEqual({ fieldName: "Owner_Alias" });
        expect(table.data[0].Owner_Alias__url).toBe("https://www.example.com");
    });

    it("leaves a row unlinked when its parent id is missing", async () => {
        const element = build({ objectApiName: "Account" });
        const ownerless = ownedRecords(["005000000000001"]);
        ownerless.records[0].fields.Owner = { value: null };
        emitAll({ objectInfo: ACCOUNT_INFO, listInfo: OWNER_LIST_INFO, records: ownerless });
        await flushPromises();

        const table = element.shadowRoot.querySelector("lightning-datatable");
        expect(table.data[0].Owner_Alias__url).toBeUndefined();
    });

    it("leaves user columns as plain text when Disable User Links is on", async () => {
        const element = build({ objectApiName: "Account", disableUserLinks: true });
        emitAll({
            objectInfo: ACCOUNT_INFO,
            listInfo: OWNER_LIST_INFO,
            records: ownedRecords(["005000000000001"])
        });
        await flushPromises();

        const table = element.shadowRoot.querySelector("lightning-datatable");
        expect(table.columns[1].type).toBe("text");
        // The alias still shows; only the link is gone.
        expect(table.data[0].Owner_Alias).toBe("CRous");
    });

    it("still links the record's own name column when user links are disabled", async () => {
        const element = build({ objectApiName: "Account", disableUserLinks: true });
        emitAll({
            objectInfo: ACCOUNT_INFO,
            listInfo: OWNER_LIST_INFO,
            records: ownedRecords(["005000000000001"])
        });
        await flushPromises();

        expect(element.shadowRoot.querySelector("lightning-datatable").columns[0].type).toBe("url");
    });

    it("keeps linking non-user references when Disable User Links is on", async () => {
        const element = build({ objectApiName: "Account", disableUserLinks: true });
        emitAll({
            objectInfo: {
                ...OBJECT_INFO,
                fields: {
                    Name: { dataType: "String" },
                    ParentId: {
                        dataType: "Reference",
                        relationshipName: "Owner",
                        referenceToInfos: [{ apiName: "Account" }]
                    }
                }
            },
            listInfo: OWNER_LIST_INFO,
            records: ownedRecords(["001000000000009"])
        });
        await flushPromises();

        expect(element.shadowRoot.querySelector("lightning-datatable").columns[1].type).toBe("url");
    });

    it("skips a column whose target object cannot be resolved", async () => {
        const element = build({ objectApiName: "Account" });
        emitAll({
            objectInfo: { ...OBJECT_INFO, fields: { Name: { dataType: "String" } } },
            listInfo: OWNER_LIST_INFO,
            records: ownedRecords(["005000000000001"])
        });
        await flushPromises();

        const table = element.shadowRoot.querySelector("lightning-datatable");
        expect(table.columns[1].type).toBe("text");
    });
});

describe("sorting", () => {
    it("starts from the list view's own sort order", async () => {
        const element = build();
        emitAll();
        await Promise.resolve();

        const table = element.shadowRoot.querySelector("lightning-datatable");
        // sortedBy has to match the column's CURRENT fieldName for the arrow to
        // land on it, and linking renamed the name column's fieldName to a url key.
        expect(table.sortedBy).toBe(table.columns[0].fieldName);
        expect(table.columns[0].label).toBe("Internal Asset Request Name");
        expect(table.sortedDirection).toBe("asc");
    });

    // sortBy must be an ARRAY of object-qualified names. A bare string is accepted
    // and then silently ignored: the header flips, the rows never move.
    it("sends an array of object-qualified names, ascending", async () => {
        const element = build();
        emitAll();
        await flushPromises();

        await sortByColumnLabel(element, "Internal Asset Request Name", "asc");

        expect(getListRecordsByName.getLastConfig().sortBy).toEqual(["Internal_Asset_Request__c.Name"]);
    });

    it("sorts by the real field even though the name column's fieldName is a url", async () => {
        const element = build();
        emitAll();
        await flushPromises();

        const table = element.shadowRoot.querySelector("lightning-datatable");
        expect(table.columns[0].fieldName).toBe("Name__url");

        await sortByColumnLabel(element, "Internal Asset Request Name", "asc");

        expect(getListRecordsByName.getLastConfig().sortBy).toEqual(["Internal_Asset_Request__c.Name"]);
    });

    it("prefixes the qualified name with - when sorted descending", async () => {
        const element = build();
        emitAll();
        await flushPromises();

        await sortByColumnLabel(element, "Status", "desc");

        expect(getListRecordsByName.getLastConfig().sortBy).toEqual(["-Internal_Asset_Request__c.Status__c"]);
    });

    it("translates a flattened row key back to the field api name", async () => {
        const element = build({ objectApiName: "Account" });
        emitAll({
            listInfo: {
                ...LIST_INFO,
                displayColumns: [{ fieldApiName: "Owner.Alias", label: "Owner", sortable: true }]
            }
        });
        await Promise.resolve();

        await sortByColumnLabel(element, "Owner", "asc");

        expect(getListRecordsByName.getLastConfig().sortBy).toEqual(["Account.Owner.Alias"]);
    });

    it("reflects the chosen direction back to the table header", async () => {
        const element = build();
        emitAll();
        await flushPromises();

        const table = await sortByColumnLabel(element, "Status", "desc");

        expect(table.sortedBy).toBe("Status__c");
        expect(table.sortedDirection).toBe("desc");
    });
});

describe("pagination", () => {
    it("disables Previous on the first page and Next on the last", async () => {
        const element = build({ showPagination: true });
        emitAll();
        await Promise.resolve();

        const buttons = element.shadowRoot.querySelectorAll("lightning-button");
        expect(buttons[0].disabled).toBe(true);
        expect(buttons[1].disabled).toBe(true);
    });

    it("advances the page token on Next", async () => {
        const element = build({ showPagination: true });
        emitAll({ records: records(2, { nextPageToken: "20" }) });
        await Promise.resolve();

        const buttons = element.shadowRoot.querySelectorAll("lightning-button");
        expect(buttons[1].disabled).toBe(false);
        buttons[1].dispatchEvent(new CustomEvent("click"));
        await Promise.resolve();

        expect(getListRecordsByName.getLastConfig().pageToken).toBe("20");
    });

    it("returns to the first page when the sort changes, so the offset cannot go stale", async () => {
        const element = build({ showPagination: true });
        emitAll({ records: records(2, { nextPageToken: "20", previousPageToken: "0" }) });
        await Promise.resolve();

        element.shadowRoot.querySelectorAll("lightning-button")[1].dispatchEvent(new CustomEvent("click"));
        await flushPromises();
        expect(getListRecordsByName.getLastConfig().pageToken).toBe("20");

        await sortByColumnLabel(element, "Internal Asset Request Name", "desc");

        expect(getListRecordsByName.getLastConfig().pageToken).toBeNull();
    });
});

describe("search", () => {
    it("passes a committed term to the wire, and null when cleared", async () => {
        const element = build({ showHeader: true, showSearch: true });
        emitAll();
        await Promise.resolve();

        const input = element.shadowRoot.querySelector("lightning-input");
        input.value = "  acme  ";
        input.dispatchEvent(new CustomEvent("commit"));
        await Promise.resolve();
        expect(getListRecordsByName.getLastConfig().searchTerm).toBe("acme");

        input.value = "";
        input.dispatchEvent(new CustomEvent("commit"));
        await Promise.resolve();
        expect(getListRecordsByName.getLastConfig().searchTerm).toBeNull();
    });
});

describe("which list view wins", () => {
    it("uses the configured List View", async () => {
        build({ listView: "MyAccounts" });
        await Promise.resolve();

        expect(getListInfoByName.getLastConfig().listViewApiName).toBe("MyAccounts");
    });

    it("lets the visitor's runtime choice override the configured one", async () => {
        const element = build({ listView: "MyAccounts", showHeader: true, showListViewPicker: true });
        emitAll({ lists: { lists: [{ label: "Recent", listViewApiName: "RecentAccounts" }] } });
        await flushPromises();

        element.shadowRoot
            .querySelector("lightning-button-menu")
            .dispatchEvent(new CustomEvent("select", { detail: { value: "RecentAccounts" } }));
        await flushPromises();

        expect(getListInfoByName.getLastConfig().listViewApiName).toBe("RecentAccounts");
    });

    it("is unconfigured when no list view is set", async () => {
        const element = build({ listView: undefined });
        await Promise.resolve();

        expect(element.shadowRoot.textContent).toContain("Select an object and a list view");
    });
});
