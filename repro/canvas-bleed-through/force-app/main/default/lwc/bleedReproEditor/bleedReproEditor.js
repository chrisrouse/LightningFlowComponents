/**
 * Flow Builder custom property editor.
 *
 * Opens the Studio modal as a native SLDS 2 `lightning/modal`.
 *
 * The hand-rolled `slds-modal` revision of this repro rendered inside this editor's
 * own DOM and bled with every custom style removed. The native modal renders in the
 * platform's overlay container instead, outside the property panel's transformed
 * ancestors, and does not bleed -- at medium or at large.
 *
 * What is left to establish is width. The real component is 92vw with a 60rem floor,
 * and the platform caps at `large` on desktop (`full` behaves as `large` above 30em).
 * Both buttons below open the same two-pane content so the two sizes can be compared
 * against what the content actually asks for.
 */
import { LightningElement, api } from "lwc";
import BleedReproStudio from "c/bleedReproStudio";

export default class BleedReproEditor extends LightningElement {
    @api inputVariables = [];
    @api builderContext = {};

    async handleOpenMedium() {
        await this.openAt("medium");
    }

    async handleOpenLarge() {
        await this.openAt("large");
    }

    async openAt(size) {
        await BleedReproStudio.open({
            size,
            sizeLabel: size,
            description: "Studio Modal, a repro for canvas content painting over a modal"
        });
    }
}
