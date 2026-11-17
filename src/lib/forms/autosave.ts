/**
 * When the KYC and tax questionnaires save their server-side draft (one rule for both forms).
 *
 * Not on every keystroke: Sam, filling a form with a client on 2026-11-17, « le form enregistre
 * toutes les secondes, c'est trop ». A draft is saved after a pause in typing, at every step
 * change (the forms call their save there), and when the page is hidden (another app, a closed
 * tab, a locked phone), so nothing typed is lost.
 */
export const AUTOSAVE_IDLE_MS = 6000;

/** Calls `save` whenever the page stops being visible; returns the cleanup. */
export function saveWhenHidden(save: () => void): () => void {
  const onChange = () => {
    if (document.visibilityState === "hidden") save();
  };
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}
