/**
 * Custom property editor listing the list views of whichever object is selected in
 * the Record List LWR property panel.
 *
 * The object comes from `c/recordListEditorState`, a module-scoped store the Object
 * editor publishes to — see that file for why the editors talk to each other
 * directly instead of sharing one property.
 *
 * The list views themselves come from `getListInfosByObjectName`. That wire works
 * inside a property editor because LDS provisions here, measured 2026-09-16. Apex
 * could do the same job with `SELECT DeveloperName, Name FROM ListView WHERE
 * SobjectType = :objectApiName`, and would be the fallback if the wire ever proves
 * unreliable — but the wire needs no Apex class and no permission set, and enforces
 * visibility itself.
 *
 * Contract: the property sheet injects label, description, required, value, errors
 * and schema, and expects one `valuechange` carrying { value }.
 */
import { LightningElement, api, wire } from "lwc";
import { getListInfosByObjectName } from "lightning/uiListsApi";
import { subscribeToSelectedObject } from "c/recordListEditorState";

export default class RecordListViewEditor extends LightningElement {
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
    }

    objectApiName;
    listInfos;
    listError;
    unsubscribe;

    connectedCallback() {
        this.unsubscribe = subscribeToSelectedObject((objectApiName) => {
            if (objectApiName === this.objectApiName) {
                return;
            }
            this.objectApiName = objectApiName;
            // The previous object's list views no longer apply, and leaving them on
            // screen would offer choices that cannot exist on the new object.
            this.listInfos = undefined;
            this.listError = undefined;
        });
    }

    disconnectedCallback() {
        this.unsubscribe?.();
    }

    @wire(getListInfosByObjectName, { objectApiName: "$objectApiName", pageSize: 200 })
    wiredListInfos({ data, error }) {
        if (data) {
            this.listInfos = data.lists ?? [];
            this.listError = undefined;
        } else if (error) {
            this.listInfos = undefined;
            this.listError = error.body?.message ?? error.statusText ?? error.message ?? JSON.stringify(error);
        }
    }

    get hasObject() {
        return !!this.objectApiName;
    }

    get options() {
        return (this.listInfos ?? []).map((list) => ({
            label: list.label,
            value: list.listViewApiName
        }));
    }

    get hasOptions() {
        return this.options.length > 0;
    }

    get isLoading() {
        return this.hasObject && !this.listInfos && !this.listError;
    }

    get hasNoListViews() {
        return this.hasObject && !!this.listInfos && this.options.length === 0;
    }

    get errorMessage() {
        return `List views could not be loaded. ${this.listError}`;
    }

    /**
     * Shown when a value is stored that the current object's list views do not
     * include — usually because the object was changed after the fact. Saying so
     * beats silently showing an empty picklist over a value that is still saved.
     */
    get isStaleValue() {
        return this.hasOptions && !!this._value && !this.options.some((option) => option.value === this._value);
    }

    get staleMessage() {
        return `Saved value "${this._value}" is not a list view of this object. Pick one below.`;
    }

    handleChange(event) {
        this._value = event.detail.value;
        this.dispatchEvent(new CustomEvent("valuechange", { detail: { value: this._value } }));
    }
}
