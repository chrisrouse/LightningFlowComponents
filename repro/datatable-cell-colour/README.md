# Probe: what `cellAttributes.class` can colour in a `lightning-datatable`

Standalone SFDX project. One LWC, no Apex, no Flow Grid code.

Not a bug report — a **measurement**. Flow Grid is adding declarative conditional
formatting, and Option A delivers colour as a global `slds-*` class through
`cellAttributes.class`. That class lands inside `lightning-datatable`'s shadow
root, so only classes the platform already ships can reach it. This renders every
candidate and lets the browser answer.

## Why it is not answerable from the docs

The [component reference](https://developer.salesforce.com/docs/component-library/bundle/lightning-datatable/documentation)
documents `cellAttributes` as taking `alignment`, `class`, `iconName`,
`iconLabel`, `iconPosition` and `iconAlternativeText`. Two gaps matter:

- **There is no `iconColor`.** A class is the only candidate for colouring an
  icon, and the docs do not say whether it works.
- **The `{ fieldName: ... }` indirection this depends on is not documented at
  all** on that page. It demonstrably works — the component Flow Grid replaces
  ships it — but nothing says which attributes accept it.

Salesforce's own conditional formatting offers six colours, set as inline hex:

| Name | Hex |
| --- | --- |
| Gray | `#747474` |
| Blue | `#0176D3` |
| Green | `#2E844A` |
| Orange | `#DD7A01` |
| Red | `#BA0517` |
| Purple | `#9050E9` |

No `slds-*` class produces those, which is the whole reason for measuring: our
palette is whatever the table below renders, not whatever that swatch row shows.

## What it answers

| # | Question | Where to look |
| --- | --- | --- |
| 1 | Which classes colour a cell at all | "Text + background" column |
| 2 | Whether an icon takes colour from the cell's class | "Same class, with an icon" column |
| 3 | Whether text and background are separable | Theme rows vs `slds-text-color_*` rows |
| 4 | Whether type formatting survives a class | Currency column — still `$25,000.00`? |
| 5 | Whether OUR stylesheet reaches inside the datatable | `fgridProbeCustom` row |
| 6 | Whether arbitrary hex works in our own markup | swatch row beneath the table |

Row 5 is expected to fail and row 6 to pass. If row 5 **passes**, the palette
problem disappears and Option A can offer the six native colours directly. If
row 6 passes while row 5 fails, that is the argument for Option B — a custom
cell type rendering colour in our own shadow root — in a single screenshot.

## Running it

Deployable to any org, and exposed on four targets so the same bundle can be
dropped on a Flow screen, an LWR site page, an App page and a Home page without
editing anything. Check at least the Flow screen and the LWR site: a site's
branding set can restyle SLDS themes, so a palette that reads well in Lightning
Experience is not automatically the palette a site visitor sees.

```bash
sf project deploy start --source-dir force-app
```

## Findings

_Not yet run. Record the rendered result here, with a screenshot, before the
Flow Grid rule editor is designed against it._
