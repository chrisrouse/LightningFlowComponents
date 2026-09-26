/**
 * A replacement for the standard Record List component in LWR Experience sites.
 *
 * Phase 1: read-only. List view picker, columns and sort taken from the chosen list
 * view, search, and Previous/Next pagination. Selection, inline editing and actions
 * come later — see recordlistlwr/PLAN.md for the order and the constraints behind it.
 *
 * WHY EVERY REACTIVE PARAMETER IS INITIALISED TO null: if any `$` config property is
 * undefined the wire service never provisions, and both `data` and `error` stay
 * undefined — a silent dead component. The docs call this out for `pageToken`
 * specifically; it applies to all of them. null reads as "no value supplied".
 */
import { LightningElement, api, wire } from "lwc";
import { NavigationMixin } from "lightning/navigation";
import { getListInfoByName, getListInfosByObjectName, getListRecordsByName } from "lightning/uiListsApi";
import { getObjectInfo } from "lightning/uiObjectInfoApi";
import { buildTableModel, findReferencePaths, linkColumn, linkNameColumn, resolveRecordValue } from "./tableModel";

export default class RecordListLWR extends NavigationMixin(LightningElement) {
    /**
     * The object and list view, chosen together in the property panel.
     *
     * Backed by the `recordListSource` LightningTypeBundle rather than by two String
     * properties, because the List View choices depend on the chosen Object and a
     * property editor only ever sees its own property's value. One bundle means one
     * editor that can see both. See recordlistlwr/PLAN.md §1b.
     *
     * A bundle-typed property arrives here as a JSON STRING, so it is parsed into the
     * two fields the wires below consume. Objects are tolerated too, which is what
     * tests and Live Preview supply.
     *
     * SINGLE COMPONENT LIVE PREVIEW has no property panel, so this and `listView`
     * arrive undefined and every wire stays unprovisioned. To preview against real
     * data, default them here — e.g. "Account" and "AllAccounts" — and refresh the
     * browser, because wire config changes do not hot-reload.
     */
    @api objectApiName;

    /** Chosen from a picklist of the selected object's list views. */
    @api listView;

    @api pageSize = 10;

    /**
     * All default ON for an admin, via `default="true"` in the .js-meta.xml, so a
     * freshly dropped instance looks like a list rather than a bare table.
     *
     * They are declared false here because LWC requires it (LWC1099: a boolean
     * public property must default to false) — the metadata default is what an
     * Experience Builder instance actually gets. Unlike Flow Builder, which drops
     * false input parameters and forces negative naming, Experience Builder honors
     * the metadata default, so these can stay positively named.
     *
     * Consequence for Single Component Live Preview: there is no property panel, so
     * these stay false and the header and pagination will not render. Flip the ones
     * you want while previewing.
     */
    @api showHeader = false;
    @api showObjectIcon = false;
    @api showTitle = false;
    @api showListViewPicker = false;
    @api showStatus = false;
    @api showSearch = false;
    @api showPagination = false;

    /**
     * Leaves User reference columns as plain text.
     *
     * A User link resolves to the site's profile route, which is right for a site
     * whose visitors are meant to browse each other's profiles and wrong for one
     * where internal owner names are incidental detail — a dead-looking link to a
     * profile page the visitor cannot see. The component cannot tell those apart,
     * so the admin does.
     *
     * Scoped to User specifically, rather than to references in general: every other
     * reference target is a business record that the list view is already exposing.
     */
    @api disableUserLinks = false;

    /** Troubleshooting only. Renders the component's live state below the table. */
    @api showDiagnostics = false;

    pageToken = null;
    searchTerm = null;

    /**
     * Sort state is held unqualified (`Name`, `Owner.Alias`) and in a separate
     * direction, then assembled into `sortBy` for the wire. Holding the assembled
     * form as the single source of truth meant parsing the prefix and the object
     * qualifier back off it to render the header, which is needless work and one
     * more place to get wrong.
     */
    sortField = null;
    sortDirection = "asc";

