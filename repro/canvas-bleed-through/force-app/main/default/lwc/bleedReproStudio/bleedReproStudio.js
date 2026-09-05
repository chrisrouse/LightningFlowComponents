/**
 * A custom modal rendered from inside a Flow Builder property editor.
 *
 * THE PROBLEM. Flow Builder wraps the property panel in transformed ancestors. A
 * transform creates a new stacking context, so a z-index on anything inside this
 * component is scoped to that ancestor and cannot outrank the screen canvas beside
 * it. Elevating the component HOST is the documented workaround and is applied
 * below — and the canvas's selected-element chip and its Move/Delete buttons STILL
 * paint over this modal.
 *
 * Measured in the real component with a shadow-piercing walk: the modal resolved to
 * z-index 1000000 and the canvas highlight to 5, both inside the SAME stacking
 * context, with no intervening stacking context on either branch. The modal already
 * won the paint order outright, which is why three attempts at fixing it by stacking
 * or by an opaque backdrop all failed.
 */
import { LightningElement } from "lwc";

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
    columns = COLUMNS;
    rows = ROWS;
    repaintCount = 0;
    choice = "one";

    options = [
        { label: "One", value: "one" },
        { label: "Two", value: "two" }
    ];

    connectedCallback() {
        // Host elevation. Two lines, inlined rather than imported, so this repro has
        // no dependencies. This is the documented workaround for a component that has
        // to escape a transformed ancestor's stacking context, and it is not enough.
        const host = this.template.host;
        host.style.position = "relative";
        host.style.zIndex = "1000000";
    }

    disconnectedCallback() {
        const host = this.template.host;
        host.style.position = "";
        host.style.zIndex = "";
    }

    handleClose() {
        this.dispatchEvent(new CustomEvent("close"));
    }

    handleChoice(event) {
        this.choice = event.detail.value;
    }

    handleRepaint() {
        this.repaintCount += 1;
    }

    /**
     * OPTIONAL DIAGNOSTIC — delete this and its button if it is noise.
     *
     * Arms a one-shot capture listener. The next click is swallowed and, instead of
     * acting, the element stack at those coordinates is written to the console:
     * every element from the top down, piercing shadow roots, then the ancestors of
     * the topmost one with the properties that decide paint order.
     *
     * This exists because the stacking measurement says the canvas chip should not be
     * able to paint above the modal. Naming the element that actually is, rather than
     * assuming it is the chip, is the open question.
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

        // Down through the shadow roots, to whatever is actually on top.
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

        // Then up from it, because the stacking context is an ancestor's doing.
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
