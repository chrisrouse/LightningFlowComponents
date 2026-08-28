# Vendored: Flow Config Editor Kit

Upstream: https://github.com/RebbePod/flow-config-editor-kit
License: Apache-2.0 (see `LICENSE`, `NOTICE`)

## Pinned commit

```
1377405378f2fddb8534666fd9c6adb0cbbebcf1
2026-08-26  feat: offer Collection Filter and Collection Sort outputs as resources (#23)
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

**None. The tree is byte-identical to the pinned commit**, which is how it should stay
— a clean tree is diffable against upstream and costs nothing to re-pin.

### History: the Collection Filter gap, contributed and merged

`collectFlowResources` enumerated `recordLookups` and the four `ELEMENT_OUTPUT_GROUPS`
but not `collectionProcessors`, so **Collection Filter** and **Collection Sort** output
collections were invisible to every kit picker while Flow's own picker listed them.
The symptom: a Get Records collection could be selected but a filtered version of it
could not, making "get everything, filter it, show the result" impossible to wire
without an extra Assignment.

Patched locally 2026-08-26, contributed, and **merged upstream as #23** — which is now
the pinned commit, so the fork patches are gone and the tree is clean again.

**The merged version is better than the one contributed, and the difference is worth
knowing.** The local patch resolved a processor's object by looking up the collection
it consumed among the resources already collected. During review that became a
complete name map with cycle protection:

- **ours** — searched already-collected resources, so it depended on Flow emitting
  processors in dependency order, and a Collection Filter fed by another Collection
  Filter would not resolve.
- **upstream** — resolves through `processorsByName` regardless of array order, follows
  chains, and carries a `resolving` set so a cycle cannot recurse.

Anything relying on chained processors gets that for free by re-pinning; carrying the
local version would have kept the weaker resolution indefinitely.

**One bug the upstream test run found, now fixed in both copies:** a `null` entry in
`collectionProcessors` threw, because `processor.name` dereferenced it. `asArray`
guards a non-array, not null members. Now `processor?.name`.