    /**
     * An ARRAY of object-qualified field names, e.g. ["-Account.Name"].
     *
     * The parameter reference describes sortBy as a String taking one field with an
     * optional `-` prefix for descending. A plain string is accepted and then
     * silently ignored — the header flips, the rows do not move. The code example on
     * the same page passes an array of qualified names, and that is the shape the
     * wire honors. The response echoes the sortBy it actually applied, which is how
     * this was settled rather than guessed; the diagnostics panel shows both.
     */
    sortBy = null;

    /**
     * The fields to fetch, object-qualified — e.g. ["Account.Name", "Account.Owner.Alias"].
     *
     * NOT optional, despite the parameter reference calling these "additional
     * fields" that "don't create visible columns". Through the LDS wire a record's
     * `fields` map contains ONLY what was asked for here; the list view's display
     * columns are not implied. Omitting this returns ten records carrying nothing
     * but `id`, which renders as ten blank rows with no error anywhere. The REST
     * resource behaves differently and does return the display columns, so testing
     * against a REST payload will not catch this.
     *
     * `optionalFields` rather than `fields`: a field the running user cannot see is
     * silently dropped instead of erroring the whole list. For a component pointed
     * at arbitrary list views across arbitrary profiles, one inaccessible field
     * should cost one column, not the table.
     *
     * Undefined until the list view metadata lands, which deliberately holds the
     * records wire until we know which fields to ask for.
     */
    optionalFields;

    listInfo;
    objectInfo;
    recordCollection;
    error;

    availableLists = [];

    // The picker overrides the configured list view for the current session only. It
    // does not write back to the property, matching the standard component.
    selectedListViewApiName = null;

    /** The visitor's runtime pick wins over the configured list view. */
    get activeListViewApiName() {
        return this.selectedListViewApiName ?? this.listView;
    }

    @wire(getObjectInfo, { objectApiName: "$objectApiName" })
    wiredObjectInfo({ data, error }) {
        if (data) {
            this.objectInfo = data;
            this.refreshTableModel();
        } else if (error) {
            this.error = error;
        }
    }

    @wire(getListInfoByName, { objectApiName: "$objectApiName", listViewApiName: "$activeListViewApiName" })
    wiredListInfo({ data, error }) {
        if (data) {
            this.listInfo = data;
            this.error = undefined;
            this.optionalFields = this.buildOptionalFields(data);
            this.refreshTableModel();
        } else if (error) {
            this.error = error;
        }
    }

    /**
     * Qualifies each display column with the object name, as the wire requires, and
     * adds the parent Id behind every relationship column.
     *
     * `Owner.Alias` tells us what to SHOW but not what to link to, so
     * `Account.Owner.Id` rides along. It costs nothing visible — requested fields do
     * not become columns — and without it a reference column can never be linked.
     */
    buildOptionalFields(listInfo) {
        const columns = listInfo?.displayColumns ?? [];
        if (!this.objectApiName || columns.length === 0) {
            return undefined;
        }

        const displayFields = columns.map((column) => `${this.objectApiName}.${column.fieldApiName}`);
        const parentIdFields = findReferencePaths(listInfo, this.objectInfo).map(
            (reference) => `${this.objectApiName}.${reference.idPath}`
        );

        return [...new Set([...displayFields, ...parentIdFields])];
    }

    @wire(getListInfosByObjectName, { objectApiName: "$objectApiName", pageSize: 200 })
    wiredListInfos({ data, error }) {
        if (data) {
            this.availableLists = data.lists ?? [];
        } else if (error) {
            this.error = error;
        }
    }

    @wire(getListRecordsByName, {
        objectApiName: "$objectApiName",
        listViewApiName: "$activeListViewApiName",
        optionalFields: "$optionalFields",
        pageSize: "$pageSize",
        pageToken: "$pageToken",
        sortBy: "$sortBy",
        searchTerm: "$searchTerm"
    })
    wiredRecords({ data, error }) {
        if (data) {
            this.recordCollection = data;
            this.error = undefined;
            this.refreshTableModel();
            this.refreshRecordUrls();
            this.refreshReferenceUrls();
        } else if (error) {
            this.error = error;
            this.recordCollection = undefined;
            this.refreshTableModel();
        }
    }

