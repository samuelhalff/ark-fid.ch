/** The only values of `x-tqf-action` the case route serves; it also names the rate-limit store, so nothing else may become one. */
export const CASE_ACTIONS = ["save", "delete", "resumeLink", "upload", "remove", "submit", "additions", "reopen", "feedback", "partner"] as const;
export const isCaseAction = (action: string): boolean => (CASE_ACTIONS as readonly string[]).includes(action);
