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

| Property                | Type    | Notes                                                        |
| ----------------------- | ------- | ------------------------------------------------------------ |
| Show Timer              | Boolean | Off by default; the component advances silently.             |
| Timer Direction         | String  | `Down` (default) or `Up`. Needs Show Timer.                  |
| Show Timer Reset        | Boolean | Offers a Reset button. Needs Show Timer. See Accessibility.  |
| Message to Users        | String  | Rich text below the timer. Accepts a Flow resource.          |
| Show Progress Bar       | Boolean | Depletes counting down, fills counting up.                   |
| Show Loader             | Boolean | A spinner. Suggests loading; prefer the progress bar.        |
| Hide When Time Runs Out | Boolean | Hides the component on expiry, keeping its space. See below. |
| Hide When This Is True  | Boolean | Optional. Bind a Boolean **resource**; hides while true.     |

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

Style, message, icon and bar tint are separate so they compose freely. Colour on
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

### Do not drive this component's visibility from its own output

Putting a Flow visibility condition on this component that references its own
`timerExpired` **does not work, and the component never appears at all**. Flow
evaluates the condition before the component mounts, so the output is still
unset, the condition fails, the component never renders, and it therefore never
reports a value. It is circular.

Use one of the two hide properties instead. Both apply `visibility: hidden` to
the component's content, so it disappears but keeps its space and nothing below
it jumps up.

- **Hide When Time Runs Out** — a checkbox, for the self-contained case. This is
  the only way to get hide-on-expiry, because the external route is the
  circular one described above.
- **Hide When This Is True** — a reactive Boolean **resource**: a Flow variable,
  a formula, or another component's output. Hides while true and reappears when
  it goes false. Resource-only on purpose; a hardcoded `true` would hide the
  component forever, which a Flow visibility condition already does better.

They combine rather than override — either one being true hides the component.

Hiding is visual only. The timer keeps running and **still advances the
screen**; bind `Pause Timer` if you want the clock held as well.

Driving a _different_ component from `timerExpired` is fine and is the intended
use — that is the Stay pattern above.

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
- The `Pulse` warning style honours `prefers-reduced-motion`.

## Development

```bash
npm run verify   # prettier, eslint, jest
```

The editor is built on the [Flow Config Editor Kit](../vendor/flow-config-editor-kit),
which must be deployed to the org before this component's property panel will
render.
