import { Vercel } from "@vercel/sdk";

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
const VERCEL_TEAM_SLUG = process.env.VERCEL_TEAM_SLUG;

const vercel = new Vercel({
  bearerToken: VERCEL_TOKEN,
});

/**
 * Vercel deployment integration.
 * Triggers a preview deployment for a GitHub branch and returns the preview URL.
 */

export interface DeployResult {
  url: string;
  deploymentId: string;
}

/**
 * Create a Vercel preview deployment for a GitHub branch.
 * Returns the preview URL when deployment is ready, or null if deployment fails.
 */
export async function deployBranch(params: {
  owner: string;
  repo: string;
  branch: string;
}): Promise<DeployResult | null> {
  if (!VERCEL_TOKEN) {
    console.log("[vercel] VERCEL_TOKEN not set, skipping deployment");
    return null;
  }

  const { owner, repo, branch } = params;
  const projectName = repo;

  try {
    const body: Record<string, unknown> = {
      name: projectName,
      target: "preview",
      gitSource: {
        type: "github",
        ref: branch,
        repo,
        org: owner,
      },
    };

    const url = new URL("https://api.vercel.com/v13/deployments");
    if (VERCEL_TEAM_ID) {
      url.searchParams.set("teamId", VERCEL_TEAM_ID);
    }

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[vercel] Deploy failed:", res.status, errText);
      return null;
    }

    const data = (await res.json()) as {
      id?: string;
      url?: string;
      readyState?: string;
    };

    const deploymentId = data.id;
    let previewUrl: string | null | undefined = data.url;

    // If deployment is not ready yet, poll for completion
    if (!previewUrl && deploymentId) {
      previewUrl = await pollDeploymentReady(deploymentId);
    }

    if (previewUrl) {
      const url = previewUrl.startsWith("http") ? previewUrl : `https://${previewUrl}`;
      console.log("[vercel] Deployment ready:", url);
      return { url, deploymentId: deploymentId ?? "" };
    }

    return null;
  } catch (err) {
    console.error("[vercel] Deploy error:", err);
    return null;
  }
}

/**
 * Resolve a Vercel dashboard URL (vercel.com/...) to the actual preview URL (*.vercel.app).
 * Also accepts a raw deployment ID.
 * Returns null if VERCEL_TOKEN is not set or the deployment cannot be fetched.
 */
export async function getDeploymentPreviewUrl(
  deploymentIdOrDashboardUrl: string
): Promise<string | null> {
  if (!VERCEL_TOKEN) return null;

  let deploymentId = deploymentIdOrDashboardUrl;
  // Extract deployment ID from vercel.com dashboard URL (e.g. https://vercel.com/org/project/dpl_xxx or .../AfgmSYjErWAnru9XiXmEwFE76xYr)
  if (deploymentIdOrDashboardUrl.includes("vercel.com/")) {
    const match = deploymentIdOrDashboardUrl.match(/vercel\.com\/[^/]+\/[^/]+\/([^/?]+)/);
    deploymentId = match?.[1] ?? deploymentIdOrDashboardUrl;
  }

  try {
    const url = new URL(`https://api.vercel.com/v13/deployments/${deploymentId}`);
    if (VERCEL_TEAM_ID) {
      url.searchParams.set("teamId", VERCEL_TEAM_ID);
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { url?: string; readyState?: string };
    if (data.readyState === "READY" && data.url) {
      return data.url.startsWith("http") ? data.url : `https://${data.url}`;
    }
    return null;
  } catch {
    return null;
  }
}

async function pollDeploymentReady(deploymentId: string): Promise<string | null> {
  const maxAttempts = 30;
  const intervalMs = 5000;

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));

    const url = new URL(`https://api.vercel.com/v13/deployments/${deploymentId}`);
    if (VERCEL_TEAM_ID) {
      url.searchParams.set("teamId", VERCEL_TEAM_ID);
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
    });

    if (!res.ok) continue;

    const data = (await res.json()) as { url?: string; readyState?: string };
    if (data.readyState === "READY" && data.url) {
      return data.url.startsWith("http") ? data.url : `https://${data.url}`;
    }
    if (data.readyState === "ERROR" || data.readyState === "CANCELED") {
      console.error("[vercel] Deployment failed:", data.readyState);
      return null;
    }
  }

  console.error("[vercel] Deployment timed out");
  return null;
}

export async function getDeploymentUrl(deploymentId: string): Promise<string | null> {
  const result = await vercel.deployments.getDeployment({
    idOrUrl: deploymentId,
    withGitRepoInfo: "true",
    slug: VERCEL_TEAM_SLUG,
  });
  return result?.url;
}
