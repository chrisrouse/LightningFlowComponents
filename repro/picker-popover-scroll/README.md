# Repro: a kit picker's popover does not follow its field when an ancestor scrolls

Standalone SFDX project. Two small LWCs, no Apex, one CSS rule. Requires the
[Flow Config Editor Kit](https://github.com/RebbePod/flow-config-editor-kit) deployed
in the target org.

## Symptom

Open a kit picker so its dropdown appears, then scroll an ancestor. The dropdown stays
exactly where it was drawn while its input scrolls away underneath it.

## Cause

The pickers do not render their dropdown inline. They render it `position: fixed` at
coordinates they compute themselves — Flow Builder's property panel is a narrow
_clipped_ column that would cut off a normal dropdown — and they reposition from a
capture-phase `scroll` listener bound to `window`
(`createPopoverViewportController` in `flowConfigPopoverUtils`).

`scroll` events are **not composed**, so they do not cross a shadow boundary. A scroll
that happens inside a consuming component's own shadow root never reaches a `window`
listener, so the handler never runs and the popover is never repositioned.

The positioning maths itself is fine: `anchorSignature` includes `anchorRect.top`, so a
scroll would reset the corrections and force a recompute — if the handler ran.

## Reproduce

1. Deploy: `sf project deploy start --source-dir force-app --target-org <org>`
2. Create a screen flow, add a screen, drag on **Picker Popover Scroll Repro**.
3. In the property editor, open the **Resource** picker.
4. With the dropdown open, scroll the bordered box.

The scroll container is ours and is guaranteed to overflow, so this does not depend on
the property panel being tall enough to scroll.

## RESOLVED — this is platform behaviour, not a kit defect

Measured in Flow Builder, Firefox, 2026-09-06, by walking shadow roots for open
dropdowns and reading their computed position.

`lightning-base-combobox` picks its strategy from context:

| Where                                                        | Position                  | z-index   |
| ------------------------------------------------------------ | ------------------------- | --------- |
| Builder toolbar, screen canvas, Component Visibility         | `absolute`, `top: 100%`   | 7000      |
| Inside a `lightning-accordion-section` in the property panel | **`fixed`** + computed px | 9101–9102 |
| Inside a consumer's `overflow-y: auto` box                   | **`fixed`** + computed px | 9101      |

The kit's pickers live inside `lightning-accordion-section`, so `position: fixed` is
the same choice Salesforce makes in the same place. The kit's premise — escape the
clipped panel — is correct, not mistaken.

**And native does not reposition it.** A standard Salesforce component's picklist was
opened in the property panel and the panel scrolled until the field left the viewport
entirely: the dropdown stayed exactly where it was drawn, floating over the page,
detached from its field. That is precisely what the kit does.

So there is no bug here to report. Tracking the anchor would make the kit _better than_
the platform — a legitimate enhancement, but one a maintainer may decline in order to
stay consistent with native behaviour.

Two differences from native are still worth raising upstream, being small and
uncontroversial:

- **z-index.** The kit uses `1000000`; native uses 7000/9101. A million sits above every
  Flow Builder layer, which is why the popover paints over canvas chrome that native
  dropdowns sit politely within.
- **Height.** Native caps to seven items (`slds-dropdown_length-with-icon-7`); the kit
  asks for 440px.

### What was tried

Both prototypes were deployed to a preview org, verified, and reverted. Neither touched
the vendored copy, which `VENDOR.md` forbids editing.

- **Per-frame anchor tracking** in `createPopoverViewportController` — call the existing
  handler once per animation frame while a picker is open, instead of trying to observe
  scrollers that `scroll` events cannot escape. Six lines, no picker changes, no
  ancestor traversal, so no Lightning Web Security question. **It worked**, and covers
  anything that moves the anchor rather than scrolling alone. The residual stutter
  matches how a native dropdown behaves mid-scroll.
- **Inline rendering** (`position: absolute; top: 100%`, dropping the computed style) —
  rejected. `.picker` already has `position: relative`, so it is nearly pure CSS, but a
  440px browsing UI is clipped to about two rows inside a 12rem container, and native
  does not render inline in this context either.

## Where it shows up in practice

Two shapes, one cause — any scroll container the `window` listener cannot observe:

- **A consumer's own scrolling panel**, which is what this repro isolates. Hit in a
  two-pane configuration modal whose panes each carry `overflow-y: auto`.
- **Flow Builder's own property panel.** A capture-phase `scroll` listener on
  `document` logs nothing while that panel scrolls, which puts its scroller inside
  Flow Builder's shadow root — equally invisible.

The second one matters more, because it needs no unusual markup from the consumer: it
is the kit's primary host.

## Suggested fix

Discover the scrollable ancestors instead of assuming `window` sees them. From the
anchor, walk up `parentElement || getRootNode().host` — which crosses shadow
boundaries — and attach the existing coalesced handler to every ancestor whose
computed `overflow-y` is `auto` or `scroll`. `addPopoverViewportListeners` already
takes a handler; it would grow an optional list of extra targets.

A consumer can work around the first shape by re-dispatching a `scroll` on `window`
from its own scroll container, since a picker recomputes from its own anchor's rect and
only needs telling that something moved. That does not help the second shape, because
the panel's scroller belongs to Flow Builder.

## Files

```
pickerScrollRepro        Flow screen component. Exists only to host the editor.
pickerScrollReproEditor  The property editor: one resource picker in a scrolling box.
```
