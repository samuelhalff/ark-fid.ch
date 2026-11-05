import { SeverityNumber } from "@opentelemetry/api-logs";
import { after } from "next/server";
import { posthogLogsProvider } from "@/instrumentation";

type PostHogLog = {
  body: string;
  severityNumber: SeverityNumber;
  attributes: Record<string, string | number | boolean>;
};

const logger = posthogLogsProvider?.getLogger("posthog-wizard");

export function emitPostHogLog({ body, severityNumber, attributes }: PostHogLog) {
  const provider = posthogLogsProvider;
  if (!logger || !provider) return;

  logger.emit({ body, severityNumber, attributes });
  after(async () => {
    try {
      await provider.forceFlush();
    } catch {
      // Log delivery must not change the route response.
    }
  });
}

export { SeverityNumber };
