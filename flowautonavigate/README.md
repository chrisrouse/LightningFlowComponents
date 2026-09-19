# Flow Auto Navigate

A Flow screen component that advances the screen on its own after a configured
duration. Use it for idle timeouts, timed confirmation screens, and any screen
that should not wait on a click forever.

## Upgrading — breaking change

The old `maxTime` property (an `H:M:S:MS` string) **has been removed**. Duration
is now entered as three separate whole-number properties, summed:
`timeoutHours`, `timeoutMinutes`, `timeoutSeconds` (all Integer).

**A flow configured with the old property will not auto-advance after upgrade.**
It does not fail or navigate unexpectedly — the component simply stays inert and
the user navigates by hand. Open each screen that uses it and re-enter the
duration.

## Configuration

Properties are edited through a custom property editor
(`c-flow-auto-navigate-editor`) rather than Flow Builder's default panel: the
duration is three boxes on one row with a live plain-English summary
("Advances after 1 minute 5 seconds."), and the panel refuses to save a duration
of zero.

### Timing

| Property    | Type    | Notes                                                              |
| ----------- | ------- | ------------------------------------------------------------------ |
| Hours       | Integer | Summed with the two below. Leave blank for none.                   |
| Minutes     | Integer |                                                                    |
| Seconds     | Integer |                                                                    |
| On Timeout  | String  | `Next` (default), `Back`, `Finish`, `Pause`, `Stay`. See below.    |
| Pause Timer | Boolean | Optional. Bind a Boolean **resource**; the timer holds while true. |

`Next` falls back to finishing the flow on a last screen — that was the original
behavior. An explicitly chosen `Back`, `Finish` or `Pause` does **not** fall
back; if the flow does not offer it, nothing happens. Quietly doing something
other than what you asked for is worse than doing nothing.

`Pause Timer` is resource-only on purpose: a literal `true` would hold the timer
forever. Bind a checkbox or formula on the same screen and the timer stops and
starts as it changes, keeping the time already served rather than restarting.

### Display

| Property                | Type    | Notes                                                         |
| ----------------------- | ------- | ------------------------------------------------------------- |
| Show Timer              | Boolean | Off by default; the component advances silently.              |
| Timer Direction         | String  | `Down` (default) or `Up`. Needs Show Timer.                   |
| Show Timer Reset        | Boolean | Offers a Reset button. Needs Show Timer. See Accessibility.   |
| Message to Users        | String  | Rich text below the timer. Accepts a Flow resource.           |
| Show Progress Bar       | Boolean | Depletes counting down, fills counting up.                    |
| Show Loader             | Boolean | A spinner. Suggests loading; prefer the progress bar.         |
| Hide When Time Runs Out | Boolean | Hides the component on expiry but keeps its space. See below. |
| Refresh the Page        | Boolean | Refreshes the surrounding page on expiry. See below.          |

### Time running out

The threshold uses the same three-box Hours / Minutes / Seconds control as
Advance After, summed the same way, so a long screen can warn minutes ahead
rather than seconds. Everything else here is inert until it sums above zero,
and it must be shorter than the total duration.

| Property                       | Type    | Notes                                                             |
| ------------------------------ | ------- | ----------------------------------------------------------------- |
| Warning Hours                  | Integer | Summed with the two below. Blank for no warning phase.            |
| Warning Minutes                | Integer |                                                                   |
| Warning Seconds                | Integer |                                                                   |
| Warning Style                  | String  | `No Change`, `Color`, `Color and Weight`, `Pulse`, `Tinted Pill`. |
| Warning Message                | String  | Replaces Message to Users during the warning.                     |
| Show Warning Icon              | Boolean | A warning icon beside the timer.                                  |
| Tint Progress Bar When Warning | Boolean | Independent of Warning Style.                                     |

Style, message, icon and bar tint are separate so they compose freely. Color on
its own fails WCAG 1.4.1 — pair `Color` with a Warning Message or the icon.

`design/warning-threshold-preview.html` is a standalone page comparing the
treatments; open it in a browser.

## Outputs

| Output         | Meaning                                                  |
| -------------- | -------------------------------------------------------- |
| `triggered`    | This component advanced the screen itself.               |
| `timerExpired` | The timer reached zero, whether or not the screen moved. |

Both are reported as `false` when the screen loads, so a Decision reads an
explicit value rather than relying on an unset Boolean being falsy.

### Routing after the screen

`triggered` distinguishes a timeout from the user clicking Next. Timer fired →
true. User advanced first → false. Put a Decision on it after the screen.

### Reacting on the same screen

With any navigating action, both outputs flip and the screen tears down in the
same instant, so nothing keyed off them ever paints.

Set **On Timeout** to **Stay on This Screen** and the two diverge:
`timerExpired` goes true, `triggered` stays false, and the screen stands. That
is the combination that lets a Message component (or anything else on the
screen) render on expiry, with the user clicking Next themselves.

