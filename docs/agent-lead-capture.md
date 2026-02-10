# Agent Lead Capture (SharePoint)

This project stores AI chat leads in SharePoint via Microsoft Graph. Azure AI Foundry runs in the permagest/pbm tenant, while lead storage lives in the ark tenant.

## Tenants

- **Azure AI Foundry (chat):** permagest/pbm tenant (`AZURE_*` env vars)
- **Lead storage (SharePoint):** ark tenant (`MSGRAPH_*` env vars)

Use the **crm-dev** app from the ark tenant for Microsoft Graph access.

The chat agent runs on Azure AI Foundry (permagest/pbm) using `AZURE_*` credentials. Lead storage uses Microsoft Graph with `MSGRAPH_*` credentials (ark tenant). The Foundry service principal needs data-plane access on the Cognitive Services account/project (e.g. **Azure AI Project Manager** role).

## Required SharePoint Setup

- **Site:** `https://arkfiduciaire.sharepoint.com/sites/CRM`
- **List:** `Prospects`
- **Required columns (internal names):**
  - `Title`
  - `Email`
  - `LeadTokenHash` (single line text)
  - `Messages` (multiline text)
- **Added lead columns (internal names):**
  - `LeadName`
  - `LeadCompany`
  - `LeadPhone`
  - `LeadStatus`
  - `LeadSource`
  - `LeadSessionId`
  - `LeadPageUrl`
  - `LeadReferrer`
  - `LeadUtmSource`
  - `LeadUtmMedium`
  - `LeadUtmCampaign`
  - `LeadUtmTerm`
  - `LeadUtmContent`
  - `LeadLastMessageAt`
  - `LeadLastUserMessage`
  - `LeadLastAssistantMessage`
  - `LeadInitialMessage`

`LeadTokenHash` was created programmatically; `Email` already existed on the Prospects list. The lead columns above were created to capture attribution, status, and last-message context.

Optional columns can be mapped via env vars if they exist.

## Environment Variables

```bash
# Azure AI Foundry (permagest/pbm)
AZURE_AGENT_ENDPOINT=
AZURE_AGENT_CHAT_NAME=
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_CREDENTIALS=

# SharePoint lead capture (ark tenant)
MSGRAPH_TENANT_ID=
MSGRAPH_CLIENT_ID=
MSGRAPH_CLIENT_SECRET=
AGENT_LEAD_TOKEN_SECRET=<random-32+ chars>
SP_SITE_HOSTNAME=arkfiduciaire.sharepoint.com
SP_SITE_PATH=/sites/CRM
SP_LEADS_LIST_NAME=Prospects
SP_LEADS_FIELD_EMAIL=Email
SP_LEADS_FIELD_TOKEN_HASH=LeadTokenHash
SP_LEADS_FIELD_TRANSCRIPT=Messages
```

## Permissions

Grant the crm-dev app **Microsoft Graph** permissions:

- Recommended: `Sites.Selected` with access granted to the CRM site
- Alternative: `Sites.ReadWrite.All`

Admin consent must be applied.
