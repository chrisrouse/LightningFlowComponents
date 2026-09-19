import { createElement } from "lwc";
import FlowAutoNavigateEditor from "c/flowAutoNavigateEditor";

const INPUT_CHANGED = "configuration_editor_input_value_changed";

function build({ inputVariables = [] } = {}) {
    const element = createElement("c-flow-auto-navigate-editor", { is: FlowAutoNavigateEditor });
    element.builderContext = { variables: [] };
    element.inputVariables = inputVariables;
    document.body.appendChild(element);
    return element;
}

function captureInputs(element) {
    const details = [];
    element.addEventListener(INPUT_CHANGED, (event) => details.push(event.detail));
    return details;
}

function control(element, property) {
    return element.shadowRoot.querySelector(`[data-property="${property}"]`);
}

/** A number box change, as lightning-input reports it. */
function typeDuration(element, property, value) {
    const input = control(element, property);
    input.value = value;
    input.dispatchEvent(new CustomEvent("change"));
}

function toggle(element, property, checked) {
    const input = control(element, property);
    input.checked = checked;
    input.dispatchEvent(new CustomEvent("change"));
}

function summaryText(element, index = 0) {
    return element.shadowRoot.querySelectorAll(".duration__summary")[index].textContent;
}

/** The warning group's own summary line, below its three boxes. */
function warningSummaryText(element) {
    return summaryText(element, 1);
}

afterEach(() => {
    while (document.body.firstChild) {
        document.body.removeChild(document.body.firstChild);
    }
});

describe("duration entry", () => {
    it("renders a separate box for hours, minutes and seconds", () => {
        const element = build();

        ["timeoutHours", "timeoutMinutes", "timeoutSeconds"].forEach((property) => {
            expect(control(element, property)).not.toBeNull();
        });
    });

    it("publishes a whole number as a String with a Number data type", async () => {
        const element = build();
        const details = captureInputs(element);

        typeDuration(element, "timeoutMinutes", "2");
        await Promise.resolve();

        // "Number", not "Integer": Integer is a js-meta.xml property type and is
        // not one of Flow's value data types.
        expect(details).toEqual([{ name: "timeoutMinutes", newValue: "2", newValueDataType: "Number" }]);
    });

    it("clears the property when a box is emptied, rather than storing zero", async () => {
        const element = build({
            inputVariables: [{ name: "timeoutMinutes", value: "2", valueDataType: "Number" }]
        });
        const details = captureInputs(element);

        typeDuration(element, "timeoutMinutes", "");
        await Promise.resolve();

        expect(details).toEqual([{ name: "timeoutMinutes", newValue: null, newValueDataType: "Number" }]);
    });

    it("discards a negative entry", async () => {
        const element = build();
        const details = captureInputs(element);

        typeDuration(element, "timeoutSeconds", "-5");
        await Promise.resolve();

        expect(details).toEqual([]);
    });

    it("truncates a fractional entry", async () => {
        const element = build();
        const details = captureInputs(element);

        typeDuration(element, "timeoutSeconds", "7.9");
        await Promise.resolve();

        expect(details[0].newValue).toBe("7");
    });

    it("shows what was typed without waiting for Flow Builder to republish", async () => {
        const element = build();

        typeDuration(element, "timeoutMinutes", "3");
        await Promise.resolve();

        expect(control(element, "timeoutMinutes").value).toBe("3");
    });
});

describe("duration summary", () => {
    it("prompts for a duration when nothing is set", () => {
        expect(summaryText(build())).toBe("Enter how long the screen should wait before advancing.");
    });

    it("reads the total back in plain English", () => {
        const element = build({
            inputVariables: [
                { name: "timeoutMinutes", value: "1", valueDataType: "Number" },
                { name: "timeoutSeconds", value: "5", valueDataType: "Number" }
            ]
        });

        expect(summaryText(element)).toBe("Advances after 1 minute 5 seconds.");
    });

    it("singularizes a unit of one and omits empty units", () => {
        const element = build({
            inputVariables: [{ name: "timeoutHours", value: "1", valueDataType: "Number" }]
        });

        expect(summaryText(element)).toBe("Advances after 1 hour.");
    });

    it("updates as the admin types", async () => {
        const element = build();

        typeDuration(element, "timeoutSeconds", "30");
        await Promise.resolve();

        expect(summaryText(element)).toBe("Advances after 30 seconds.");
    });
});

describe("validation", () => {
    it("rejects a configuration with no duration", () => {
        expect(build().validate()).toEqual([
            { key: "timeoutSeconds", errorString: "Enter a duration greater than zero." }
        ]);
    });

    it("rejects a duration of explicit zeroes", async () => {
        const element = build();

        typeDuration(element, "timeoutSeconds", "0");
        await Promise.resolve();

        expect(element.validate()).toHaveLength(1);
    });

    it("accepts any duration above zero", () => {
        const element = build({
            inputVariables: [{ name: "timeoutSeconds", value: "1", valueDataType: "Number" }]
        });

        expect(element.validate()).toEqual([]);
    });
});

