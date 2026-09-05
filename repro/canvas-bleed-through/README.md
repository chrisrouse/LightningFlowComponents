# Repro: Flow Builder canvas paints over a modal in a custom property editor

Self-contained. Three small LWCs, no Apex, no dependencies, **no CSS at all**, and
nothing from the product this was extracted from.

## Symptom

A modal opened from a Flow screen component's custom property editor
(`configurationEditor`) is painted **over** by the Flow Builder canvas — the selected
element's chip and its Move / Delete buttons, and the flow's connector lines. They
appear on top of the modal and remain visible through it.

## Reproduce

1. Deploy: `sf project deploy start --source-dir force-app --target-org <org>`
2. Create a screen flow, add a screen, drag on **Bleed Through Repro**.
3. **Select the component on the canvas** so its chip and Move / Delete buttons are
   drawn. This step matters — with nothing selected there is nothing to bleed.
4. In the property panel, click **Open Studio Modal**.

## What has been narrowed down so far

The bleed was first found in a modal built from hand-written `slds-modal` markup
rendered inside the property editor's own DOM. That version reproduced the bleed
**with every custom style removed** — the only thing left applied was elevating the
editor's host element (`position: relative; z-index: 1000000`), which is itself one of
the failed attempts below. So the product's ~190-line stylesheet is not the cause.

Failed attempts, in that hand-rolled version:

| Attempt                                                   | Result                                      |
| --------------------------------------------------------- | ------------------------------------------- |
| An explicit high `z-index` on the modal                   | No change                                   |
| Elevating the component host (`z-index: 1000000`)         | No change                                   |
| Making the modal's backdrop fully opaque                  | No change; the canvas still paints above it |
| Removing all custom CSS                                   | No change — still bleeds                    |

Measured in Flow Builder with a shadow-piercing walk over both DOM branches: the modal
resolved to `z-index: 1000000` and the canvas highlight (`.highlight.selected`) to
`5`, **both inside the same stacking context** — the one created by Flow Builder's
transformed `.slds-modal__container` — with no intervening stacking context on either
branch. By that measurement the modal already wins the paint order outright, so the
element painting above it may not be the highlight itself. Naming it is the question.

## What this version changes

This build uses the platform's own modal: the SLDS 2 `lightning/modal` base component,
opened with `size: "medium"`. That is the relevant difference, because `lightning/modal`
renders in the platform's overlay container rather than in the property editor's
subtree — so it is no longer a descendant of Flow Builder's transformed panel
ancestors.

The two questions for support:

1. Does the bleed persist with the platform's own modal? If it does, no amount of CSS
   in a custom modal is going to fix it, and the defect is in Flow Builder's canvas
   layering.
2. If it does **not**, is `lightning/modal` the supported way to open a dialog from a
   `configurationEditor`? The docs do not say either way, and a custom property editor
   is explicitly told elsewhere not to use flyouts or popouts.

The hand-rolled version is preserved in this repo's git history (commit `5e12056d`),
including a checkbox list of candidate causes that could be toggled without a redeploy.

## Deliberate omissions

So that nothing here is a red herring:

- **No CSS.** There is no stylesheet in any of the three bundles.
- **No product code**, no state, no Apex, no data. The datatable holds five hardcoded
  rows purely to give the modal realistic height and a scroll region.

## The diagnostic button

**Identify Element at Click** arms a one-shot capture listener. The next click is
swallowed, and the element stack at those coordinates is written to the console: every
element from the top down piercing shadow roots, then the ancestors of the topmost one
with `position`, `z-index` and `transform`.

Click it, then click directly on a bleeding chip, button or connector line. The first
entry names what is actually painting there. Delete `handleArmHitTest`, `hitTest` and
its button if it is not wanted.

## Files

```
bleedRepro         Flow screen component. Exists only to host the editor.
bleedReproEditor   The custom property editor. One button; opens the modal.
bleedReproStudio   The modal. Extends LightningModal; no markup wrapper, no CSS.
```
