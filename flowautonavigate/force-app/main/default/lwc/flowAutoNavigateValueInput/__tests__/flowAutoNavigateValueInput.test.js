import { createElement } from "lwc";
import FlowAutoNavigateValueInput from "c/flowAutoNavigateValueInput";

function build(props = {}) {
    const element = createElement("c-flow-auto-navigate-value-input", { is: FlowAutoNavigateValueInput });
    element.label = "Message to Users";
    element.propertyName = "timerLabel";
    Object.assign(element, props);
    document.body.appendChild(element);
    return element;
}

const picker = (element) => element.shadowRoot.querySelector("c-flow-config-value-input");
const standIn = (element) => element.shadowRoot.querySelector("lightning-input");

afterEach(() => {
    while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
    }
});

describe("enabled", () => {
    it("is the kit's value input", () => {
        const element = build({ value: "please wait", valueType: "String" });

        expect(picker(element)).not.toBeNull();
        expect(standIn(element)).toBeNull();
        expect(picker(element).value).toBe("please wait");
    });

    it("passes the change through untouched, so the editor still reads detail.name", () => {
        const element = build();
        const seen = [];
        element.addEventListener("valuechange", (event) => seen.push(event.detail));

        const detail = { name: "timerLabel", newValue: "{!msg}", newValueDataType: "reference" };
        picker(element).dispatchEvent(new CustomEvent("valuechange", { detail }));

        expect(seen).toEqual([detail]);
    });
});

describe("disabled", () => {
    /**
     * The whole point of the overlay: the kit input has no `disabled` API, so
     * it is swapped out rather than dressed up. Asserting the picker is gone
     * is what proves the greying is real -- asserting `.disabled` on the kit
     * input would pass even when nothing happened.
     */
    it("swaps the picker for a greyed stand-in", () => {
        const element = build({ disabled: true, value: "please wait" });

        expect(picker(element)).toBeNull();
        expect(standIn(element).disabled).toBe(true);
    });

    it("keeps the label, help text and current value visible", () => {
        const element = build({
            disabled: true,
            value: "Advancing soon",
            fieldLevelHelp: "Shown with the timer."
        });

        expect(standIn(element).label).toBe("Message to Users");
        expect(standIn(element).value).toBe("Advancing soon");
        expect(standIn(element).fieldLevelHelp).toBe("Shown with the timer.");
    });

    it("shows an empty field rather than 'null' for an unset value", () => {
        expect(standIn(build({ disabled: true })).value).toBe("");
    });

    it("swaps back, with the value intact", async () => {
        const element = build({ disabled: true, value: "please wait" });
        expect(picker(element)).toBeNull();

        element.disabled = false;
        await Promise.resolve();

        expect(picker(element)).not.toBeNull();
        expect(picker(element).value).toBe("please wait");
    });
});

describe("validation passthrough", () => {
    /** The editor's inherited validate() now finds this wrapper, not the kit
     *  input, so it has to forward all three calls or error mirroring stops. */
    it("forwards setCustomValidity and reportValidity to the picker", () => {
        const element = build();
        // The kit input is the real component here, so its methods are plain
        // functions rather than mocks.
        const setCustomValidity = jest.spyOn(picker(element), "setCustomValidity");
        const reportValidity = jest.spyOn(picker(element), "reportValidity");

        element.setCustomValidity("Required.");
        element.reportValidity();

        expect(setCustomValidity).toHaveBeenCalledWith("Required.");
        expect(reportValidity).toHaveBeenCalled();
    });

    it("surfaces the picker's own validation message", () => {
        const element = build();
        jest.spyOn(picker(element), "validationMessage", "get").mockReturnValue("Enter a value.");

        expect(element.validationMessage).toBe("Enter a value.");
    });

    it("reports nothing when disabled, rather than throwing", () => {
        const element = build({ disabled: true });

        expect(() => element.setCustomValidity("Required.")).not.toThrow();
        expect(element.reportValidity()).toBe(true);
        expect(element.validationMessage).toBe("");
    });
});