describe("display options", () => {
    it("publishes a checkbox as a Boolean", async () => {
        const element = build();
        const details = captureInputs(element);

        toggle(element, "showTimer", true);
        await Promise.resolve();

        expect(details).toEqual([{ name: "showTimer", newValue: true, newValueDataType: "Boolean" }]);
    });

    it("lets a checkbox be turned back off", async () => {
        const element = build({
            inputVariables: [{ name: "showTimer", value: true, valueDataType: "Boolean" }]
        });
        const details = captureInputs(element);

        toggle(element, "showTimer", false);
        await Promise.resolve();

        expect(details).toEqual([{ name: "showTimer", newValue: false, newValueDataType: "Boolean" }]);
        expect(control(element, "showTimer").checked).toBe(false);
    });

    it("defaults the direction to counting down without writing it", () => {
        const element = build();
        const details = captureInputs(element);

        expect(control(element, "timerDirection").value).toBe("Down");
        expect(details).toEqual([]);
    });

    it("disables the timer options until the timer is shown", async () => {
        const element = build();
        expect(control(element, "showReset").disabled).toBe(true);
        expect(control(element, "timerDirection").disabled).toBe(true);

        toggle(element, "showTimer", true);
        await Promise.resolve();

        expect(control(element, "showReset").disabled).toBe(false);
        expect(control(element, "timerDirection").disabled).toBe(false);
    });

    it("publishes the progress bar toggle", async () => {
        const element = build();
        const details = captureInputs(element);

        toggle(element, "showProgressBar", true);
        await Promise.resolve();

        expect(details).toEqual([{ name: "showProgressBar", newValue: true, newValueDataType: "Boolean" }]);
    });

    it("offers the message as a literal or a Flow resource", () => {
        const input = control(build(), "timerLabel");

        expect(input.tagName.toLowerCase()).toBe("c-flow-config-value-input");
        expect(input.valueType).toBe("String");
    });
});

describe("timeout action", () => {
    it("defaults to Next without writing it", () => {
        const element = build();
        const details = captureInputs(element);

        expect(control(element, "timeoutAction").value).toBe("Next");
        expect(details).toEqual([]);
    });

    it("offers every flow navigation action, plus staying put", () => {
        const values = control(build(), "timeoutAction").options.map((option) => option.value);
        expect(values).toEqual(["Next", "Back", "Finish", "Pause", "Stay"]);
    });

    it("publishes the chosen action", async () => {
        const element = build();
        const details = captureInputs(element);

        control(element, "timeoutAction").dispatchEvent(new CustomEvent("change", { detail: { value: "Finish" } }));
        await Promise.resolve();

        expect(details).toEqual([{ name: "timeoutAction", newValue: "Finish", newValueDataType: "String" }]);
    });
});

describe("pause binding", () => {
    it("takes a Boolean resource and refuses a literal", () => {
        const picker = control(build(), "paused");

        expect(picker.tagName.toLowerCase()).toBe("c-flow-config-resource-picker");
        expect(picker.acceptedTypes).toBe("Boolean");
        expect(picker.collection).toBe("exclude");
    });

    it("publishes the reference the admin picked", async () => {
        const element = build();
        const details = captureInputs(element);

        control(element, "paused").dispatchEvent(
            new CustomEvent("resourcechange", {
                detail: { name: "paused", newValue: "{!holdTimer}", newValueDataType: "reference" }
            })
        );
        await Promise.resolve();

        expect(details).toEqual([{ name: "paused", newValue: "{!holdTimer}", newValueDataType: "reference" }]);
    });

    it("reads a saved reference back in {!...} form", () => {
        const element = build({
            inputVariables: [{ name: "paused", value: "holdTimer", valueDataType: "reference" }]
        });

        expect(control(element, "paused").value).toBe("{!holdTimer}");
    });
});

describe("warning threshold entry", () => {
    it("uses the same three boxes as the duration", () => {
        const element = build();

        ["warningHours", "warningMinutes", "warningSeconds"].forEach((property) => {
            expect(control(element, property)).not.toBeNull();
        });
    });

    it("publishes each box the same way the duration does", async () => {
        const element = build();
        const details = captureInputs(element);

        typeDuration(element, "warningMinutes", "2");
        await Promise.resolve();

        expect(details).toEqual([{ name: "warningMinutes", newValue: "2", newValueDataType: "Number" }]);
    });

    it("says there is no warning phase until one is entered", () => {
        expect(warningSummaryText(build())).toBe("No warning phase.");
    });

    it("reads the warning back in plain English", () => {
        const element = build({
            inputVariables: [
                { name: "warningMinutes", value: "1", valueDataType: "Number" },
                { name: "warningSeconds", value: "30", valueDataType: "Number" }
            ]
        });

        expect(warningSummaryText(element)).toBe("Warns 1 minute 30 seconds before advancing.");
    });

    it("keeps the warning options disabled until a threshold is set", async () => {
        const element = build();
        expect(control(element, "warningStyle").disabled).toBe(true);

        typeDuration(element, "warningMinutes", "2");
        await Promise.resolve();

        expect(control(element, "warningStyle").disabled).toBe(false);
    });

    it("enables the options from any one of the three boxes", async () => {
        const element = build();

        typeDuration(element, "warningHours", "1");
        await Promise.resolve();

        expect(control(element, "warningShowIcon").disabled).toBe(false);
    });

    it("rejects a warning at or above the total duration", () => {
        const element = build({
            inputVariables: [
                { name: "timeoutMinutes", value: "2", valueDataType: "Number" },
                { name: "warningMinutes", value: "2", valueDataType: "Number" }
            ]
        });

        expect(element.validate()).toEqual([
            {
                key: "warningSeconds",
                errorString: "The warning must be shorter than the total duration of 2 minutes."
            }
        ]);
    });

    it("accepts a warning shorter than the duration", () => {
        const element = build({
            inputVariables: [
                { name: "timeoutMinutes", value: "5", valueDataType: "Number" },
                { name: "warningMinutes", value: "2", valueDataType: "Number" }
            ]
        });

        expect(element.validate()).toEqual([]);
    });
});
