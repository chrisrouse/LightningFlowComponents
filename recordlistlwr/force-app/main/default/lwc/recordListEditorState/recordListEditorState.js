/**
 * Shares the selected object between the Record List LWR property editors.
 *
 * WHY THIS EXISTS. A property editor receives only its own property's value — there
 * is no way for the List View editor to read the Object editor's. The documented
 * answer is to put both values in one property via a `LightningTypeBundle` with a
 * `"$"` top-level override, but that bundle will not deploy to this org at any API
 * version, and folding them into one String property means removing the existing
 * `objectApiName` / `listViewApiName` tags, which the platform refuses while the
 * component sits on a page.
 *
 * So the two editors talk directly. Both run in the same property panel, in the same
 * JavaScript context, so a module-scoped value is shared between them: ES modules
 * are singletons per context.
 *
 * THIS IS A WORKAROUND, and its weakness is worth stating plainly: the coupling is
 * invisible from either component's public API, and it assumes both editors are alive
 * in the same panel at the same time. If the component is ever removed from every
 * page — making the old property tags removable — prefer one editor owning both
 * values and delete this file.
 */

let selectedObjectApiName;
const subscribers = new Set();

/**
 * @param {string|undefined} objectApiName The object now chosen in the panel.
 */
export function publishSelectedObject(objectApiName) {
    if (objectApiName === selectedObjectApiName) {
        return;
    }
    selectedObjectApiName = objectApiName;
    subscribers.forEach((notify) => notify(selectedObjectApiName));
}

/**
 * Calls back immediately with the current value, then on every change.
 *
 * The immediate call matters: the editors mount in an order this module cannot
 * control, and a subscriber that only heard about future changes would miss the
 * object that was already selected when the panel opened.
 *
 * @param {(objectApiName: string|undefined) => void} notify
 * @returns {() => void} Unsubscribe, for disconnectedCallback.
 */
export function subscribeToSelectedObject(notify) {
    subscribers.add(notify);
    notify(selectedObjectApiName);
    return () => subscribers.delete(notify);
}

/** Test seam. Panels are long-lived, so nothing in production resets this. */
export function resetSelectedObject() {
    selectedObjectApiName = undefined;
    subscribers.clear();
}
