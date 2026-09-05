# Repro: Flow Builder canvas paints over a custom modal in a property editor

Self-contained. Three small LWCs, no Apex, no dependencies, nothing from the product
this was extracted from.

## Symptom

A custom modal opened from a Flow screen component's custom property editor
(`configurationEditor`) is painted **over** by the Flow Builder canvas — specifically
the selected element's chip and its Move / Delete buttons. They appear on top of the
modal, and remain clickable through it.

## Reproduce

1. Deploy: `sf project deploy start --source-dir force-app --target-org <org>`
2. Create a screen flow, add a screen, drag on **Bleed Through Repro**.
3. **Select the component on the canvas** so its chip and Move/Delete buttons are
   drawn. This step matters — with nothing selected there is nothing to bleed.
4. In the property panel, click **Open Studio Modal**.
5. The chip and buttons sit over the modal. Click **Force a repaint**, or focus and
   blur the combobox, and the ordering becomes unmistakable.

## Why the obvious answers are not the answer

The real component tried all of these and none fixed it:

| Attempt                                                                   | Result                                                           |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| An explicit high `z-index` on the modal                                   | No change                                                        |
| Elevating the component **host** (`position: relative; z-index: 1000000`) | No change — and it is still applied here, in `connectedCallback` |
| Making the modal's backdrop fully opaque                                  | No change; the canvas still paints above it                      |

Measured in Flow Builder with a shadow-piercing walk over both DOM branches: the
modal resolved to `z-index: 1000000` and the canvas highlight (`.highlight.selected`)
to `5`, **both inside the same stacking context** — the one created by Flow Builder's
transformed `.slds-modal__container` — with no intervening stacking context on either
branch.

By that measurement the modal already wins the paint order outright, so the element
painting above it is probably **not** the canvas highlight. Naming it is the question.

## What this repro deliberately does not include

So that nothing here is a red herring:

- **No product CSS.** The real stylesheet is ~190 lines; `bleedReproStudio.css` keeps
  only four rules, each of which could plausibly matter, listed in a comment there.
  The most suspicious is the container width: the modal is `92vw`, wider than
  `slds-modal_large`, which is what makes it overlap the canvas column instead of
  sitting within the property panel.
- **No `slds-backdrop` element**, matching the real component — the tint is a
  `background-color` on the modal `<section>` instead.
- **No state, no Apex, no data.** The datatable holds five hardcoded rows.

## The diagnostic button

**Identify element at click** arms a one-shot capture listener. The next click is
swallowed, and the element stack at those coordinates is written to the console:
every element from the top down piercing shadow roots, then the ancestors of the
topmost one with `position`, `z-index` and `transform`.

Click it, then click directly on a bleeding chip or button. The first entry names what
is actually painting there. Delete `handleArmHitTest`, `hitTest` and its button if it
is not wanted.

## Files

```
bleedRepro         Flow screen component. Exists only to host the editor.
bleedReproEditor   The custom property editor. One button, opens the modal.
bleedReproStudio   The modal. The whole problem is here.
```
