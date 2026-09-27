import { LightningElement } from "lwc";
import { loadStyle } from "lightning/platformResourceLoader";
import REPRO_CUSTOM_COLOR_GLOBAL from "@salesforce/resourceUrl/reproCustomColorGlobal";

/**
 * Can a cell in lightning-datatable take ANY color an admin picks?
 *
 * `cellAttributes` accepts a class but no style, so a picked hex cannot be
 * bound to a cell directly. The idea under test: the global stylesheet defines
 * FIXED classes (`reproColor_0`) whose values are custom properties
 * (`var(--repro-color-0)`), and the component sets those properties on a
 * wrapper in its own template. Custom properties inherit, including into
 * shadow trees, so the cell should resolve them -- but an earlier probe saw an
 * icon hook fail to reach, so this is measured rather than assumed.
 *
 * Answers, per surface:
 *   1. Do the picked colors reach standard-type cells (text, currency,
 *      number, date, url, boolean)?
 *   2. Do they change live when the picker changes, with no re-render?
 *   3. Does the text color computed for contrast read well on both a light
 *      and a dark pick?
 *   4. Does the icon follow the text color?
 *   5. Hover and focus: does the text revert, as in the real grid?
 *   6. The picker itself: does this org's lightning-input type="color" show
 *      the Default swatch tab? The npm source has it commented out.
 */
const BUILD = "rcc-2026-09-27b";

export default class ReproCustomColor extends LightningElement {
    build = BUILD;
    fill0 = "#5679c0";
    fill1 = "#fff099";
    stylesLoaded = false;
    styleError;

    columns = [
        { label: "Case", fieldName: "label", cellAttributes: { class: { fieldName: "cls" } } },
        { label: "Text", fieldName: "name", cellAttributes: { class: { fieldName: "cls" } } },
        {
            label: "Currency",
            fieldName: "amount",
            type: "currency",
            cellAttributes: { class: { fieldName: "cls" } }
        },
        { label: "Number", fieldName: "count", type: "number", cellAttributes: { class: { fieldName: "cls" } } },
        { label: "Date", fieldName: "due", type: "date-local", cellAttributes: { class: { fieldName: "cls" } } },
        { label: "URL", fieldName: "site", type: "url", cellAttributes: { class: { fieldName: "cls" } } },
        { label: "Checkbox", fieldName: "active", type: "boolean", cellAttributes: { class: { fieldName: "cls" } } },
        {
            label: "Icon",
            fieldName: "name",
            cellAttributes: { class: { fieldName: "cls" }, iconName: "utility:warning" }
        }
    ];

    rows = [
        { id: "1", label: "Fill 0 (first picker)", cls: "reproFill reproColor_0" },
        { id: "2", label: "Fill 1 (second picker)", cls: "reproFill reproColor_1" },
        { id: "3", label: "Text only, color 0", cls: "reproColorText_0" },
        { id: "4", label: "None (control)", cls: "" }
    ].map((row, index) => ({
        ...row,
        name: `Acme ${index + 1}`,
        amount: 1250.5 * (index + 1),
        count: 7 * (index + 1),
        due: "2026-10-0" + (index + 1),
        site: "https://example.com",
        active: index % 2 === 0
    }));

    connectedCallback() {
        loadStyle(this, REPRO_CUSTOM_COLOR_GLOBAL)
            .then(() => {
                this.stylesLoaded = true;
            })
            .catch((error) => {
                this.styleError = error?.message || String(error);
            });
    }

    /** The whole mechanism: two colors and their contrast text, as properties. */
    get colorVars() {
        return [
            `--repro-color-0: ${this.fill0}`,
            `--repro-color-0-on: ${textColorFor(this.fill0)}`,
            `--repro-color-1: ${this.fill1}`,
            `--repro-color-1-on: ${textColorFor(this.fill1)}`
        ].join("; ");
    }

    get onColor0() {
        return textColorFor(this.fill0);
    }

    get onColor1() {
        return textColorFor(this.fill1);
    }

    handleFill0(event) {
        this.fill0 = event.target.value || this.fill0;
    }

    handleFill1(event) {
        this.fill1 = event.target.value || this.fill1;
    }
}

/**
 * Black or white, whichever contrasts more with the background, by WCAG
 * relative luminance. Returns black for anything that is not #rrggbb.
 */
function textColorFor(hex) {
    const match = /^#([0-9a-f]{6})$/i.exec(hex || "");
    if (!match) {
        return "#000000";
    }
    const [r, g, b] = [0, 2, 4].map((offset) => {
        const channel = parseInt(match[1].slice(offset, offset + 2), 16) / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    // Contrast against white is 1.05 / (L + 0.05); against black (L + 0.05) / 0.05.
    return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.05 ? "#ffffff" : "#000000";
}
