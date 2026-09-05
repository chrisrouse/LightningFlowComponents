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
    columns = COLUMNS;
    rows = ROWS;

    comboOptions = [
        { label: "One", value: "one" },
        { label: "Two", value: "two" }
    ];

    handleClose() {
        this.close("closed");
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
