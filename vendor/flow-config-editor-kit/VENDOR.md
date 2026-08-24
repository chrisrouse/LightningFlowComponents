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
