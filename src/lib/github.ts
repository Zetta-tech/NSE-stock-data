import "server-only";
import type { AlertRequest } from "./types";

const GITHUB_API = "https://api.github.com";

function getConfig() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) return null;
  return { token, repo };
}

export async function createAlertIssue(
  req: AlertRequest
): Promise<{ issueNumber: number; issueUrl: string }> {
  const config = getConfig();
  if (!config) throw new Error("GITHUB_TOKEN or GITHUB_REPO not configured");

  const title = `Alert Request: ${req.text.replace(/^Create Alert:\s*/i, "").slice(0, 80)}`;

  const body = [
    "---",
    `request_text: "${req.text.replace(/"/g, '\\"')}"`,
    `request_id: "${req.id}"`,
    `submitted_at: "${req.createdAt}"`,
    "---",
    "",
    "## Alert Request",
    "",
    `> ${req.text}`,
    "",
    "## Agent Instructions",
    "",
    "Read `AGENTS.md` at the repo root for full implementation instructions.",
    "Read all files in `docs/` for architecture, alert system, and API capability details.",
    "",
    "## Constraints",
    "",
    "- Do not add new NPM dependencies",
    "- Do not modify middleware.ts, redis.ts, lockdown.ts, or auth route",
    "- Respect stale data suppression (dataSource === 'stale' → no trigger)",
    "- Use existing persistence patterns (Redis + filesystem fallback)",
    "- Dedup alerts by symbol + alertType + date",
  ].join("\n");

  const res = await fetch(`${GITHUB_API}/repos/${config.repo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({
      title,
      body,
      labels: ["agent:create-alert"],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return {
    issueNumber: data.number,
    issueUrl: data.html_url,
  };
}
