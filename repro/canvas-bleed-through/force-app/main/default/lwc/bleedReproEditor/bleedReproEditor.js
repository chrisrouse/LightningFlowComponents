/**
 * Flow Builder custom property editor.
 *
 * Opens the Studio modal. The modal is a native SLDS 2 `lightning/modal`, opened at
 * size medium, with no custom CSS anywhere in this project.
 *
 * The previous revision of this repro hand-rolled `slds-modal` markup inside this
 * editor's own DOM, and reproduced the bleed with every custom style commented out.
 * `lightning/modal` renders in the platform's overlay container instead, outside the
 * property panel's subtree, so this build isolates whether the bleed comes from the
 * modal living inside Flow Builder's transformed panel ancestors.
 */
import { LightningElement, api } from "lwc";
import BleedReproStudio from "c/bleedReproStudio";

export default class BleedReproEditor extends LightningElement {
    @api inputVariables = [];
    @api builderContext = {};

    result;

    async handleOpen() {
        this.result = await BleedReproStudio.open({
            size: "medium",
            description: "Studio Modal, a repro for canvas content painting over a modal"
        });
    }
}
