type Props = {
  siteId: string;
  pageContext?: string;
};

/**
 * MATAYA™ is intentionally disabled for TAYA Phase 1.
 *
 * The component interface remains in place so Phase 2 can re-enable the
 * assistant without changing dashboard layouts or route-level integrations.
 * Keeping this as a no-op also prevents Phase 1 from depending on an AI
 * provider, AI environment variables, or unfinished assistant workflows.
 */
export function AIAssistant(_props: Props) {
  return null;
}
