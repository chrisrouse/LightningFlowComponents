import { LightningElement } from "lwc";
import { loadStyle } from "lightning/platformResourceLoader";
import FGRID_PROBE_GLOBAL from "@salesforce/resourceUrl/fgridProbeGlobal";

/**
 * What a `cellAttributes.class` can actually do to a datatable cell.
 *
 * Flow Grid is adding declarative conditional formatting, and Option A delivers
 * colour as a global `slds-*` class through `cellAttributes.class`. Run 1 of
 * this probe measured five surfaces and produced a workable palette. Then a
 * hovered screenshot showed `slds-theme_error` rendering white text on a
 * near-white background -- the value simply gone.
 *
 * ROUND 2 tests the explanation and the fix.
 *
 * The explanation: the theme class sets a background AND a text colour. The
 * datatable's own row hover repaints the background and leaves the text colour
 * alone, so a themed cell under the cursor keeps white text and loses the dark
 * background that made it legible. If that is right, the bug is hover only, the
 * palette is fine, and the fix is a hover rule.
 *
 * The catch is that a hover rule cannot be written in component CSS, which is
 * scoped and never reaches inside `lightning-datatable`. Round 1 proved that:
 * `fgridProbeCustom` rendered unstyled on all five surfaces.
 *
 * But that tested the wrong kind of stylesheet. The component Flow Grid
 * replaces ships a STATIC RESOURCE loaded with `loadStyle`, whose own header
 * reads "style sheet to bypass shadow dom", and uses it to fix hover behaviour
 * on exactly these cells. A global document stylesheet penetrates SYNTHETIC
 * shadow; under native shadow it should not. Lightning Experience and an LWR
 * site may therefore disagree -- which is the question.
 *
 * Four things this run answers, none of them answerable on paper:
 *
 *   1. Is the illegibility hover-only? Hover each themed row and watch.
 *   2. Does a global stylesheet reach inside the datatable, per surface?
 *      (`fgridProbeGlobal` column -- purple if yes, unstyled if no.)
 *   3. Can a hover rule repair the themed cell? (`slds-theme_error` and
 *      `slds-theme_success` rows carry `fgridProbeHoverFix`; the other themed
 *      rows deliberately do not, so the two can be compared under the cursor.)
 *   4. Does a CSS CUSTOM PROPERTY cross the shadow boundary where a selector
 *      cannot? Custom properties inherit, and the original uses
 *      `--slds-c-icon-color-foreground` for exactly this. Set on our host
 *      below -- if the icons go purple, we can colour an icon on any surface
 *      without a static resource at all.
 *
 * Every styled cell now repeats its own class name as its value, so a cropped
 * screenshot identifies itself. Round 1's labels sat in a neighbouring
 * unstyled column and a crop lost them.
 */

/** Every class worth trying, with what it is a candidate for. */
const CANDIDATES = [
    { label: "slds-theme_success", group: "Theme", cssClass: "slds-theme_success fgridProbeHoverFix" },
    { label: "slds-theme_warning", group: "Theme", cssClass: "slds-theme_warning" },
    { label: "slds-theme_error", group: "Theme", cssClass: "slds-theme_error fgridProbeHoverFix" },
    { label: "slds-theme_info", group: "Theme", cssClass: "slds-theme_info" },
    { label: "slds-theme_inverse", group: "Theme", cssClass: "slds-theme_inverse" },
    { label: "slds-theme_shade", group: "Theme", cssClass: "slds-theme_shade" },

    { label: "slds-text-color_success", group: "Text only", cssClass: "slds-text-color_success" },
    { label: "slds-text-color_error", group: "Text only", cssClass: "slds-text-color_error" },
    { label: "slds-text-color_weak", group: "Text only", cssClass: "slds-text-color_weak" },

    // SLDS 2 global styling hooks -- the real candidate. Paired container and
    // on- tokens, so Salesforce guarantees the contrast, each with its own
    // light and dark value. These rows also carry their own hover rule.
    { label: "HOOK error (container + on-)", group: "SLDS 2 hook", cssClass: "fgridHook_error" },
    { label: "HOOK success (container + on-)", group: "SLDS 2 hook", cssClass: "fgridHook_success" },
    { label: "HOOK warning (container + on-)", group: "SLDS 2 hook", cssClass: "fgridHook_warning" },
    // Neither of these was reachable through slds-theme_* at all.
    { label: "HOOK accent — blue", group: "SLDS 2 hook", cssClass: "fgridHook_accent" },
    { label: "HOOK neutral — grey", group: "SLDS 2 hook", cssClass: "fgridHook_neutral" },

    // Component-scoped CSS. Failed on all five surfaces in round 1; kept as the
    // control that the boundary is still where it was.
    { label: "fgridProbeCustom (component CSS)", group: "Ours", cssClass: "fgridProbeCustom" },

    // The same colour from the GLOBAL static resource. The difference between
    // this row and the one above is the entire finding.
    { label: "fgridProbeGlobal (static resource)", group: "Ours", cssClass: "fgridProbeGlobal" },

    { label: "(no class)", group: "Control", cssClass: "" }
];

export default class ReproCellColour extends LightningElement {
    styleStatus = "Global stylesheet: not loaded yet";

    /**
     * Two rows carry `fgridProbeHoverFix` and the rest do not, so hovering
     * compares the fix against the bug in one gesture.
     */
    columns = [
        { label: "Group", fieldName: "group", type: "text", initialWidth: 110 },
        {
            label: "Class applied — HOVER THIS COLUMN",
            fieldName: "label",
            type: "text",
            wrapText: true,
            cellAttributes: { class: { fieldName: "cssClass" } }
        },
        {
            label: "Same class, with an icon",
            fieldName: "label",
            type: "text",
            wrapText: true,
            cellAttributes: {
                class: { fieldName: "cssClass" },
                iconName: "utility:trending",
                iconPosition: "left"
            }
        },
        {
            label: "Currency",
            fieldName: "amount",
            type: "currency",
            initialWidth: 130,
            cellAttributes: { class: { fieldName: "cssClass" } }
        }
    ];

    data = CANDIDATES.map((candidate, index) => ({
        id: `row-${index}`,
        label: candidate.label,
        group: candidate.group,
        cssClass: candidate.cssClass,
        amount: 25000 + index
    }));

    renderedCallback() {
        if (this._styleRequested) {
            return;
        }
        this._styleRequested = true;

        // Reported on screen rather than to the console: a screenshot has to be
        // able to say whether the stylesheet loaded, or an unstyled row is
        // ambiguous between "shadow boundary held" and "the file never arrived".
        loadStyle(this, FGRID_PROBE_GLOBAL)
            .then(() => {
                this.styleStatus = "Global stylesheet: LOADED";
            })
            .catch((error) => {
                this.styleStatus = `Global stylesheet: FAILED — ${error?.message || error}`;
            });
    }
}
