# Vendored: Flow Config Editor Kit

Upstream: https://github.com/RebbePod/flow-config-editor-kit
License: Apache-2.0 (see `LICENSE`, `NOTICE`)

## Pinned commit

```
6443e41ddb93aad4be51dbf07983770ddd4c8288
2026-08-12  fix: rebalance documentation site layout (#22)
```

Upstream has no tagged releases. Version in its `package.json` is `0.1.0` (unreleased).

## What is vendored

Only `force-app/` — 73 files: 19 LWC bundles, `FlowConfigApexTypeController` (+ test),
the `FlowConfigApexTypeBridge` Visualforce page, and the
`Flow_Config_Editor_Access` permission set. All at `apiVersion` 67.0.

`examples/` is deliberately excluded; upstream states it is never part of the package.

## Do not edit these files

This copy is unmodified so it can be diffed against upstream. Fixes belong upstream
or in a clearly separate overlay — not here. To check for drift:

```bash
~/.claude/skills/flow-config-editor-kit/check-upstream.sh
```

To refresh: re-clone at the new SHA, replace `force-app/`, update the SHA above.

## Deploy

```bash
sf project deploy start -d vendor/flow-config-editor-kit/force-app -o "Preview Org"
sf org assign permset --name Flow_Config_Editor_Access -o "Preview Org"
```

`Flow_Config_Editor_Access` grants the Apex controller and Visualforce bridge used for
Apex-defined-type and hierarchy-setting discovery. Flow Grid does not currently use
either, but the permission set is part of the kit's supported install.

## Fork patches

The vendored tree was previously unmodified, for diffability against the pinned
commit. It no longer is. Every change is marked in-source with `FORK PATCH` and
listed here, so a future re-pin knows exactly what to re-apply.

### 1. Collection Filter and Collection Sort outputs — 2026-08-26

`flowConfigEditorUtils.collectFlowResources` enumerated `recordLookups` and the four
`ELEMENT_OUTPUT_GROUPS` (actionCalls, apexPluginCalls, subflows, screens) but not
`collectionProcessors`. Flow stores **Collection Filter** and **Collection Sort** as
`CollectionProcessor` elements, so their output collections were invisible to every
kit picker — while Flow's own native picker lists them under their element type.

The symptom: a Get Records collection could be selected but a filtered version of it
could not, which makes "get everything, filter it, show the result" impossible to
wire without an extra Assignment.

Added: enumeration of `builderContext.collectionProcessors`, taking the object from
`outputSObjectType` and falling back to the object of the collection named in
`collectionReference`, always marked `isCollection`. Grouped as "Collection Filter"
or "Collection Sort" from `elementSubtype`, matching the native picker's grouping.

Grouped under their own category — "Collection Filter" / "Collection Sort" — rather
than lumped in with "Record Variables", because that is how Flow's native picker
presents them and because a filtered collection was otherwise indistinguishable from
the Get Records it was filtering. That needed a second file:
`flowConfigResourceModel.js` gains both names in `CATEGORY_ORDER` (an unknown
category falls to index 999 and sorts below Global Variables) and in
`CATEGORY_ICONS`, mapped to the same `utility:record_alt` as any other record
collection — the group header already says which element produced it, so a different
glyph would imply the value differs in kind, which it does not.

Covered by `flowConfigEditorUtils/__tests__/collectionProcessors.test.js` and
`flowConfigResourceModel/__tests__/collectionProcessorGrouping.test.js`, both fork
additions.

Verified in the org 2026-08-26: a Collection Filter output now appears in the kit's
resource picker with the right object and collection flag.

**Worth reporting upstream.** This is a gap in the kit rather than anything specific
to Flow Grid, and the patch is small enough to contribute back.
