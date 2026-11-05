import { SeverityNumber } from "@opentelemetry/api-logs";
import { after } from "next/server";
import { posthogLoggerProvider, posthogWorkflowLogger } from "@/instrumentation";

type WorkflowLog = {
  workflow: "kyc_questionnaire";
  route: string;
  outcome: "completed" | "failed";
  status_code: number;
  error_code?: string;
};

/** Emits only PostHog-owned, bounded workflow outcomes; existing application logs stay local. */
export function logQuestionnaireWorkflow(record: WorkflowLog) {
  if (!posthogWorkflowLogger || !posthogLoggerProvider) return;

  posthogWorkflowLogger.emit({
    body: "KYC questionnaire workflow completed",
    severityNumber: record.outcome === "completed" ? SeverityNumber.INFO : SeverityNumber.ERROR,
    attributes: record,
  });
  after(async () => {
    await posthogLoggerProvider.forceFlush();
  });
}
