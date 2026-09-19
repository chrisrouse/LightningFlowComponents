import { LightningElement } from "lwc";

/**
 * What a `cellAttributes.class` can actually do to a datatable cell.
 *
 * Flow Grid is about to offer declarative conditional formatting, and Option A
 * delivers the colour as a global `slds-*` class through `cellAttributes.class`.
 * That class lands INSIDE `lightning-datatable`'s shadow root, so only classes
 * the platform already ships can reach it — our own stylesheet cannot.
 *
 * Which leaves four things unmeasured, and the rule editor's design depends on
 * every one of them:
 *
 *   1. WHICH classes actually colour a cell. Salesforce's own conditional
 *      formatting offers six swatches, set as inline hex (#747474 grey,
 *      #0176D3 blue, #2E844A green, #DD7A01 orange, #BA0517 red, #9050E9
 *      purple). No SLDS class produces those, so our palette is whatever this
 *      table renders — not whatever the swatch row shows.
 *   2. Whether an ICON in the cell takes colour from that class. `cellAttributes`
 *      has no `iconColor` (confirmed against the component reference), so a
 *      class is the only candidate. If it does not work, "Icon colour" is a line
 *      in the docs rather than a control in the editor.
 *   3. Whether TEXT and BACKGROUND are separable. `slds-theme_*` sets both at
 *      once; `slds-text-color_*` claims to set only the text. If they are not
 *      separable, two controls in the editor collapse into one.
 *   4. Whether a colour set INLINE in a custom cell type's own template survives.
 *      That is the load-bearing assumption under Option B, the upgrade path, and
 *      it is free to check here.
 *
 * Read the rendered table, not this comment. The point of the repro is that the
 * answer is whatever the browser draws.
 */

/** Every class worth trying, with what it is a candidate for. */
const CANDIDATES = [
    { key: "theme-success", label: "slds-theme_success", group: "Theme", cssClass: "slds-theme_success" },
    { key: "theme-warning", label: "slds-theme_warning", group: "Theme", cssClass: "slds-theme_warning" },
    { key: "theme-error", label: "slds-theme_error", group: "Theme", cssClass: "slds-theme_error" },
    { key: "theme-info", label: "slds-theme_info", group: "Theme", cssClass: "slds-theme_info" },
    { key: "theme-inverse", label: "slds-theme_inverse", group: "Theme", cssClass: "slds-theme_inverse" },
    { key: "theme-alt-inverse", label: "slds-theme_alt-inverse", group: "Theme", cssClass: "slds-theme_alt-inverse" },
    { key: "theme-shade", label: "slds-theme_shade", group: "Theme", cssClass: "slds-theme_shade" },
    { key: "theme-default", label: "slds-theme_default", group: "Theme", cssClass: "slds-theme_default" },

    { key: "text-success", label: "slds-text-color_success", group: "Text only", cssClass: "slds-text-color_success" },
    { key: "text-error", label: "slds-text-color_error", group: "Text only", cssClass: "slds-text-color_error" },
    { key: "text-weak", label: "slds-text-color_weak", group: "Text only", cssClass: "slds-text-color_weak" },
    { key: "text-default", label: "slds-text-color_default", group: "Text only", cssClass: "slds-text-color_default" },
    { key: "text-inverse", label: "slds-text-color_inverse", group: "Text only", cssClass: "slds-text-color_inverse" },

    // Backgrounds without a theme's text colour, if they resolve at all.
    { key: "bg-success", label: "slds-badge_success", group: "Other", cssClass: "slds-badge_success" },
    { key: "bg-alt", label: "slds-box_xx-small", group: "Other", cssClass: "slds-box_xx-small" },

    // Does a class WE define reach inside the datatable's shadow root? Expected
    // to fail. If it renders, the whole palette question is moot and Option A
    // can offer the six native colours directly.
    { key: "ours", label: "fgridProbeCustom (ours)", group: "Ours", cssClass: "fgridProbeCustom" },

    // The control. Whatever this looks like is "no formatting".
    { key: "none", label: "(no class)", group: "Control", cssClass: "" }
];

export default class ReproCellColour extends LightningElement {
    /**
     * One column per question.
     *
     * `Styled` and `WithIcon` carry the SAME class so the icon question is
     * answered beside the colour question rather than in a separate run.
     */
    columns = [
        { label: "Class applied", fieldName: "label", type: "text", wrapText: true, initialWidth: 220 },
        { label: "Group", fieldName: "group", type: "text", initialWidth: 100 },
        {
            label: "Text + background",
            fieldName: "sample",
            type: "text",
            cellAttributes: { class: { fieldName: "cssClass" } }
        },
        {
            label: "Same class, with an icon",
            fieldName: "sample",
            type: "text",
            cellAttributes: {
                class: { fieldName: "cssClass" },
                iconName: "utility:trending",
                iconPosition: "left"
            }
        },
        {
            label: "Currency, to check formatting survives",
            fieldName: "amount",
            type: "currency",
            cellAttributes: { class: { fieldName: "cssClass" } }
        }
    ];

    data = CANDIDATES.map((candidate, index) => ({
        id: `row-${index}`,
        label: candidate.label,
        group: candidate.group,
        cssClass: candidate.cssClass,
        sample: "Sample text",
        amount: 25000 + index
    }));
}
