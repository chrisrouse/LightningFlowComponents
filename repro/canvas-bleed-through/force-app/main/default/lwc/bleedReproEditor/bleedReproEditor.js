/**
 * Flow Builder custom property editor.
 *
 * A pure SLDS modal in a CPE does NOT reproduce the bleed, so the cause is in
 * something the real component does on top of that. Each candidate below can be
 * switched on before opening the modal, so a bisect costs a click instead of a
 * deploy.
 *
 * Ordered by suspicion. Turn them on one at a time, top down.
 */
import { LightningElement, api } from "lwc";

const CANDIDATES = [
    {
        label: "1. Elevate the modal's host (position: relative; z-index: 1000000)",
        value: "hostElevation"
    },
    { label: "2. Container wider than the panel (92vw), so the modal overlaps the canvas", value: "wideContainer" },
    { label: "3. z-index and an opaque background on the modal itself", value: "modalZIndex" },
    { label: "4. Clip and scroll the modal content (max-height: 74vh; overflow: hidden)", value: "clippedContent" },
    { label: "5. A tall scrolling subtree inside the modal", value: "tallSubtree" }
];

export default class BleedReproEditor extends LightningElement {
    @api inputVariables = [];
    @api builderContext = {};

    candidateOptions = CANDIDATES;
    selected = [];
    isStudioOpen = false;

    handleCandidates(event) {
        this.selected = event.detail.value;
    }

    handleOpen() {
        this.isStudioOpen = true;
    }

    handleClose() {
        this.isStudioOpen = false;
    }
}
