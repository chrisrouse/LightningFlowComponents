# Record List LWR — plan and constraints

A replacement for the standard **Record List** component in LWR Experience sites,
adding the three features it lacks: inline editing, record selection, and actions.

Target org: **Preview Org** (`chris-b4pw@force.com`), the repo default.

---

## 1. Decisions

| Question | Decision |
|---|---|
| Package location | Own package dir `recordlistlwr/force-app`, independent of flowgrid |
| Palette label | **Record List LWR**. Not "Record List" — that is the standard component's exact label, and two identical palette entries are unusable |
| Target | `lightningCommunity__Page` **and** `lightningCommunity__Default` — see §2.7 |
| Columns | From the selected list view, same as the standard component |
| Inline edit | Draft cells + Save/Cancel bar (datatable's native model) |
| Actions | Configured in the property panel, not read from the list view — see §2.1 |
| Card view | Read-only. Inline edit and selection are table-only |
| Styling panel | Deferred. SLDS defaults first, property parity later |
| Audience | Authenticated site users. Guests would realistically never see the table — see §3 |

## 2. Platform constraints found before building

Sources are official Salesforce docs unless noted.

### 2.1 There is no list view actions API

The [API Modules index](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/api.html)
lists the whole UI API family — Apps, Layout, Lists, Record, Object Info, Related List,
GraphQL — and there is no actions module. The `getActions` adapter that search engines
surface is CRM Analytics and unrelated. The REST `/ui-api/actions/list-view/` resource
has no client binding.

List view buttons also live in the object's **search layout**, not in `ListView`
metadata, so an Apex Metadata API detour would not be clean either.

**Consequence:** actions are configured in the property panel. This is a deliberate
divergence from the standard component, and it buys a capability the standard one
lacks — a mass action can invoke a Flow.

### 2.2 `lightning/uiListsApi` is supported here

"For Use In: Lightning Experience, **Experience Builder Sites**, Salesforce Mobile App."
Adapters we need:

- `getListInfosByObjectName` — the header's list view picker dropdown
- `getListInfoByName` — `displayColumns`, plus the view's sort and filter
- `getListRecordsByName` — the records

### 2.3 `getListRecordsByName` limits

- **`pageToken` max offset is 2000.** Paging stops there whatever `pageSize` is. The
  standard component shares this ceiling, so it is parity, not a regression.
- **`sortBy` takes one field per request.** No multi-column sort.
- `pageSize` is 1–2000, default 50.
- `searchTerm` supports wildcards — this is the "Search this list…" box.
- Every reactive `$` param needs an initial class value or the wire never fires.
  `pageToken = null` specifically.
- Only UI API supported objects work. Custom objects are fine.

### 2.4 LWR base component limitations

From [Base Lightning Component Limitations in LWR Sites](https://developer.salesforce.com/docs/atlas.en-us.exp_cloud_lwr.meta/exp_cloud_lwr/get_started_comp_limitations.htm):

- `lightning-input-field` **has no lookup search in LWR on desktop** and is unsupported
  on mobile. Avoided: lookup editing uses `lightning-record-picker` instead.
- `platform-show-toast-event` is unsupported — use `toast-container`.
- `lightning-datatable` is **not** on the unsupported list.
- The page says "Using panels or modals" is unsupported. **Our own testing contradicts
  this**: `lightning/modal` was confirmed rendering in an LWR site in Sept 2026 (see the
  `lwr-modal-close-button-branding` note — the close X took the branding set's tertiary
  button background). Treat modals as working-but-undocumented, and expect that
  branding caveat.

### 2.5 Inline editing forces a row number column

`lightning-datatable` sets `show-row-number-column` to true whenever **any** column is
editable, because row error icons are drawn in that column, and the docs state it
cannot be overridden. Confirmed by experiment in the org on 2026-09-10; five
workarounds were tried and all failed. See the `datatable-row-numbers-forced-by-editable`
note before attempting to defeat it — don't.

The standard Record List has no row number column, so **enabling inline editing
visibly breaks visual parity**. Mitigation: make inline editing an opt-in property.
With it off, no column is editable, no row numbers appear, and the table matches the
standard component exactly. With it on, the admin accepts row numbers — say so in the
property's help text rather than pretending it is controllable.

Related known defect: the forced column is sized one digit short of its largest row
number, so a ten-row grid clips `10`. Repro at `repro/datatable-row-number-clip/`.

### 2.6 `lightning-record-picker` in LWR is unverified

Not on the unsupported list, but not confirmed either. Needs an in-org check before
lookup inline editing is promised.

### 2.6b The records wire returns only the fields you ask for

`getListRecordsByName` via LDS returns records whose `fields` map holds **only** what
the config requested. The list view's display columns are NOT implied. Omitting
`optionalFields` yields the right number of records carrying nothing but `id`, which
renders as N blank hairline rows with no error anywhere.

Names must be object-qualified, dots preserved: `["Account.Name",
"Account.Owner.Alias"]`. Use `optionalFields`, not `fields`, so a field the running
user cannot see costs one column rather than erroring the whole list.

The **REST** resource returns display columns automatically, so a fixture captured from
REST passes every unit test while the wire fails in the browser — which is exactly what
happened on 2026-09-16 (6 green tests, blank rows in the site). The field list is
derived from `displayColumns`, so the records wire deliberately waits for the list
metadata.

Unverified and next in line: the same doc's example passes `sortBy` as an **array** of
qualified names (`["Account.Name"]`) while the parameter table says String with a `-`
prefix. The component currently sends a string. Sorting has never been exercised.

### 2.6c Diagnostics are built in, not bolted on

`showDiagnostics` is a shipped property, default off, rendering the live data state
below the table, plus a `debugMarker` constant so a stale bundle cannot be blamed
without proof. Standing instruction from Chris (2026-09-16): read the org's actual
state rather than inferring it, and never combine a speculative fix with a diagnostic
in one deploy.

### 2.7 A placeable Experience Cloud component needs two targets

`lightningCommunity__Default` exposes editable properties. It does **not** put the
component in the Components panel — that is `lightningCommunity__Page`, "to create a
drag-and-drop component that appears in the Components panel". `targetConfigs` still
hangs off `Default`; `lightningCommunity__Page` "doesn't support component properties".

This cost a round trip on 2026-09-16: with only `Default`, the deploy succeeded, a
dry-run validated, and the bundle was queryable in the org — it was just missing from
the palette, with nothing anywhere reporting why. If a deployed component doesn't
appear, check the target list first.

## 3. Guest users — not a design target

Nothing in the docs states whether `lightning/uiListsApi` works for guest /
unauthenticated users, in either direction. It does not matter much: in practice a
guest would never be shown this table, so **authenticated site users are the design
target** and guest behaviour is not a requirement.

Do not spend effort hardening the guest path. If a guest page ever needs it, the thing
to check first is whether the list adapters provision at all for the guest user, and
the object will need `sharingGuestRules` regardless.

## 3a. Development loop — which preview for which phase

Live Preview (formerly Local Dev; rebranded Spring '26). `lightning-dev` 5.1.4 is
installed and both commands are **[Beta]** at that version. Default org is already
`chris-b4pw@force.com`.

**Decided:** build against Single Component Live Preview now; bring in Experience Sites
Live Preview once there is something built and deployed to look at.

| Tool | Command | Use for |
|---|---|---|
| Single Component | `sf lightning dev component -n recordListLWR` | Phases 1–3. Fastest loop, and the one to use now |
| Experience Sites | `sf lightning dev site --name "<site>"` | LWR-specific behaviour, once deployed |
| VS Code panel | `SFDX: Open in Lightning Preview` | Same as Single Component, in-IDE. `salesforcedx-vscode-ui-preview` 1.5.0 is installed |

**Single Component Live Preview is the right default for the data and table work.**
Components in isolation "can access platform modules such as public Lightning Data
Service wire adapters, `@salesforce` scoped modules, and Apex controllers" — so the
`uiListsApi` wires resolve against real org data.

What isolation mode does **not** give us:

- **No property panel.** There is no design-time config UI, so `@api` properties sit at
  their class defaults. During phases 1–3, hardcode `objectApiName` /
  `listViewApiName` defaults in the JS and change them in code to test another list view.
- **No LWR runtime context** — no site branding set, no Experience Builder. Every
  LWR-specific risk in §2.4–2.6 (record-picker behaviour, modal branding, toast
  container) is invisible here and must be checked with `sf lightning dev site` or a
  real deploy.
- **Property editors can't be tested in either preview.** Experience Builder property
  panels and `LightningTypeBundle` editors need a real deploy and the actual builder, so
  phases 4 and 6 are deploy-and-check regardless.

Reload rules that will bite:

- Auto-reloads: HTML edits, CSS edits, new component references, event-handler logic.
- **Does not** auto-reload: anything wire-adapter related (new `@wire`, config changes),
  new `@api` members, new `@salesforce` imports, and **`.js-meta.xml` edits**. In
  isolation a browser refresh is enough; for a site preview it takes a deploy plus a
  server restart.
- Since most of phase 1 is wire work, expect to refresh by hand constantly.

`sf lightning dev site` specifics: desktop only, and **the site must be published
first**. It caches the site locally — pass `--get-latest` after Experience Builder
changes or you will debug a stale site. Don't use `--ssr` (unsupported from Spring '26).
Undocumented but present in 5.1.4: a **`--guest`** flag that previews as a guest user,
which is the cheap way to answer §3 if guests ever come back into scope.

## 4. Build order

1. ~~**Read-only table.**~~ **Done. Deployed to Preview Org 2026-09-16** (deploy
   `0AfWs00001cPYWLKA4`), not yet exercised in a browser. List view picker,
   columns from `displayColumns`, records, header status line, search, sort,
   Previous/Next pagination, plus loading/empty/error states. 31 Jest tests.
   Deliberately left out:
   - **Record links.** The standard component links the Name and reference columns.
     Deferred because a correct site-relative URL needs `NavigationMixin` against real
     LWR routing, which Single Component Live Preview cannot exercise — it would be
     written blind and verified nowhere. Do it when the site preview comes in.
   - **Row count is the page count**, not the list total; UI API exposes no total. See
     the comment on `statusLine`.
1b. **Property panel pickers** — Object picker DONE 2026-09-16, List View picker next.

   **Object picker: done.** `recordListObjectEditor`, a `lightning__PropertyEditor`
   attached via `editor="c/recordListObjectEditor"` on the property tag. Inline
   type-ahead filtering on label and API name, 100 shown at a time out of ~678.

   What the measurements settled, none of it documented:
   - **LDS wire adapters DO work in a property editor** (`getObjectInfo` resolved).
   - **Apex DOES work in a property editor**, despite `@salesforce/apex` being absent
     from the documented supported-modules list. That list under-reports — LDS is
     missing from it too. The editor keeps a text-input fallback anyway.
   - **REST is not reachable**: `/services/data/v62.0/sobjects/` returns 404 from an
     editor, whose origin does not serve it.
   - **No `ui*Api` adapter enumerates objects** — all of them need names up front.
     Hence Apex (`RecordListObjectService`, 97% coverage, perm set
     `RecordList_ObjectService_Execute`). Same choice the Flow Config Editor Kit made.
   - **Filter object kinds with `describe.getAssociateEntityType()`, not name
     suffixes.** Only CUSTOM objects get `__Feed`/`__History`; standard ones are
     `CreditMemoFeed`, so a suffix filter shipped a picker full of them.
   - **The Flow kit's pickers are not reusable here**: popover-anchored, and the
     editor guidelines forbid flyouts, popouts and absolute positioning. The list
     expands in flow instead.

   **List View picker: built, blocked on one manual step.** `recordListSourceEditor`
   holds Object and List View together and is deployed; the parent's property change
   is not (see below). List views come from `getListInfosByObjectName`. Changing the
   object clears the list view, since a list view API name belongs to one object.

   **LightningTypeBundle does not deploy — do not retry it.** The documented route for
   a multi-property editor is a bundle with a `"$"` top-level override in
   `editor.json`. Every attempt failed with "Not available for deploy for this API
   version" at API 62, 63, 64, 66, 67 and 68, including `schema.json` alone, even
   though `sf org list metadata-types` reports `LightningTypeBundle` as available. The
   message names the API version but is not version-dependent. Two details worth
   knowing before concluding the same: the directory is **`lightningTypes`**, not
   `lightningTypeBundles` as the CPE rules file says, and `schema.json` is the bundle's
   meta file per `metadataRegistry.json`.

   **What is used instead:** `listSource`, a plain `type="String"` property carrying
   JSON, with `editor="c/recordListSourceEditor"` — the same mechanism the object
   picker already proved. The parent parses the string; malformed JSON yields the
   "choose an object and a list view" prompt rather than an exception.

   **Done.** The panel is now `objectApiName` (Object, type-ahead) and `listView`
   (List View, dependent picklist). Verified in the site 2026-09-16.

   **Property tags cannot be REMOVED while the component is on a page** — "found in 1
   Development Instance(s)". Adding is fine. That shaped the sequence: `listView` was
   added beside the legacy `listViewApiName` so the picklist could be verified without
   disturbing a working page, then the component was removed from the page and the
   legacy property deleted in a second deploy. Expect the same two-step for any future
   property removal, and note it costs the admin their configuration.

   **How the two editors share the object — `c/recordListEditorState`.** A property
   editor sees only its own value, and with the bundle undeployable and property
   removal blocked, the Object and List View editors cannot live in one property. They
   therefore share a module-scoped pub/sub store: ES modules are singletons per
   context, and both editors run in the same property panel. The Object editor
   publishes on selection AND on value-set, so an already-configured panel populates
   its list views when opened.

   This is a workaround, and its weakness is that the coupling is invisible from
   either component's public API. If the component is ever off every page — making the
   legacy tags removable — collapse both values into one String property with a single
   editor and delete the store.

   Orphan left in the org: `recordListSourceEditor`, the combined editor built for the
   bundle approach. Removed from source, still deployed; harmless, needs a destructive
   delete to clear.

   Property editors are not testable in either Live Preview — they need a real deploy.

1c. Superseded notes from the original picker plan:
   - **Object** becomes a searchable picklist of objects, not a text box. Source:
     `getObjectInfos` or the object list the standard component uses; must be
     type-ahead, since an org this size has hundreds.
   - **Record List** is renamed **List View**, and becomes a picklist of the list
     views *for the chosen object* — so it depends on the Object value and repopulates
     when it changes.
   - Needs a Custom Property Editor: `datasource` on a `<property>` is a static
     comma-separated list, which cannot be org-driven or dependent. So this is a
     `lightning__PropertyEditor` component per §2.7 and the CPE rules, and a
     dependent pair means the two properties are edited together — likely one
     `LightningTypeBundle` holding both, so the editor can see the object when
     rendering the list view choices.
   - `getListInfosByObjectName` already supplies the list views; the runtime picker
     in the header uses it today.
   - **Cannot be tested in either Live Preview** — property editors need a real
     deploy and the actual Experience Builder panel.

2. **Selection.** Datatable checkboxes, selection surfaced to the header.
3. **Inline editing.** Draft cells and the Save bar. Copy the editable cell types from
   `fgrid_customDatatable` (picklist, multi-picklist, lookup, long text, time) — the
   base datatable lacks them and would silently downgrade a picklist to a free-text box.
   Saves go through `updateRecord`, batched, errors mapped back onto rows.
4. **Actions.** Header buttons, mass actions on selection, per-row action menu. Flow,
   URL and built-in targets.
5. **Card view**, read-only.
6. **Styling property panel**, to parity with the standard component.

## 4a. Tooling notes

- **`lightning/uiListsApi` is under-stubbed by sfdx-lwc-jest 7.9.0** — it exports 2 of
  the module's 10 adapters, missing `getListRecordsByName` and
  `getListInfosByObjectName`. A local stub at
  `recordlistlwr/test/jest-mocks/lightning/uiListsApi.js` supplies all ten, wired
  through `moduleNameMapper` in `jest.config.js`, following the precedent set for
  `lightning/modal`. The gap says nothing about platform support.
- **`@lwc/lwc/no-unexpected-wire-adapter-usages` is off for `__tests__`** — calling
  `adapter.emit(data)` is the documented test API and the rule cannot tell the
  difference.
- **Two IDE diagnostics on this package are false positives.** The `.js-meta.xml`
  reports an XSD error (the bundled schema is older than the file), and the component
  test reports LWC1702 on the `c/recordListLWR` import. A dry-run deploy to the org
  validates the metadata, and Jest resolves the import — ignore both.
- **`npm run verify` currently fails** on two pre-existing Prettier warnings in
  `fgrid_flowGrid`, unrelated to this package. Run `lint` and `test:unit` directly
  until those are fixed.

## 5. Reuse from flowgrid

`fgrid_customDatatable` already solves the editable-cell-type problem, including the
undocumented `data-inputable="true"` mechanism a custom edit template needs to report
its value back. Copy it into this package rather than importing — this component is
meant to stand alone. Read that file's header comment before touching the copy.