    /**
     * With either setting blank the wire config is incomplete, so no wire ever
     * provisions and there is nothing to wait for. Without this check `isLoading`
     * stays true forever and the component is a permanent spinner — which is exactly
     * what an admin meets the moment they drop it on a page.
     */
    get isUnconfigured() {
        return !this.objectApiName || !this.activeListViewApiName;
    }

    get isLoading() {
        return !this.isUnconfigured && !this.error && (!this.listInfo || !this.recordCollection);
    }

    get hasRecords() {
        return this.rows.length > 0;
    }

    get isEmpty() {
        return !this.isLoading && !this.error && !this.hasRecords;
    }

    get errorMessage() {
        return this.error?.body?.message ?? this.error?.message ?? "This list could not be loaded.";
    }

    /**
     * The table model is built once per data change and STORED, not computed in a
     * getter.
     *
     * A getter is re-evaluated on every render, so `columns={columns}` and
     * `data={rows}` would hand lightning-datatable brand-new array and object
     * identities each time. Datatable normalises and caches its rows against those
     * references, so churning them defeats the cache — and cost aside, it is simply
     * wrong to rebuild a model as a side effect of rendering.
     */
    tableModel = { columns: [], rows: [] };

    /** Record id → site-relative URL, resolved by lightning/navigation. */
    recordUrlById = {};

    /** Column fieldApiName → { rowId: href } for relationship columns. */
    referenceUrls = {};

    refreshTableModel() {
        const base = buildTableModel(this.listInfo, this.objectInfo, this.recordCollection?.records);
        const withRecordLinks = linkNameColumn(base, this.nameFieldApiName, this.recordUrlById);

        this.tableModel = Object.entries(this.referenceUrls).reduce(
            (model, [fieldApiName, urlByRowId]) => linkColumn(model, fieldApiName, urlByRowId),
            withRecordLinks
        );
    }

    /**
     * The object's own name field — `Name` for Account, `CaseNumber` for Case — taken
     * from the object metadata rather than assumed to be called Name.
     */
    get nameFieldApiName() {
        return this.objectInfo?.nameFields?.[0];
    }

    /**
     * Asks lightning/navigation for each record's URL.
     *
     * Navigation resolves the site's OWN route for a record page — in an LWR site
     * that is `/<objectapiname>/<recordId>` — so nothing here hardcodes a path and a
     * site with custom routes still works.
     *
     * GenerateUrl is asynchronous and per record, hence the batch: the table renders
     * unlinked on the first pass and gains links a tick later. If navigation fails,
     * the table keeps its data and simply stays unlinked, rather than the whole
     * component failing over a hyperlink.
     */
    async refreshRecordUrls() {
        const records = this.recordCollection?.records ?? [];
        if (records.length === 0) {
            this.recordUrlById = {};
            return;
        }

        try {
            const entries = await Promise.all(
                records.map(async (record) => [
                    record.id,
                    await this[NavigationMixin.GenerateUrl]({
                        type: "standard__recordPage",
                        attributes: {
                            recordId: record.id,
                            objectApiName: this.objectApiName,
                            actionName: "view"
                        }
                    })
                ])
            );
            this.recordUrlById = Object.fromEntries(entries);
        } catch (navigationError) {
            this.recordUrlById = {};
            this.urlError = navigationError?.message ?? String(navigationError);
        }
        this.refreshTableModel();
    }

    /**
     * Links every relationship column to its parent record.
     *
     * Confirmed in the site on 2026-09-16: `standard__recordPage` with the parent's
     * object name resolves to whatever route that site defines — `/profile/<id>` for
     * a User, because a User page exists there. So nothing here hardcodes a path, and
     * a site WITHOUT a page for the target object simply yields no usable link rather
     * than a wrong one.
     *
     * URLs are generated once per distinct parent, not once per row: a list of ten
     * accounts owned by the same person needs one call, not ten.
     *
     * A column whose target object could not be resolved is skipped, leaving it as
     * plain text — an unlinked column beats a link to nowhere.
     */
    isLinkSuppressed(targetObject) {
        return this.disableUserLinks && targetObject === "User";
    }

