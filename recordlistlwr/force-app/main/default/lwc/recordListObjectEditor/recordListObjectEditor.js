/**
 * Custom property editor for the Record List LWR component's Object property.
 *
 * A type-ahead rather than a `lightning-combobox`: an org this size offers several
 * hundred objects, and a plain combobox only jumps to the first letter typed.
 *
 * WHY THE LIST IS RENDERED INLINE, NOT IN A POPOVER. The property editor guidelines
 * rule out flyouts, popouts and absolute positioning — they misalign the property
 * panel and interrupt Experience Builder's editing flow. So the results expand in
 * flow beneath the input and the panel scrolls normally. This is also why the Flow
 * Config Editor Kit's pickers are not reused here: they are popover-anchored (see
 * the kit's own popover-positioning fixes) and carry Flow Builder dependencies that
 * have no meaning in a property panel.
 *
 * WHY APEX. No `lightning/ui*Api` adapter enumerates an org's objects — they all
 * need names up front — and `/services/data/.../sobjects` returns 404 from an
 * editor, whose origin does not serve it. Apex describe is what remains, and it is
 * how the Flow kit's object picker solves the same problem. Apex is not in the
 * documented list of modules an editor may use, but that list under-reports: LDS
 * adapters are absent from it too and were measured working here. Confirmed working
 * 2026-09-16 — hence the fallback below stays, rather than being trusted blindly.
 *
 * Contract: the property sheet injects label, description, required, value, errors
 * and schema, and expects exactly one `valuechange` carrying { value }. Validation
 * is the property sheet's job.
 */
import { LightningElement, api, wire } from "lwc";
import getListableObjects from "@salesforce/apex/RecordListObjectService.getListableObjects";
import { publishSelectedObject } from "c/recordListEditorState";

/** Enough to scroll through; past this, typing another letter beats scrolling. */
const MAX_VISIBLE = 100;

export default class RecordListObjectEditor extends LightningElement {
    @api label;
    @api description;
    @api required;
    @api errors;
    @api schema;

    _value;

    @api
    get value() {
        return this._value;
    }
    set value(incoming) {
        this._value = incoming;
        // The List View editor cannot read this property, so the choice is shared
        // through c/recordListEditorState. Published on SET as well as on selection,
        // so an already-configured panel populates its list views on open.
        publishSelectedObject(incoming);
    }

    objectOptions;
    apexError;

    searchTerm = "";
    isOpen = false;

    @wire(getListableObjects)
    wiredObjects({ data, error }) {
        if (data) {
            this.objectOptions = this.toOptions(data);
            this.apexError = undefined;
        } else if (error) {
            this.objectOptions = undefined;
            this.apexError = error.body?.message ?? error.statusText ?? error.message ?? JSON.stringify(error);
        }
    }

    /**
     * Shows the label alone, and appends the API name ONLY where two objects share
     * a label — which Salesforce orgs do often enough to matter, and where a bare
     * label would make the two choices indistinguishable.
     */
    toOptions(rows) {
        const labelCounts = rows.reduce((counts, row) => {
            counts.set(row.label, (counts.get(row.label) ?? 0) + 1);
            return counts;
        }, new Map());

        return rows.map((row) => ({
            value: row.apiName,
            apiName: row.apiName,
            label: labelCounts.get(row.label) > 1 ? `${row.label} (${row.apiName})` : row.label
        }));
    }

    get hasOptions() {
        return !!this.objectOptions?.length;
    }

    get isLoading() {
        return !this.objectOptions && !this.apexError;
    }

    get selectedLabel() {
        return this.objectOptions?.find((option) => option.value === this._value)?.label ?? this._value ?? "";
    }

    /** While open the input shows what is being typed; closed, it shows the choice. */
    get inputValue() {
        return this.isOpen ? this.searchTerm : this.selectedLabel;
    }

    get visibleOptions() {
        const term = this.searchTerm.trim().toLowerCase();
        const matches = term
            ? this.objectOptions.filter(
                  (option) => option.label.toLowerCase().includes(term) || option.apiName.toLowerCase().includes(term)
              )
            : this.objectOptions;

        return matches.slice(0, MAX_VISIBLE).map((option) => ({
            ...option,
            cssClass:
                option.value === this._value
                    ? "record-list-object-editor__option record-list-object-editor__option_selected"
                    : "record-list-object-editor__option"
        }));
    }

    get hasNoMatches() {
        return this.isOpen && this.visibleOptions.length === 0;
    }

    get hiddenCount() {
        const term = this.searchTerm.trim().toLowerCase();
        const total = term
            ? this.objectOptions.filter(
                  (option) => option.label.toLowerCase().includes(term) || option.apiName.toLowerCase().includes(term)
              ).length
            : this.objectOptions.length;
        return total > MAX_VISIBLE ? total - MAX_VISIBLE : 0;
    }

    get hasHiddenMatches() {
        return this.isOpen && this.hiddenCount > 0;
    }

    get hiddenMessage() {
        return `${this.hiddenCount} more — keep typing to narrow the list.`;
    }

    get fallbackMessage() {
        return `Object list unavailable, enter the API name directly. (${this.apexError})`;
    }

    handleFocus() {
        this.isOpen = true;
        this.searchTerm = "";
    }

    handleSearch(event) {
        this.searchTerm = event.target.value ?? "";
        this.isOpen = true;
    }

    /**
     * `mousedown` rather than `click`: the input's blur fires first on click and
     * would close the list before the selection landed.
     */
    handleOptionMouseDown(event) {
        event.preventDefault();
        this.publish(event.currentTarget.dataset.value);
        this.isOpen = false;
        this.searchTerm = "";
    }

    handleBlur() {
        this.isOpen = false;
        this.searchTerm = "";
    }

    handleKeyDown(event) {
        if (event.key === "Escape") {
            this.isOpen = false;
            this.searchTerm = "";
        }
    }

    /** Only reachable in the Apex-unavailable fallback, where the value is typed. */
    handleCommit(event) {
        this.publish(event.target.value?.trim() || undefined);
    }

    publish(value) {
        this._value = value;
        publishSelectedObject(value);
        this.dispatchEvent(new CustomEvent("valuechange", { detail: { value } }));
    }
}
