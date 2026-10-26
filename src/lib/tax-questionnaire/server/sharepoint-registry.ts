/**
 * SharePoint adapters of the ports (CRM "Clients" list, "Suivi questionnaires", client
 * preferences, access records). IMPLEMENTATION IN PROGRESS — the factory signature is stable.
 */
import type { AccessStore, ClientRegistry, PreferenceStore, ReturnTracker } from "./ports";

export interface Ports {
  registry: ClientRegistry;
  tracker: ReturnTracker;
  prefs: PreferenceStore;
  access: AccessStore;
}

export function sharePointPorts(): Ports {
  throw new Error("sharePointPorts not implemented yet");
}