    async refreshReferenceUrls() {
        const references = findReferencePaths(this.listInfo, this.objectInfo).filter(
            (reference) => reference.targetObject && !this.isLinkSuppressed(reference.targetObject)
        );
        const records = this.recordCollection?.records ?? [];
        if (references.length === 0 || records.length === 0) {
            this.referenceUrls = {};
            return;
        }

        const urlByTarget = new Map();
        const urlFor = (objectApiName, recordId) => {
            const key = `${objectApiName}:${recordId}`;
            if (!urlByTarget.has(key)) {
                urlByTarget.set(
                    key,
                    this[NavigationMixin.GenerateUrl]({
                        type: "standard__recordPage",
                        attributes: { recordId, objectApiName, actionName: "view" }
                    })
                );
            }
            return urlByTarget.get(key);
        };

        try {
            const resolved = await Promise.all(
                references.map(async (reference) => {
                    const entries = await Promise.all(
                        records.map(async (record) => {
                            const parentId = resolveRecordValue(record, reference.idPath);
                            if (!parentId) {
                                return null;
                            }
                            return [record.id, await urlFor(reference.targetObject, parentId)];
                        })
                    );
                    return [reference.fieldApiName, Object.fromEntries(entries.filter(Boolean))];
                })
            );
            this.referenceUrls = Object.fromEntries(resolved);
        } catch (navigationError) {
            this.referenceUrls = {};
            this.urlError = navigationError?.message ?? String(navigationError);
        }
        this.refreshTableModel();
    }

    get columns() {
        return this.tableModel.columns;
    }

    get rows() {
        return this.tableModel.rows;
    }

    // ---------------------------------------------------------------------------
    // DIAGNOSTICS, off by default, toggled from the property panel.
    //
    // Kept in the shipped component on purpose. Runtime behavior in an LWR site
    // has already differed from both the docs and from Node twice — most sharply
    // when records arrived carrying nothing but `id` and rendered as blank rows
    // with no error anywhere. Reading the component's actual state beats inferring
    // it: a checkbox costs nothing, while each guess costs a deploy and a reload.
    //
    // The marker exists so a stale bundle can never be blamed without proof. Bump
    // it when deploying a build whose identity matters.
    // ---------------------------------------------------------------------------
    get debugMarker() {
        return "BUILD_2026_09_16_I_userlinktoggle";
    }

    get debugSummary() {
        return [
            `rows=${this.rows.length}`,
            `cols=${this.columns.length}`,
            `records=${this.recordCollection?.records?.length ?? "none"}`,
            `count=${this.recordCollection?.count ?? "none"}`,
            `objectInfo=${this.objectInfo ? "yes" : "NO"}`,
            `listInfo=${this.listInfo ? "yes" : "NO"}`,
            `pageToken=${this.pageToken ?? "none"}`,
            `searchTerm=${this.searchTerm ?? "none"}`
        ].join("  ");
    }

    /**
     * Requested versus applied. The List Record Collection echoes the sortBy the
     * server actually used, so a request the wire ignored shows up as a mismatch
     * instead of as a mystery.
     */
    get debugSort() {
        return [
            `sent=${JSON.stringify(this.sortBy)}`,
            `echoed=${JSON.stringify(this.recordCollection?.sortBy ?? null)}`,
            `firstRowName=${JSON.stringify(this.rows[0]?.Name ?? null)}`
        ].join("  ");
    }

    /** What lightning/navigation actually produced for the first record. */
    get debugUrls() {
        const ids = Object.keys(this.recordUrlById);
        return [
            `nameField=${this.nameFieldApiName ?? "NONE"}`,
            `urls=${ids.length}`,
            `first=${ids.length ? this.recordUrlById[ids[0]] : "none"}`,
            `urlError=${this.urlError ?? "none"}`
        ].join("  ");
    }

    get debugReferenceLinks() {
        const entries = Object.entries(this.referenceUrls);
        if (entries.length === 0) {
            return "none";
        }
        return entries
            .map(([fieldApiName, urls]) => {
                const hrefs = Object.values(urls);
                return `${fieldApiName}: ${hrefs.length} urls, first=${hrefs[0] ?? "none"}`;
            })
            .join(" | ");
    }