### Two ways to hide the timer when it expires

Both work. Pick on whether you want the space back.

| Approach                                    | Result                                                                                                     |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Flow visibility condition on `timerExpired` | The component is removed. Whatever is below it moves up to close the gap.                                  |
| **Hide When Time Runs Out**                 | The component is hidden with `visibility: hidden`. It keeps its footprint, so nothing on the screen moves. |

The visibility condition is an ordinary Flow rule on this component's own
output — the component reports `timerExpired` as `false` when the screen loads
and `true` on expiry, so a condition on it resolves normally. Get the operator
and value right and it behaves like any other component visibility rule.

Either way, hiding is visual only. The timer keeps running and still advances
the screen; use `Pause Timer` if you want the clock held as well.

### Refreshing the page

**Refresh the Page** dispatches a `RefreshEvent` from `lightning/refresh`
(RefreshView API) when the timer expires, before any navigation.

That module is [documented](https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/lightning-refresh.html)
as the replacement for Aura's `force:refreshView`, and as supported in
Lightning Experience, Experience Builder Sites, the Salesforce mobile app,
Lightning Out and standalone apps. One dispatch therefore covers console tabs,
ordinary record pages and Experience Cloud.

This is deliberately **not** the `lightning/platformWorkspaceApi` `refreshTab()`
approach used by `ers_AutoNavigate_Refresh`. That one is console-only — it
returns early when `IsConsoleNavigation` is false, so it does nothing on a
standard record page or in a site — and it reloads the whole tab, which
restarts any flow running on the refreshed page. `RefreshEvent` refreshes
registered components in place, so a flow survives it.

Pair it with **On Timeout = Stay on This Screen** and a Reset to poll: refresh
on an interval while the user stays put.

No container setup is needed. The guide is explicit: "If you're adding a
component to an active page, you don't need to create a container to receive
`RefreshEvent`. Add a container only if you want to determine the scope of your
refresh." `RefreshEvent` bubbles to the nearest registered ancestor, which on a
standard page is the platform's own container.

What actually refreshes is narrower than "the page", and worth knowing before
you rely on it:

- **Only components that registered a refresh handler participate.** A custom
  LWC that never called `registerRefreshHandler()` will not refresh, and
  "components aren't responsible for refreshing their descendants".
- **Aura base components don't support RefreshView API** at all, per the
  guide's own limitations.
- Lightning Data Service participates, but a component still has to initiate
  its own refresh — `refreshApex()`, `refreshGraphQL()` or
  `notifyRecordUpdateAvailable()`.

So this refreshes a well-behaved modern page well, and an older Aura-heavy one
only partially. That is a property of what is on the page, not of this
component.

#### Experience Cloud needs Record to Refresh

`RefreshEvent` alone is **not** enough on an LWR site. Tested with a standard
Account page and a standard Record Detail, the component kept showing the
previous value: the event fires, but nothing on that page registered a refresh
handler, so nothing acts on it.

Set **Record to Refresh** to the flow's `recordId` and the component also calls
`notifyRecordUpdateAvailable()`, which does not use the refresh tree at all.
Per its reference it "considers the record data wired by all instantiated
components" and re-emits to every wire using that id, which reaches an
LDS-backed Record Detail directly.

Harmless in Lightning Experience — set it anywhere you want the record itself
guaranteed fresh, not just the view.

Verified: **console tab** and **non-console record page** in Lightning
Experience, with `Refresh the Page` alone.

## Behavior notes

- **Timing is measured against a wall clock**, not by counting interval
  callbacks. This matters most in a background tab, where browsers clamp timers
  to one second or slower; the previous version's 65-second timer could take
  many minutes there. A throttled tab now fires late and advances on its next
  tick.
- **An unconfigured duration leaves the component inert.** It will not guess an
  interval and advance on it.
- **The screen advances once**, and the timer display updates once a second even
  though the deadline is checked four times a second.

## Accessibility

- WCAG 2.2 SC 2.2.1 (Timing Adjustable) applies to any screen that advances on a
  timer. **Turn on Show Timer Reset** unless the time limit is essential.
- The countdown is a `role="timer"` region with `aria-live="off"`. A value
  announced every second would talk over everything else a screen reader is
  saying.
- Instead, the component announces **at 60, 30 and 10 seconds remaining**, plus
  once at the start ("This screen advances in 1 minute 5 seconds."). Milestones
  longer than the configured duration are skipped. These announcements are
  **not** conditional on Show Timer — a screen that advances silently still
  moves under a screen reader user.
- The `Pulse` warning style honors `prefers-reduced-motion`.

## Development

```bash
npm run verify   # prettier, eslint, jest
```

The editor is built on the [Flow Config Editor Kit](../vendor/flow-config-editor-kit),
which must be deployed to the org before this component's property panel will
render.
