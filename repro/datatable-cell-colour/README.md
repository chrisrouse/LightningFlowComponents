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
| Flow Builder debug | 2026-09-19 | SLDS 1 rendering, below |
| Lightning page, SLDS 1 | 2026-09-19 | matches Flow debug |
| Lightning page, SLDS 2 light | 2026-09-19 | **different colours, same meanings** |
| Lightning page, SLDS 2 dark | 2026-09-19 | **different colours, some inverted** |
| LWR Experience site | 2026-09-19 | **fourth rendering; text colour flips to black** |

## The headline: the palette is NOT fixed, and that is a feature

The same class renders differently under SLDS 1, SLDS 2 light and SLDS 2 dark:

| Class | SLDS 1 | SLDS 2 light | SLDS 2 dark |
| --- | --- | --- | --- |
| `slds-theme_success` | green bg, white text | pale mint bg, dark green text | teal bg, white text |
| `slds-theme_warning` | orange bg, white text | **no bg**, orange text | rust bg, white text |
| `slds-theme_error` | red bg, white text | pale pink bg, red text | magenta bg, white text |
| `slds-theme_info` | grey bg, white text | pale blue bg, blue text | **blue** bg, white text |
| `slds-theme_inverse` | dark navy, white text | dark navy, white text | **pale blue, dark text** |

**What survives every theme is the MEANING, not the colour.** Success always
reads as positive, error as bad, warning as caution. The hue, the lightness, and
whether there is a background at all are the platform's business.

Two consequences for the rule editor:

1. **Offer semantic names, never colour names.** "Success", not "Green" — a
   control labelled Green that renders pale mint, or teal, is simply wrong. The
   preview in Grid Studio then has to render live rather than draw a swatch.
2. **`slds-theme_inverse` inverts.** It is dark-on-light in SLDS 1 and light
   themes and light-on-dark in dark mode, so it cannot be labelled "Dark". It is
   "Inverse" — the opposite of whatever the page currently is.

### This is the argument FOR Option A, not a cost of it

Option B would hard-code Salesforce's six hexes. `#2E844A` green is a fixed
colour: it would stay exactly that in dark mode, on a dark background, looking
broken — and it could never become pale mint under SLDS 2 light.

Going through SLDS classes means **the platform re-themes our conditional
formatting for free**, including dark mode. That reverses the earlier framing in
this README: Option B is not an upgrade waiting to happen, it is a trade of
theme adaptability for two extra hues. Worth it only if blue and purple turn out
to matter more than dark mode does.

(Salesforce's own conditional formatting stores fixed hex, so it presumably has
exactly this problem. Not our concern, but it says the fixed-palette approach is
not obviously the considered one.)

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

### 6. The icon follows the text colour — ANSWERED

Readable in the SLDS 2 light capture, where text colours are strong against a
pale background: the icon on `slds-text-color_success` is green, on
`slds-text-color_error` is red, and on the themed rows it matches whatever the
theme set the text to.

So there is **no separate icon colour**, and no control for one. The icon takes
the cell's colour, which is also the honest behaviour — an icon in a different
colour from its own text would be a strange thing to offer.

### 7. LWR Experience site — a fourth rendering

Every class still resolves; nothing is dead in a site. But it is different again,
and one difference matters:

**`slds-theme_success` and `slds-theme_warning` render with BLACK text**, where
SLDS 1 gave them white. The branding set moves the background and the foreground
independently. Here the result is legible — black on light green reads fine —
but nothing guarantees that, and we cannot inspect a customer's branding set.

**`slds-theme_info` is effectively invisible in LWR** — a near-white grey, barely
distinguishable from an unformatted cell. In SLDS 1 it was solid mid-grey with
white text. It is too unreliable to offer.

`slds-text-color_inverse` is blank here too: invisible on three of four surfaces.

`fgridProbeCustom` is unstyled on all four surfaces. The shadow-root boundary is
not surface-specific.

## ROUND 2 — 2026-09-19. The hover diagnosis was right, and it changes the plan

### 1. It is hover, and a hover rule fixes it

`slds-theme_success` and `slds-theme_error` carried a hover rule from the global
stylesheet; the other themed rows deliberately did not. Under the cursor the
fixed rows hold and the unfixed ones break — `slds-theme_inverse` keeps its
white text while the row hover repaints grey underneath it, exactly as
predicted. The earlier "branding set makes it illegible" reading was wrong: the
palette was never the problem, the hover state was.

### 2. A GLOBAL stylesheet reaches inside — on a record page AND in LWR

