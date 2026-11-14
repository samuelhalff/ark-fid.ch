import { createHash } from "node:crypto";
import type { CampaignLedger } from "./campaign";
import { DEFAULT_DRIVE_ID, type TaxStorage } from "./storage";

const env = (name: string) => (process.env[name] || "").trim();

/** Durable ledger: one small JSON file per processed key in the library's _system folder. */
export function fileLedger(storage: TaxStorage): CampaignLedger {
  const drive = env("TAX_QF_SP_DRIVE_ID") || DEFAULT_DRIVE_ID;
  let folder = "";
  const folderId = async () => {
    if (!folder) {
      const system = await storage.ensureSubfolder(drive, "root", "_system");
      folder = await storage.ensureSubfolder(drive, system, "cron-ledger");
    }
    return folder;
  };
  const fileName = (key: string) => `${createHash("sha256").update(key).digest("hex").slice(0, 40)}.json`;
  return {
    async has(key) {
      return (await storage.readFile(drive, await folderId(), fileName(key))) !== null;
    },
    async add(key) {
      const body = new TextEncoder().encode(JSON.stringify({ key, at: new Date().toISOString() }));
      await storage.putFile(drive, await folderId(), fileName(key), body, "application/json");
    },
  };
}
