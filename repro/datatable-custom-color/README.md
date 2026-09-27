# Probe: can a datatable cell take any picked color?

Standalone SFDX project. One LWC and one static resource, no Apex, no Flow Grid code.

Flow Grid is replacing its named color palette (Success, Warning, …) with
`lightning-input type="color"` everywhere. `lightning-datatable`'s
`cellAttributes` takes a `class` but no `style`, so a picked hex cannot be bound
to a cell directly.

**The mechanism under test.** The global stylesheet defines fixed classes whose
values are custom properties:

```css
.reproCC .reproColor_0 { background-color: var(--repro-color-0); color: var(--repro-color-0-on); }
```

The component sets `--repro-color-0` on a wrapper in its own template. Custom
properties inherit, including into shadow trees, so a cell carrying only the
class should resolve the picked color. An earlier probe saw an icon styling hook
fail to reach (`datatable-cell-colour`, finding 4), which is why this is measured
rather than assumed.

## What it answers

1. Do picked colors reach cells of every standard type?
2. Do they update live when the picker changes?
3. Is the computed black/white text readable on dark and light picks?
4. Does a cell icon follow the text color?
5. Do hover and focus revert the text, as in Flow Grid?
6. Does this org's `lightning-input type="color"` show the **Default** swatch tab?
   In the npm build (`lightning-base-components` 1.28.19-alpha) it is commented
   out: "Remove until raptor tabset is supported".

## Run it

```
sf project deploy start --source-dir force-app --target-org "Preview Org"
```

Place **Repro: Datatable Custom Color** on an App page, a Flow screen and an LWR
site page. The card shows its build marker (`rcc-2026-09-27b`) and whether the
stylesheet loaded. The checklist is on the card itself.

## Results

### Round a, 2026-09-27, App page, Preview Org

| # | Result |
| --- | --- |
| 1 | **Yes.** Fills reach text, currency, number, date, url and boolean cells. |
| 2 | **Yes.** Both colors changed live from the picker. |
| 3 | White text computed for #AD1071 and #218638; readable. A light pick not yet tried. |
| 4 | Not seen; the Icon column was off-screen. |
| 5 | Not yet reported. |
| 6 | **No Default tab.** The org's picker shows only the Custom panel (gradient, hue, hex, RGB), as in the npm source. |

Two gaps, both base components setting their own color rather than inheriting:
the url type's link stays blue on a fill, and the boolean check stays gray.
Round b makes links `color: inherit` and icons `fill: currentColor` inside a
colored cell.

### Round b

Not yet run.
