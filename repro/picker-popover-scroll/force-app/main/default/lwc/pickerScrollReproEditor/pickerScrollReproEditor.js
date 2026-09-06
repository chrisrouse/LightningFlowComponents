/**
 * Reproduces: a kit picker's popover does not follow its field when an ANCESTOR
 * scrolls, if that ancestor is a scroll container the `window` scroll listener
 * cannot observe.
 *
 * The pickers render their dropdown `position: fixed` at self-computed
 * coordinates, and reposition from a capture-phase `scroll` listener on `window`
 * (`createPopoverViewportController` in `flowConfigPopoverUtils`). `scroll` events
 * are not composed, so they cannot cross a shadow boundary — a scroll inside a
 * consuming component's own shadow root never reaches that listener, and neither
 * does a scroll of Flow Builder's property panel, whose scroller sits inside Flow
 * Builder's own shadow root. Verified by console: a capture-phase `scroll`
 * listener on `document` logs nothing at all while that panel scrolls.
 *
 * The scroll container here is ours and is guaranteed to overflow, so the repro
 * does not depend on the panel being tall enough to scroll.
 *
 * TRACK ANCHOR POSITION is a proof of the proposed fix, run from OUTSIDE the kit.
 * It watches the picker element's own rect once per animation frame and, when it
 * moves, tells the kit that something changed. If the popover then follows, two
 * things are established: the kit's positioning maths is correct when its handler
 * runs, and per-frame rect comparison is a sufficient trigger — no scroll
 * listener, no shadow-boundary traversal, and no dependence on WHERE the scroll
 * happened. That is what `autoUpdate({ animationFrame: true })` does in Floating
 * UI, and it is the shape the upstream fix should take.
 */
import { LightningElement, api } from "lwc";

/**
 * Bumped on every deploy, and rendered at the top of the editor.
 *
 * Flow Builder keeps the module graph it loaded, so a deploy is invisible until a
 * hard refresh -- which made two earlier rounds of testing ambiguous. Read this
 * number before drawing any conclusion from what you see.
 */
const VERSION = "v7 — inline resource picker";

/** How long the anchor must hold still before `settle` mode repositions. */
const SETTLE_MS = 90;

export default class PickerScrollReproEditor extends LightningElement {
    @api builderContext = {};
    @api automaticOutputVariables = {};
    @api inputVariables = [];

    version = VERSION;

    /**
     * Off / every frame / only once movement stops.
     *
     * `settle` exists to test a diagnosis, not as a proposed behaviour. The kit
     * corrects its placement over up to three passes, and throws the corrections
     * away whenever the anchor's rect signature changes -- which during a scroll is
     * every frame. So it is permanently on pass one, oscillating between the
     * uncorrected and corrected position. That is the stutter.
     *
     * If `settle` is smooth and lands correctly while `frame` stutters, the
     * diagnosis holds and the real fix is in the kit: keep the correction offsets
     * across anchor moves. They compensate for a containing-block offset, which is
     * a property of the ancestor chain and does not change because the anchor
     * scrolled.
     */
    trackingMode = "off";

    /** Something native to compare against, in the same scrolling box. */
    nativeOptions = [
        { label: "Alpha", value: "alpha" },
        { label: "Bravo", value: "bravo" },
        { label: "Charlie", value: "charlie" },
        { label: "Delta", value: "delta" },
        { label: "Echo", value: "echo" }
    ];

    trackingModes = [
        { label: "Off — reproduces the bug", value: "off" },
        { label: "Every frame — tracks, but stutters", value: "frame" },
        { label: "On settle — repositions once scrolling stops", value: "settle" }
    ];

    /** Filler, purely to make the container overflow. */
    filler = Array.from({ length: 12 }, (_, index) => ({
        key: `filler-${index}`,
        label: `Filler row ${index + 1}`
    }));

    _frame = null;
    _lastRect = "";
    _moveCount = 0;
    _settleAt = 0;

    get resourceValue() {
        return this.inputVariables?.find((variable) => variable.name === "resourceValue")?.value;
    }

    get isTracking() {
        return this.trackingMode !== "off";
    }

    get moveCountLabel() {
        return `${this._moveCount} moves reported`;
    }

    handleResource(event) {
        this.dispatchEvent(
            new CustomEvent("configuration_editor_input_value_changed", {
                bubbles: true,
                composed: true,
                cancelable: false,
                detail: {
                    name: "resourceValue",
                    newValue: event.detail?.newValue ?? null,
                    newValueDataType: event.detail?.newValueDataType ?? "String"
                }
            })
        );
    }

    handleModeChange(event) {
        this.trackingMode = event.detail.value;
        this._lastRect = "";
        this._moveCount = 0;
        this._settleAt = 0;
        if (this.isTracking && this._frame === null) {
            this.watchAnchor();
        }
    }

    disconnectedCallback() {
        if (this._frame !== null) {
            window.cancelAnimationFrame(this._frame);
            this._frame = null;
        }
    }

    /**
     * Watches the picker's own rect rather than anything inside it, so this needs
     * no access across the picker's shadow boundary. An ancestor scroll moves the
     * picker and its anchor identically.
     */
    watchAnchor() {
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        this._frame = window.requestAnimationFrame(() => {
            this._frame = null;
            if (!this.isTracking) {
                return;
            }
            const picker = this.template.querySelector("c-flow-config-resource-picker");
            if (picker) {
                const rect = picker.getBoundingClientRect();
                const signature = `${Math.round(rect.left)}:${Math.round(rect.top)}:${Math.round(rect.width)}`;
                const moved = this._lastRect && signature !== this._lastRect;
                if (moved) {
                    this._settleAt = Date.now() + SETTLE_MS;
                }
                // The kit recomputes from its own anchor's rect, so it only has to be
                // told that something moved -- not what, and not where.
                if (this.trackingMode === "frame" && moved) {
                    this._moveCount += 1;
                    window.dispatchEvent(new CustomEvent("scroll"));
                } else if (this.trackingMode === "settle" && this._settleAt && Date.now() >= this._settleAt) {
                    this._settleAt = 0;
                    this._moveCount += 1;
                    window.dispatchEvent(new CustomEvent("scroll"));
                }
                this._lastRect = signature;
            }
            this.watchAnchor();
        });
    }
}
