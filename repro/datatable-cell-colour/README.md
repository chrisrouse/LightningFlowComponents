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

### Surfaces measured

| Surface | Run | Result |
| --- | --- | --- |
| Flow Builder debug | 2026-09-19 | below |
| Lightning app/home page | pending | — |
| LWR Experience site | pending | — |

**The LWR run is the one that can still change the answer.** A site's branding
set restyles SLDS themes, so `slds-theme_success` is not guaranteed to be the
same green — or to stay legible — for a site visitor. That is the same class of
surprise as the modal close button taking the branding set's tertiary button
colour. Do not finalise the palette on the Flow debug result alone.

### Flow Builder debug, 2026-09-19

**Option A works, with a palette that is SLDS's, not Salesforce's own.**

### 1. Which classes colour a cell

`slds-theme_*` does, and sets a background **and** a text colour together:

| Class | Renders |
| --- | --- |
| `slds-theme_success` | green, white text |
| `slds-theme_warning` | orange, white text |
| `slds-theme_error` | red, white text |
| `slds-theme_info` | mid grey, white text |
| `slds-theme_inverse` | dark navy, white text |
| `slds-theme_alt-inverse` | darker navy, white text |
| `slds-theme_shade` | very light grey, dark text |
| `slds-theme_default` | white, dark text |

`slds-badge_success` and `slds-box_xx-small` did nothing. Dropped.

### 2. Text and background ARE separable

`slds-text-color_*` colours the text and leaves the background alone —
`success` green, `error` red, `weak` grey, `default` normal. So the editor keeps
two controls rather than collapsing into one.

**`slds-text-color_inverse` renders white on white and the value vanishes.**
Not a bug, just meaningless without a dark background. Exclude it, or only offer
it once a dark background is chosen.

### 3. Type formatting survives

Every currency cell still reads `$25,00X.00` and stays right-aligned under every
class. Colour does not cost formatting.

### 4. Our own stylesheet does NOT reach inside — as expected

`fgridProbeCustom` rendered completely unstyled while the identical colour in
the swatch row below rendered fine. That is the shadow-root boundary, measured:
a class only colours a datatable cell if the platform ships it.

**So Option A cannot offer blue or purple.** Nothing in the SLDS theme set is
blue, and nothing is purple. Against Salesforce's own six:

| Native | Hex | Option A |
| --- | --- | --- |
| Gray | `#747474` | `slds-theme_info` — close |
| Green | `#2E844A` | `slds-theme_success` |
| Orange | `#DD7A01` | `slds-theme_warning` |
| Red | `#BA0517` | `slds-theme_error` |
| Blue | `#0176D3` | **none** |
| Purple | `#9050E9` | **none** |

Four of six, plus navy and a subtle light grey the native palette lacks. For a
table, `shade` and `inverse` are arguably worth more than purple.

### 5. Option B is viable whenever it is wanted

The six native colours rendered exactly in the probe's own markup. A custom cell
type would get the full palette — this confirms the upgrade path is real, and
that its only true cost is re-rendering the value (see Flow Grid STATUS §2.3d).

### Still unconfirmed

Whether the **icon** takes its colour from the cell's class. The icons render in
every row and appear to follow the text colour, but they are too small in the
captured screenshot to call with confidence. Confirm before deciding whether
"Icon colour" is a control or a doc note.
