"use client";

import { createContext, useContext } from "react";

/**
 * A screen pushed inside a step (a company holder's own screen): while it is open the step's title,
 * numbered screens and Back / Continue give way to its breadcrumb and its own « Terminé », so only
 * one main button shows at a time.
 */
export const SubScreenContext = createContext<{ open: boolean; set: (open: boolean) => void }>({ open: false, set: () => undefined });
export const useSubScreen = () => useContext(SubScreenContext);
