/**
 * The Studio modal, as a native SLDS 2 modal.
 *
 * `lightning/modal` is a base class rather than markup: you extend it, compose
 * lightning-modal-header / -body / -footer, and call the static open() to show it.
 * The consequence that matters here is that the platform renders it in its OWN
 * overlay container, outside this component's DOM -- so it does not sit inside the
 * transformed, stacking-context-creating ancestors that Flow Builder wraps the
 * property panel in.
 *
 * That is the whole test. The hand-rolled `slds-modal` version of this repro bled
 * with every custom style removed. If this one does not bleed, the answer for the
 * real component is to stop hand-rolling the modal.
 *
 * There is NO stylesheet in this bundle. Size comes from `size: "medium"` passed to
 * open(), not from a width override.
 */
import { api } from "lwc";
import LightningModal from "lightning/modal";

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

export default class BleedReproStudio extends LightningModal {
    /** Echoed into the body so a screenshot says which size it was. */
    @api sizeLabel = "medium";

    columns = COLUMNS;
    rows = ROWS;
    measurement = "";

    comboOptions = [
        { label: "One", value: "one" },
        { label: "Two", value: "two" }
    ];

    handleClose() {
        this.close("closed");
    }

    /**
     * Walks up from the two-pane wrapper through every shadow root to the document,
     * reporting each ancestor's width. The question is whether the platform's modal
     * container grew to the 60rem the content asked for, or capped and let the
     * content overflow.
     */
    handleMeasure() {
        const pane = this.template.querySelector(".two-pane");
        if (!pane) {
            return;
        }

        const chain = [];
        let node = pane;
        while (node && node !== document.body) {
            chain.push(`${node.tagName.toLowerCase()}: ${Math.round(node.getBoundingClientRect().width)}px`);
            node = node.parentElement || node.getRootNode?.()?.host;
        }

        const paneWidth = Math.round(pane.getBoundingClientRect().width);
        const asked = 60 * parseFloat(getComputedStyle(document.documentElement).fontSize);
        this.measurement =
            `two-pane ${paneWidth}px vs ${Math.round(asked)}px asked; viewport ${window.innerWidth}px` +
            (paneWidth + 1 < asked ? " -- SQUASHED" : " -- honoured");

        console.log(
            `WIDTH at size=${this.sizeLabel}\n  viewport: ${window.innerWidth}px\n  asked for: ` +
                `${Math.round(asked)}px (60rem)\n\nANCESTOR WIDTHS, innermost first:\n  ` +
                chain.join("\n  ")
        );
    }

    /**
     * Swallows the next click and logs the element stack at those coordinates: down
     * through shadow roots to whatever is actually on top, then up through the
     * ancestors that decide paint order. Click this, then click a bleeding chip.
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
                classes ? "." + classes.split(/\s+/).join(".") : "",
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

        console.log(
            `HIT TEST at (${event.clientX}, ${event.clientY})\n\nTOPMOST FIRST:\n  ` +
                stack.join("\n  ") +
                `\n\nANCESTORS OF THE DEEPEST:\n  ` +
                ancestors.join("\n  ")
        );
    };
}
