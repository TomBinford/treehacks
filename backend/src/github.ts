/**
 * GitHub API helpers for finding PRs by branch.
 */

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

export interface PRInfo {
  htmlUrl: string;
  number: number;
}

/**
 * Find an open PR for the given branch.
 * Returns the PR info if found, null otherwise.
 */
export async function findPRForBranch(params: {
  owner: string;
  repo: string;
  branch: string;
}): Promise<PRInfo | null> {
  if (!GITHUB_TOKEN) {
    console.log("[github] GITHUB_TOKEN not set, cannot look up PR");
    return null;
  }

  const { owner, repo, branch } = params;
  const head = `${owner}:${branch}`;

  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls?head=${encodeURIComponent(head)}&state=open`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!res.ok) {
      console.error("[github] List PRs failed:", res.status, await res.text());
      return null;
    }

    const prs = (await res.json()) as Array<{ html_url?: string; number?: number }>;
    const pr = prs[0];
    if (pr?.html_url) {
      return { htmlUrl: pr.html_url, number: pr.number ?? 0 };
    }
    return null;
  } catch (err) {
    console.error("[github] Error finding PR:", err);
    return null;
  }
}