    get debugOptionalFields() {
        return (this.optionalFields ?? []).join(", ") || "none";
    }

    get debugFirstColumn() {
        return JSON.stringify(this.columns[0] ?? null);
    }

    get debugFirstRow() {
        return JSON.stringify(this.rows[0] ?? null);
    }

    /** The record as the wire handed it over, before any shaping. */
    get debugRawRecord() {
        const record = this.recordCollection?.records?.[0];
        if (!record) {
            return "none";
        }
        return `fieldKeys=[${Object.keys(record.fields ?? {}).join(",")}]`;
    }

    get title() {
        return this.listInfo?.label;
    }

    get objectIconUrl() {
        return this.objectInfo?.themeInfo?.iconUrl;
    }

    get objectIconStyle() {
        const color = this.objectInfo?.themeInfo?.color;
        return color ? `background-color: #${color};` : "";
    }

    get showObjectIconBadge() {
        return this.showObjectIcon && !!this.objectIconUrl;
    }

    get listViewMenuItems() {
        return this.availableLists.map((list) => ({
            label: list.label,
            value: list.listViewApiName,
            checked: list.listViewApiName === this.activeListViewApiName
        }));
    }

    /**
     * The status line under the title, e.g. "2 items • Sorted by Name".
     *
     * `count` on a List Record Collection is the number of records in THIS page, not
     * the size of the list — UI API exposes no total. With a page size above the
     * record count the two are the same, which is why the standard component appears
     * to show a total. Past that it counts the page, so the wording stays "items"
     * without implying a total.
     */
    get statusLine() {
        const count = this.recordCollection?.count;
        if (count === undefined) {
            return "";
        }
        const items = `${count} ${count === 1 ? "item" : "items"}`;
        const sortLabel = this.sortedByLabel;
        return sortLabel ? `${items} • Sorted by ${sortLabel}` : items;
    }

    get sortedByLabel() {
        const fieldApiName = this.currentSortFieldApiName;
        if (!fieldApiName) {
            return null;
        }
        const column = this.columns.find((c) => c.fieldApiName === fieldApiName);
        return column?.label ?? fieldApiName;
    }

    /** The user's choice if they have made one, otherwise the list view's own. */
    get currentSortFieldApiName() {
        return this.sortField ?? this.listInfo?.orderedByInfo?.[0]?.fieldApiName ?? null;
    }

    get sortedBy() {
        const fieldApiName = this.currentSortFieldApiName;
        return this.columns.find((c) => c.fieldApiName === fieldApiName)?.fieldName;
    }

    get sortedDirection() {
        if (this.sortField) {
            return this.sortDirection;
        }
        return this.listInfo?.orderedByInfo?.[0]?.isAscending === false ? "desc" : "asc";
    }

    get isFirstPage() {
        return !this.recordCollection?.previousPageToken;
    }

    get isLastPage() {
        return !this.recordCollection?.nextPageToken;
    }

    handleListViewSelect(event) {
        this.selectedListViewApiName = event.detail.value;
        this.resetPaging();
    }

    /**
     * Bound to `commit` rather than `change` so a search costs one request per entry
     * instead of one per keystroke.
     */
    handleSearchCommit(event) {
        const term = event.target.value?.trim();
        this.searchTerm = term ? term : null;
        this.resetPaging();
    }

    handleSort(event) {
        const { fieldName, sortDirection } = event.detail;
        const column = this.columns.find((c) => c.fieldName === fieldName);
        if (!column) {
            return;
        }
        this.sortField = column.fieldApiName;
        this.sortDirection = sortDirection === "desc" ? "desc" : "asc";
        this.sortBy = [`${this.sortDirection === "desc" ? "-" : ""}${this.objectApiName}.${this.sortField}`];
        this.resetPaging();
    }

    handlePrevious() {
        this.pageToken = this.recordCollection?.previousPageToken ?? null;
    }

    handleNext() {
        this.pageToken = this.recordCollection?.nextPageToken ?? null;
    }

    /** Any change to what is being listed invalidates the current page offset. */
    resetPaging() {
        this.pageToken = null;
    }
}
