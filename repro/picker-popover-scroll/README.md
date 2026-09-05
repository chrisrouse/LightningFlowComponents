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
*clipped* column that would cut off a normal dropdown — and they reposition from a
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
