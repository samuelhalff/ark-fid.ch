# Quoting instructions — NOT YET SYNCED

> **Status: placeholder.** The authoritative quoting instructions live in the Azure AI
> Foundry agent `ark-quote-agent` (permagest/pbm tenant, `AZURE_AGENT_CHAT_NAME`).
> They have not been pulled down yet because no Azure credentials were available in the
> session that created this skill.
>
> Run `node scripts/fetch_quote_instructions.mjs` from the skill directory with the
> credentials set (see `scripts/README.md`). It overwrites this file with the agent's
> real instructions and records the agent name/version and sync date.

## Until this file is synced

- Do **not** state any fee, hourly rate, package price or range in a prospect email.
- Do **not** commit to a delivery timeline or scope boundary.
- Instead: acknowledge what they need, say the fee depends on volume and scope, and move
  to the 15-minute Teams call. If Samuel gives a figure in chat, use his figure verbatim.

## Information to collect before a quote can be prepared

Ask for at most two of these in a first email — the rest belongs in the call.

- Entity type and status (SA / Sàrl / sole trader / branch; existing or to be incorporated)
- Canton of the registered seat
- Annual turnover, and expected volume of accounting entries or invoices per month
- Number of employees on payroll, and payroll frequency
- VAT status (registered, method: effective or flat rate)
- Which services are in scope: accounting, VAT, corporate tax, payroll, domiciliation,
  corporate secretarial
- Current tooling and who does the bookkeeping today
- Start date and whether there is a backlog to catch up
- Languages and reporting requirements (group reporting, audit, IFRS/Swiss GAAP)

## Synced content

_(replaced by the sync script)_
