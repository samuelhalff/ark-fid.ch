/** The only values of `x-kqf-action` the case route serves; it also names the rate-limit store, so nothing else may become one. */
export const CASE_ACTIONS = ["save", "upload", "delete", "submit", "signed", "sign-online", "ask", "companies"] as const;
export const isCaseAction = (action: string): boolean => (CASE_ACTIONS as readonly string[]).includes(action);
