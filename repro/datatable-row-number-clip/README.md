# Repro: `lightning-datatable` clips its own row numbers

Standalone SFDX project. One LWC, no Apex, no CSS, no Flow Grid code. The markup,
the columns and `generateData` are copied **verbatim from Salesforce's own
`lightning-datatable` documentation**, which is the point: if this clips, nothing
in our code is involved.

## Symptom

**The row number column is sized for one digit FEWER than its largest row number
needs.** The width tracks the row count and then comes up one digit short.

Measured at two scales, in this repro and in a separate component, on the same LWR
site:

| Rows | Largest number | Digits that fit | Result |
| --- | --- | --- | --- |
| 10 | `10` (2 digits) | 1 | second digit clipped — `10` reads as `1(` |
| 100 | `100` (3 digits) | 2 | third digit clipped |

So a table under 100 rows clips at 10, and a table under 1000 rows clips at 100.
Rows 1–9 of a ten-row table are fine, which is what makes this easy to miss in
development and certain to appear in production.

The component is exposed to `lightningCommunity__Default`, `lightning__FlowScreen`,
`lightning__AppPage` and `lightning__HomePage` so the identical bundle can be
dropped in each surface for comparison. Use **Increase row offset** to walk the
digit count up without loading more data.

**No API-level workaround exists.** The allocated width tracks
`rowNumberOffset + data.length`, so a consumer cannot inflate the allocation
without also changing the numbers being displayed.

## Related: the column cannot be turned off on an editable table

Separate from the clipping, and documented. From the `lightning-datatable` docs
under Handle Errors:

> When there's an editable column, `lightning-datatable` sets the
> `show-row-number-column` attribute to true to show the row errors in the number
> column. You can't override this setting.

So any table with an editable column gets this column, and therefore this clipping,
whether it asked for row numbers or not. That widens the blast radius: it is not
only tables that opt in.

This repro has no editable columns, so its column appears only because variant C
asks for it.

## Cause

Three rules in `salesforce-lightning-design-system.min.css`, plus one inline style
the datatable writes itself.

```css
.slds-table tbody tr                   { counter-increment: row-number }
.slds-table .slds-row-number:after     { content: counter(row-number) }
.slds-table_fixed-layout .slds-cell-shrink { width: 3rem }
```

The number **is not in the DOM**. It is a CSS counter rendered into an `::after`
pseudo-element, and the cell's span is empty:

```html
<div class="slds-truncate">
  <span class="slds-row-number slds-text-body_small slds-text-color_weak"
        style="padding-left: 20px;"></span>
</div>
```

So:

1. The column is a `.slds-cell-shrink` at a flat `width: 3rem` (48px) under
   `table-layout: fixed`. It cannot size to its content because it has none — the
   digits are generated content.
2. The datatable writes an inline `padding-left: 20px` on the span, consuming
   roughly 40% of that 48px. This looks like tree-grid indentation logic applied to
   a plain datatable's row-number cell; there is no indentation to express here.
3. The remainder is wrapped in `div.slds-truncate` (`overflow: hidden`,
   `white-space: nowrap`), which silently clips the overflow rather than letting it
   spill visibly.

Net usable width is about one digit.

## Why it cannot be fixed by a consumer

The documentation rules out every lever before any of them is tried. From
**Manage Column Width Resize**:

> Widths for the following columns are fixed and cannot be changed.
> - **Row Number column**
> - Selection (checkbox) column
> - Action column

And from **Text Wrapping and Clipping**:

> Text wrapping and clipping are not supported for row number columns and the
> following data types: action, boolean, button, button-icon, date-local

So `fixedWidth` and `initialWidth` do not apply (the column is not in the
consumer's `columns` array), `column-widths-mode="auto"` cannot help (this
column's width is exempt from change), `min-column-width` and `max-column-width`
bound only the data columns, and `wrapText` / clip text are unsupported here.

`row-number-offset` is listed as a resize trigger in both width modes, but it
resizes the OTHER columns; it does not widen this one.

That leaves CSS, and CSS is closed too:

- **No stylesheet can select it.** The span lives inside
  `lightning-primitive-cell-factory`'s own shadow root — a component nested inside
  the datatable. A `lightning-datatable` subclass's stylesheet reaches the
  datatable's template, not a grandchild's. Confirmed by probing: a document query
  for `.slds-row-number` returns nothing with a table on screen.
- **No styling hook covers it.** The only `row-number` declarations in the entire
  1MB stylesheet are the two counter rules above. The 20px is an inline style, which
  only `!important` beats, and there is no selector that reaches it to apply one.
  CSS custom properties do cross the boundary, but none governs `padding` or
  `width` here.

## Workaround

**There isn't one.** A row number column of real text was built and did render
correctly at every digit count — but it cannot replace this one, because an
editable table gets the platform's column forced on regardless (see the section
above), leaving two number columns instead of a fixed one. It was reverted.

Removing editability from every column does hide the column, and is the only thing
that works. That is not a workaround so much as giving up a feature.

## Deploy

```
sf project deploy start -d force-app -o <alias>
```

Then add **Repro: Datatable Row Number Clipping** to an LWR site page, and to a
Lightning app or home page for the comparison.
