/**
 * A `c-flow-config-value-input` that can be disabled.
 *
 * The kit's value input exposes no `disabled` API. Passing one is silently
 * ignored, and LWC still sets the property, so a test asserting `.disabled`
 * passes against a control that never greys out — which is exactly how three
 * ungated controls shipped here.
 *
 * Real support would have to live in `flowConfigResourcePicker`: 2,770 lines,
 * six buttons and a popover, in files `vendor/flow-config-editor-kit/VENDOR.md`
 * says to leave unmodified so it can be diffed against upstream. This is the
 * "clearly separate overlay" that file points to instead.
 *
 * Enabled, it is the kit's input with the same API. Disabled, it swaps in a
 * plain greyed `lightning-input` showing the current value, so the control
 * stays visible — a greyed field tells an admin the option exists and implies
 * what unlocks it, where a hidden one teaches nothing.
 */
import { LightningElement, api } from "lwc";

export default class FlowAutoNavigateValueInput extends LightningElement {
    @api label;
    @api propertyName;
    @api value;
    @api valueDataType;
    @api valueType = "String";
    @api required = false;
    @api placeholder;
    @api fieldLevelHelp;
    @api builderContext;
    @api automaticOutputVariables;
    @api apiVersion;
    @api disabled = false;

    /** `lightning-input` shows nothing for null; the kit input tolerates it. */
    get displayValue() {
        return this.value ?? "";
    }

    handleValueChange(event) {
        // Passed through untouched: the editor reads `detail.name` off it to
        // decide which property to commit.
        this.dispatchEvent(new CustomEvent("valuechange", { detail: event.detail }));
    }

    /* ------------------------------------------------------------------ *
     * Validation passthrough
     *
     * The kit's inherited validate() sweeps `[data-validatable]` in the
     * editor's template, which now finds this wrapper rather than the kit
     * input. Without these three it would silently stop mirroring errors onto
     * the controls it covers.
     * ------------------------------------------------------------------ */

    get picker() {
        return this.template.querySelector("c-flow-config-value-input");
    }

    @api
    setCustomValidity(message) {
        this.picker?.setCustomValidity?.(message);
    }

    @api
    get validationMessage() {
        return this.picker?.validationMessage || "";
    }

    @api
    reportValidity() {
        // A disabled control has no picker and nothing to report.
        return this.picker?.reportValidity?.() ?? true;
    }
}
