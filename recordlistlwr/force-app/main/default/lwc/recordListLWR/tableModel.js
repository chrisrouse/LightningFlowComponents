/**
 * Turns UI API list metadata and records into `lightning-datatable` columns and rows.
 *
 * Kept free of LWC and of the wire service so it can be tested directly. The
 * component does the fetching; this file does the shaping.
 *
 * TWO THINGS THE UI API MAKES AWKWARD, and why the code looks like it does:
 *
 * 1. A List Column carries `fieldApiName`, `label`, `sortable` and `searchable` —
 *    but NO data type. Types come from Object Info instead, which is why both
 *    responses are needed before a column can be built.
 *
 * 2. A display column can be a path across a relationship, such as
 *    `Case__r.CaseNumber`. Records nest those: the value sits at
 *    `fields.Case__r.value.fields.CaseNumber`. Datatable indexes a flat row object
 *    by `fieldName`, so paths are flattened to a dot-free key and the original path
 *    is kept alongside for `sortBy`.
 */

/**
 * Salesforce field data type → datatable column type.
 *
 * `Date` maps to `date-local` rather than `date` because a Date field has no time
 * and `date` would shift it across a timezone boundary.
 *
 * `Percent` maps to `number`, NOT to datatable's `percent`: UI API returns 50 for
 * fifty percent, while `percent` formats its input as a fraction and would render
 * that as 5,000%.
 */
const DATATABLE_TYPE_BY_DATA_TYPE = {
    Boolean: "boolean",
    Currency: "currency",
    Date: "date-local",
    DateTime: "date",
    Double: "number",
    Email: "email",
    Int: "number",
    Long: "number",
    Percent: "number",
    Phone: "phone",
    Url: "url"
};

/** Types whose stored value is a code, so the formatted `displayValue` reads better. */
const PREFER_DISPLAY_VALUE = new Set(["Reference", "Picklist", "MultiPicklist"]);

/**
 * @param {object} listInfo List Info from getListInfoByName.
 * @param {object} objectInfo Object Info from getObjectInfo.
 * @param {object[]} records Records from getListRecordsByName.
 * @returns {{columns: object[], rows: object[]}} Ready for lightning-datatable.
 */
export function buildTableModel(listInfo, objectInfo, records) {
    const columns = buildColumns(listInfo, objectInfo);
    return { columns, rows: buildRows(records, columns) };
}

function buildColumns(listInfo, objectInfo) {
    return (listInfo?.displayColumns ?? []).map((column) => {
        const dataType = resolveDataType(column.fieldApiName, objectInfo);
        return {
            label: column.label,
            fieldName: toRowKey(column.fieldApiName),
            type: DATATABLE_TYPE_BY_DATA_TYPE[dataType] ?? "text",
            sortable: column.sortable === true,
            // Not read by datatable. Kept so onsort can translate the row key back
            // into the field path that sortBy expects.
            fieldApiName: column.fieldApiName,
            preferDisplayValue: PREFER_DISPLAY_VALUE.has(dataType)
        };
    });
}

/**
 * A dotted path has no entry in Object Info's flat `fields` map, so it resolves to
 * undefined and the column falls back to text. Resolving the target object's own
 * metadata would mean another round trip per relationship; text is honest and cheap.
 */
function resolveDataType(fieldApiName, objectInfo) {
    return objectInfo?.fields?.[fieldApiName]?.dataType;
}

function buildRows(records, columns) {
    return (records ?? []).map((record) => {
        const row = { id: record.id };
        columns.forEach((column) => {
            const field = resolveField(record, column.fieldApiName);
            if (!field) {
                return;
            }
            row[column.fieldName] = column.preferDisplayValue ? (field.displayValue ?? field.value) : field.value;
        });
        return row;
    });
}

