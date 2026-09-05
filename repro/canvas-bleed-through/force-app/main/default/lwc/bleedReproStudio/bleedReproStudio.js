/**
 * A custom modal rendered from inside a Flow Builder property editor.
 *
 * WHAT IS KNOWN. A pure SLDS modal here does NOT reproduce the bleed. So the cause
 * is in what the real component adds on top, and every addition is a toggle set from
 * the editor rather than baked in — see the `candidates` property.
 *
 * Everything is applied as an INLINE STYLE from JS rather than from a stylesheet, so
 * there is exactly one mechanism to reason about and the CSS file stays empty.
 *
 * TWO TRIGGERS, not just styles. The recorded reproduction was a SEQUENCE — select a
 * component on the canvas, open and close a picker, then reopen the modal — so the
 * bleed may be latent until something forces a repaint. The two buttons at the bottom
 * of the modal simulate that:
 *
 *   Simulate picker open/close  elevates a nested host and then RESETS it, which is
 *                               what the kit's popover helper does on close. If a
 *                               reset clears elevation the modal still depends on,
 *                               that is the bug.
 *   Simulate async re-render    re-renders after a tick, standing in for the Apex
 *                               metadata and preview loads the real Studio performs
 *                               after opening.
 */
import { LightningElement, api } from "lwc";

const COLUMNS = [
    { label: "Account Name", fieldName: "name" },
    { label: "Industry", fieldName: "industry" },
    { label: "Employees", fieldName: "employees", type: "number" }
];

const ROWS = [
    { id: "1", name: "Edge Communications", industry: "Electronics", employees: 1000 },
    { id: "2", name: "Burlington Textiles", industry: "Apparel", employees: 9000 },
    { id: "3", name: "Pyramid Construction", industry: "Construction", employees: 2680 },
    { id: "4", name: "Dickenson plc", industry: "Consulting", employees: 120 },
    { id: "5", name: "Grand Hotels & Resorts", industry: "Hospitality", employees: 5600 }
];

export default class BleedReproStudio extends LightningElement {
    /** Candidate keys chosen in the editor. Nothing is applied unless listed here. */
    @api candidates = [];

    columns = COLUMNS;
    rows = ROWS;
    repaintCount = 0;
    pickerElevated = false;

    comboOptions = [
        { label: "One", value: "one" },
        { label: "Two", value: "two" }
    ];

    /** Reads back which candidates are live, so a screenshot is self-describing. */
    get appliedSummary() {
        return this.candidates.length ? this.candidates.join(", ") : "none — plain SLDS modal";
    }

    get isTall() {
        return this.candidates.includes("tallSubtree");
    }

    /** Filler rows, only to make the modal taller than the viewport. */
    get fillerRows() {
        return Array.from({ length: 40 }, (unused, index) => ({ key: `filler-${index}`, label: `Row ${index + 1}` }));
    }

    /**
     * Applied on every render, setting or CLEARING each property explicitly so it is
     * idempotent and a toggle turning off really does remove its effect.
     */
    renderedCallback() {
        const on = (candidate) => this.candidates.includes(candidate);

        const host = this.template.host;
        host.style.position = on("hostElevation") ? "relative" : "";
        host.style.zIndex = on("hostElevation") ? "1000000" : "";

        const section = this.template.querySelector(".studio");
        if (section) {
            section.style.zIndex = on("modalZIndex") ? "99999" : "";
            section.style.backgroundColor = on("modalZIndex") ? "#e5e5e5" : "";
        }

        const container = this.template.querySelector(".studio__container");
        if (container) {
            container.style.width = on("wideContainer") ? "92vw" : "";
            container.style.maxWidth = on("wideContainer") ? "92vw" : "";
            container.style.minWidth = on("wideContainer") ? "60rem" : "";
        }

        const content = this.template.querySelector(".studio__content");
        if (content) {
            content.style.maxHeight = on("clippedContent") ? "74vh" : "";
            content.style.overflow = on("clippedContent") ? "hidden" : "";
        }
    }

    handleClose() {
        this.dispatchEvent(new CustomEvent("close"));
    }

    handleRepaint() {
        this.repaintCount += 1;
    }

    /**
     * Elevates a nested host and then resets it, exactly as the kit's popover helper
     * does — `host.style.position = ""` and `host.style.zIndex = ""` on close.
     *
     * The interesting case is the reset, not the elevation: a helper that clears
     * inline styles cannot know whether something else was relying on them.
     */
    handleSimulatePicker() {
        const picker = this.template.querySelector(".picker");
        if (!picker) {
            return;
        }
        picker.style.position = "relative";
        picker.style.zIndex = "1000000";
        this.pickerElevated = true;

        window.setTimeout(() => {
            picker.style.position = "";
            picker.style.zIndex = "";
            this.pickerElevated = false;
        }, 1200);
    }

    /** Stands in for the Apex loads the real Studio fires after opening. */
    handleAsyncRerender() {
        window.setTimeout(() => {
            this.rows = [...this.rows];
            this.repaintCount += 1;
        }, 400);
    }

    /**
     * OPTIONAL DIAGNOSTIC. Swallows the next click and logs the element stack at those
     * coordinates: down through shadow roots to whatever is on top, then up through the
     * ancestors that decide paint order.
     */
    handleArmHitTest() {
        document.addEventListener("click", this.hitTest, { capture: true, once: true });
    }

    hitTest = (event) => {
        event.preventDefault();
        event.stopPropagation();

        const describe = (element) => {
            const style = window.getComputedStyle(element);
            const classes = typeof element.className === "string" && element.className.trim();
            return [
                element.tagName.toLowerCase(),
                classes ? "." + classes.trim().split(/\s+/).join(".") : "",
                ` [position: ${style.position}, z-index: ${style.zIndex}, transform: ${style.transform}]`
            ].join("");
        };

        const stack = [];
        let element = document.elementFromPoint(event.clientX, event.clientY);
        while (element) {
            stack.push(describe(element));
            const inner = element.shadowRoot?.elementFromPoint(event.clientX, event.clientY);
            if (!inner || inner === element) {
                break;
            }
            element = inner;
        }

        const ancestors = [];
        let parent = element?.parentElement || element?.getRootNode?.()?.host;
        while (parent && ancestors.length < 15) {
            ancestors.push(describe(parent));
            parent = parent.parentElement || parent.getRootNode?.()?.host;
        }

        /* eslint-disable no-console */
        console.log(
            `HIT TEST at (${event.clientX}, ${event.clientY})\n\nTOPMOST FIRST:\n  ` +
                stack.join("\n  ") +
                `\n\nANCESTORS OF THE DEEPEST:\n  ` +
                ancestors.join("\n  ")
        );
        /* eslint-enable no-console */
    };
}