`fgridProbeCustom` (component CSS) is unstyled. `fgridProbeGlobal` (static
resource via `loadStyle`) renders purple. **On both surfaces.**

This is the finding that unblocks everything. Round 1 concluded "our stylesheet
cannot reach inside", which was true of component CSS and false of a global one.
The component Flow Grid replaces has always done it this way.

**So Option B is not needed.** We can define our own classes, with our own
hover behaviour and our own colours, and they work everywhere.

### 3. SLDS 2 hooks work, and give us blue and a guaranteed pairing

All five hook rows render legibly on both surfaces, including under the cursor.
The `-container-` / `-on-` pairing holds, which is the contrast guarantee
`slds-theme_*` never gave us.

The values differ by surface — pastel under SLDS 2 light, saturated in LWR —
which is correct behaviour and the reason Grid Studio's preview must render live
rather than draw a fixed swatch.

**One token is wrong.** `--slds-g-color-disabled-container-1` with
`--slds-g-color-on-disabled-1` renders as washed-out grey text on washed-out
grey in LWR, close to illegible. That is the tokens working as designed — they
are for disabled UI, which is *supposed* to recede. Use a surface pair for a
neutral instead.

### 4. The icon custom property did not reach

`--slds-c-icon-color-foreground` set on our host did not turn the datatable's
icons purple. Either it does not inherit across that boundary or the datatable's
icon does not consume that hook. Moot — the icon follows the cell's text colour,
and the global stylesheet can set that.

## Conclusion — SUPERSEDED BY ROUND 2

The palette below was derived from `slds-theme_*` before round 2 showed we do
not have to use those classes at all. Kept for the record; see
**The design, after round 2** at the end.

## Round 1's palette (superseded)

Measured across Flow debug, SLDS 1, SLDS 2 light, SLDS 2 dark and LWR:

| Offer | Class | Why |
| --- | --- | --- |
| Success | `slds-theme_success` | reads positive on all five |
| Warning | `slds-theme_warning` | reads caution on all five; no background under SLDS 2 light |
| Error | `slds-theme_error` | reads bad on all five |
| Inverse | `slds-theme_inverse` | the only consistently HIGH-CONTRAST option |
| Subtle | `slds-theme_shade` | light grey everywhere; the quiet option |

Dropped: `slds-theme_info` (invisible in LWR), `slds-theme_default` and
`slds-theme_alt-inverse` (duplicates of None and Inverse), `slds-badge_success`
and `slds-box_xx-small` (no effect anywhere).

Text-only: Success, Error, Muted (`_weak`), Default. **Exclude `_inverse`.**

### The one thing to tell admins

Colour follows the running theme and, in a site, the branding set. Flow Grid
picks the meaning; the platform picks the pixels. That is why the control says
"Success" and not "Green", and why Grid Studio's preview must render live —
a fixed swatch in the editor would be lying on four surfaces out of five.

## The design, after round 2

**Do not use `slds-theme_*`.** It is an SLDS 1 construct, it renders five
different ways across the surfaces we tested, it bundles a text colour we cannot
separate, and it breaks on hover.

Instead: Flow Grid ships its own classes in a static resource, loaded with
`loadStyle`, coloured from SLDS 2 global styling hooks with SLDS 1 fallbacks,
each with a matching hover rule.

```css
/* Scoped under our own tag, so nothing else on the page is touched. */
c-fgrid_flow-grid .fgridFormat_error,
c-fgrid_flow-grid .slds-table tbody tr:hover > td .fgridFormat_error {
    background-color: var(--slds-g-color-error-container-1, #fddde3);
    color: var(--slds-g-color-on-error-1, #b60554);
}
```

What that buys, all of it measured rather than assumed:

| | |
| --- | --- |
| Contrast | guaranteed by the `-container-` / `-on-` pairing |
| Dark mode | each hook carries its own light and dark value |
| Hover | ours to control, which is the bug that started this |
| Palette | Error, Warning, Success, Accent (blue), Neutral — blue was unreachable through `slds-theme_*` |
| Surfaces | verified on a record page and in an LWR site |

Still to settle: the neutral. `disabled-container` is too washed out in LWR.
Try `--slds-g-color-surface-container-2` paired with
`--slds-g-color-on-surface-1`.

### This reverses an earlier decision, deliberately

Flow Grid STATUS records `loadStyle` as rejected, on the grounds that "a
distributed package should not restyle a customer's whole site". That objection
was raised about a toast `z-index` fix that needed a rule with `!important`
against platform chrome. This is different in kind: every selector is scoped
under `c-fgrid_flow-grid`, so nothing outside the component can be affected.
The objection stands for the toast case and does not apply here.
