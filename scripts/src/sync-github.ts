import { execSync, spawnSync } from "node:child_process";

const OWNER = "thefsts";
const REPO = "FSTS-client-Dashboard-for-sites-";
const BRANCH = "main";
const AUTHOR_NAME = "Thefsts";
const AUTHOR_EMAIL = "amorebey@gmail.com";

function redact(text: string, token: string): string {
  if (!token) return text;
  return text
    .replaceAll(token, "[REDACTED]")
    .replace(/https?:\/\/[^@\s]*@github\.com/g, "https://[REDACTED]@github.com");
}

async function sendSlackAlert(
  webhookUrl: string,
  errorOutput: string,
): Promise<boolean> {
  const payload = {
    text: [
      ":rotating_light: *FSTS GitHub mirror sync failed*",
      "```",
      errorOutput.trim() || "(no output captured)",
      "```",
      "To re-trigger: `pnpm --filter @workspace/scripts run sync-github`",
    ].join("\n"),
  };
  try {
    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (resp.ok) {
      console.error("→ Slack alert sent to #dev-alerts");
      return true;
    }
    console.error(`→ Slack alert failed: HTTP ${resp.status}`);
  } catch (err) {
    console.error("→ Slack alert failed:", err);
  }
  return false;
}

async function sendGitHubIssue(
  token: string,
  errorOutput: string,
): Promise<boolean> {
  const body = [
    "## GitHub Mirror Sync Failed",
    "",
    "**Error output:**",
    "```",
    errorOutput.trim() || "(no output captured)",
    "```",
    "",
    "**To re-trigger the sync manually, run:**",
    "```bash",
    "pnpm --filter @workspace/scripts run sync-github",
    "```",
    "",
    "_Posted automatically by `scripts/src/sync-github.ts` after a failed post-merge push._",
  ].join("\n");

  try {
    const resp = await fetch(
      `https://api.github.com/repos/${OWNER}/${REPO}/issues`,
      {
        method: "POST",
        headers: {
          Authorization: `token ${token}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({
          title: "[Alert] GitHub mirror sync failed",
          body,
          labels: ["sync-failure"],
        }),
      },
    );
    if (resp.ok) {
      const issue = (await resp.json()) as { html_url: string; number: number };
      console.error(`→ GitHub issue #${issue.number} created: ${issue.html_url}`);
      return true;
    }
    const text = await resp.text();
    console.error(
      `→ GitHub issue creation failed: HTTP ${resp.status} — ${text}`,
    );
  } catch (err) {
    console.error("→ GitHub issue creation failed:", err);
  }
  return false;
}

async function sendAlerts(errorOutput: string, token: string): Promise<void> {
  const slackUrl = process.env.SLACK_WEBHOOK_URL;

  if (!slackUrl) {
    console.error(
      "⚠  SLACK_WEBHOOK_URL is not set. Slack alerts are disabled.\n" +
        "   If this failure is due to an expired or invalid GITHUB_PERSONAL_ACCESS_TOKEN,\n" +
        "   the GitHub issue alert below will also fail (it uses the same token).\n" +
        "   Set SLACK_WEBHOOK_URL to a Slack incoming-webhook URL for token-independent alerts.",
    );
  }

  const slackSent = slackUrl
    ? await sendSlackAlert(slackUrl, errorOutput)
    : false;

  const issueSent = await sendGitHubIssue(token, errorOutput);

  if (!slackSent && !issueSent) {
    console.error(
      "✗ All alert channels failed. The failure has been logged above.\n" +
        "  Manually re-trigger with: pnpm --filter @workspace/scripts run sync-github",
    );
  }
}

(async () => {
  const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  if (!token) {
    console.error("✗ GITHUB_PERSONAL_ACCESS_TOKEN is not set.");
    console.error(
      "  Connect the GitHub integration so the token is available.",
    );
    process.exit(1);
  }

  const repoRoot = execSync("git rev-parse --show-toplevel", {
    encoding: "utf8",
  }).trim();
  process.chdir(repoRoot);

  execSync(`git config user.name "${AUTHOR_NAME}"`);
  execSync(`git config user.email "${AUTHOR_EMAIL}"`);

  const remoteUrl = `https://${token}@github.com/${OWNER}/${REPO}.git`;
  try {
    execSync("git remote get-url github", { stdio: "ignore" });
    execSync(`git remote set-url github "${remoteUrl}"`, { stdio: "ignore" });
  } catch {
    execSync(`git remote add github "${remoteUrl}"`, { stdio: "ignore" });
  }

  console.log(`→ Pushing to github.com/${OWNER}/${REPO} (branch: ${BRANCH})…`);

  const result = spawnSync("git", ["push", "github", BRANCH, "--force"], {
    encoding: "utf8",
    stdio: "pipe",
  });

  const rawOutput = [result.stdout ?? "", result.stderr ?? ""].join("").trim();

  execSync(
    `git remote set-url github "https://github.com/${OWNER}/${REPO}.git"`,
    { stdio: "ignore" },
  );

  const safeOutput = redact(rawOutput, token);

  if (safeOutput) console.log(safeOutput);

  if (result.status !== 0) {
    const exitCode = result.status ?? 1;
    console.error(`✗ GitHub push failed (exit ${exitCode})`);
    console.error("  Sending failure alerts…");
    await sendAlerts(safeOutput || `git push exited with code ${exitCode}`, token);
    process.exit(exitCode);
  }

  console.log("✓ GitHub mirror updated");
})();
