/**
 * Reproduces: a kit picker's popover does not follow its field when an ANCESTOR
 * scrolls, if that ancestor is a scroll container the `window` scroll listener
 * cannot observe.
 *
 * The pickers render their dropdown `position: fixed` at self-computed
 * coordinates, and reposition from a capture-phase `scroll` listener on `window`
 * (see `createPopoverViewportController` in `flowConfigPopoverUtils`). `scroll`
 * events are not composed, so they do not cross a shadow boundary — a scroll
 * inside a consuming component's own shadow root never reaches that listener,
 * and the popover is left behind.
 *
 * The scroll container here is ours and is guaranteed to overflow, so the repro
 * does not depend on Flow Builder's panel being tall enough to scroll.
 */
import { LightningElement, api } from "lwc";

export default class PickerScrollReproEditor extends LightningElement {
    @api builderContext = {};
    @api automaticOutputVariables = {};
    @api inputVariables = [];

    /** Filler, purely to make the container overflow. */
    filler = Array.from({ length: 12 }, (_, index) => ({
        key: `filler-${index}`,
        label: `Filler row ${index + 1}`
    }));

    get resourceValue() {
        return this.inputVariables?.find((variable) => variable.name === "resourceValue")?.value;
    }

    handleResource(event) {
        this.dispatchEvent(
            new CustomEvent("configuration_editor_input_value_changed", {
                bubbles: true,
                composed: true,
                cancelable: false,
                detail: {
                    name: "resourceValue",
                    newValue: event.detail?.newValue ?? null,
                    newValueDataType: event.detail?.newValueDataType ?? "String"
                }
            })
        );
    }
}
