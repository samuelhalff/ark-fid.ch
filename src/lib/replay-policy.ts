/**
 * Pages where PostHog session replay never runs, because they carry client
 * data: the KYC and tax questionnaires (also served on kyc./tax.ark-fid.ch,
 * where the browser path is just /<locale>/), the assistant transcript
 * (/agent), the contact page. Lead forms embedded elsewhere (home, services)
 * carry the `ph-no-capture` class, which blocks them from replay and
 * autocapture. Dependency-free for `node --test`.
 */
const EXCLUDED_HOST_PREFIXES = ["tax.", "kyc.", "lba."];
const EXCLUDED_PATH = /(^|\/)(questionnaire-fiscal|questionnaire-kyc|agent|contact|admin|portal|onboarding|signature)(\/|$)/;

export function isReplayExcluded(hostname: string, pathname: string): boolean {
  const host = (hostname || "").toLowerCase();
  if (EXCLUDED_HOST_PREFIXES.some((prefix) => host.startsWith(prefix))) return true;
  return EXCLUDED_PATH.test(pathname || "/");
}
