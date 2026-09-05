/**
 * Flow Builder custom property editor. One button, which opens the modal.
 *
 * Flow Builder injects `inputVariables` and expects `configuration_editor_input_value_changed`
 * back. Neither is exercised here — this editor changes nothing. It exists only to
 * put a custom modal inside the property panel.
 */
import { LightningElement, api } from "lwc";

export default class BleedReproEditor extends LightningElement {
    @api inputVariables = [];
    @api builderContext = {};

    isStudioOpen = false;

    handleOpen() {
        this.isStudioOpen = true;
    }

    handleClose() {
        this.isStudioOpen = false;
    }
}