/**
 * Finds the display columns that reach across a relationship, and works out what
 * they point at.
 *
 * A column like `Owner.Alias` shows a field ON the parent, so linking it needs two
 * things the display column does not carry: the parent record's Id, and the parent's
 * object type. The Id has to be requested explicitly (`Account.Owner.Id`); the object
 * type comes from the reference field whose `relationshipName` matches the first
 * segment — for `Owner` that is `OwnerId`, whose `referenceToInfos` names `User`.
 *
 * Only the FIRST segment is resolved, so a two-hop path such as
 * `Account.Parent.Owner.Alias` reports the type of `Parent`, not of `Owner`. Deeper
 * hops would need the target object's own metadata, which is another round trip per
 * hop. Single-hop covers what list views normally display.
 *
 * @returns {{fieldApiName: string, idPath: string, targetObject: string|null}[]}
 */
export function findReferencePaths(listInfo, objectInfo) {
    const fields = Object.values(objectInfo?.fields ?? {});

    return (listInfo?.displayColumns ?? [])
        .map((column) => column.fieldApiName)
        .filter((fieldApiName) => fieldApiName.includes("."))
        .map((fieldApiName) => {
            const segments = fieldApiName.split(".");
            const parentPath = segments.slice(0, -1).join(".");
            const parentField = fields.find((field) => field.relationshipName === segments[0]);

            return {
                fieldApiName,
                idPath: `${parentPath}.Id`,
                targetObject: parentField?.referenceToInfos?.[0]?.apiName ?? null
            };
        });
}

/**
 * Turns the object's name column into a link to each record.
 *
 * Datatable's `url` type reads the href from the column's `fieldName`, so that has
 * to point at a URL rather than at the name. The name survives as the link TEXT via
 * `typeAttributes.label`, which can reference another field on the row — so the row
 * keeps both keys: the original name, and a generated `<name>__url`.
 *
 * `fieldApiName` is left untouched, because sorting is server-side and still has to
 * sort by the real field, not by the URL.
 *
 * Pure on purpose: the URLs are produced by lightning/navigation in the component,
 * since only it can resolve the site's own routes. This function just applies them.
 *
 * @param {{columns: object[], rows: object[]}} model Output of buildTableModel.
 * @param {string} nameFieldApiName Usually objectInfo.nameFields[0].
 * @param {Object<string,string>} urlByRecordId Record id → site-relative URL.
 */
export function linkNameColumn(model, nameFieldApiName, urlByRecordId) {
    return linkColumn(model, nameFieldApiName, urlByRecordId);
}

/**
 * Makes one column a link, taking each row's href from `urlByRowId` keyed by the
 * row's own record id.
 *
 * Keying by ROW rather than by href lets the same function serve both cases: the
 * name column, where the href is the row's own record, and a reference column, where
 * it is that row's parent — a different target per row, resolved by the caller.
 *
 * Returns the model unchanged, by identity, when there is nothing to apply.
 */
export function linkColumn(model, fieldApiName, urlByRowId) {
    const target = model.columns.find((column) => column.fieldApiName === fieldApiName);
    if (!fieldApiName || !target || !urlByRowId) {
        return model;
    }

    const urlKey = `${target.fieldName}__url`;
    const columns = model.columns.map((column) => {
        if (column !== target) {
            return column;
        }
        return {
            ...column,
            type: "url",
            fieldName: urlKey,
            typeAttributes: { label: { fieldName: target.fieldName }, target: "_self" }
        };
    });
    const rows = model.rows.map((row) => ({ ...row, [urlKey]: urlByRowId[row.id] }));

    return { columns, rows };
}

/** Reads a field's value from a record, following a relationship path if present. */
export function resolveRecordValue(record, fieldApiName) {
    return resolveField(record, fieldApiName)?.value;
}

/** Walks a relationship path, descending through each parent's nested `fields`. */
function resolveField(record, fieldApiName) {
    const segments = fieldApiName.split(".");
    let fields = record?.fields;
    for (let i = 0; i < segments.length - 1; i++) {
        fields = fields?.[segments[i]]?.value?.fields;
    }
    return fields?.[segments[segments.length - 1]];
}

/** Datatable indexes rows by `fieldName`, and a dotted key would not resolve. */
function toRowKey(fieldApiName) {
    return fieldApiName.replace(/\./g, "_");
}
