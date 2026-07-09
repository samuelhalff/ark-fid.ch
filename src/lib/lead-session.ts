import { randomBytes } from "crypto";

export const buildSyntheticLeadSession = (odooLeadId?: number | null) => ({
  leadId:
    typeof odooLeadId === "number" && Number.isFinite(odooLeadId)
      ? `odoo-${odooLeadId}`
      : `synthetic-${Date.now()}`,
  leadToken: randomBytes(24).toString("hex"),
});

export const isSyntheticLeadId = (leadId?: string) =>
  Boolean(leadId && /^(odoo|synthetic)-/.test(leadId));

export const shouldBypassLeadPersistence = ({
  internalUser,
  leadId,
}: {
  internalUser: boolean;
  leadId?: string;
}) => internalUser || isSyntheticLeadId(leadId);
