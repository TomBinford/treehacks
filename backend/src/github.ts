/**
 * GitHub API client for monitoring deployments and workflow runs.
 * Also provides helpers for finding PRs by branch (uses GITHUB_TOKEN when set).
 */

import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

export interface PRInfo {
  htmlUrl: string;
  number: number;
}

/**
 * Find an open PR for the given branch.
 * Returns the PR info if found, null otherwise.
 * Uses GITHUB_TOKEN when set.
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

// GitHub App credentials for deployment monitoring (APP_ID, PRIVATE_KEY)
// - APP_ID: GitHub App ID (already exists)
// - PRIVATE_KEY: GitHub App private key (already exists)
// These are used to authenticate as the GitHub App to monitor deployments

const APP_ID = process.env.APP_ID;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

export interface WorkflowRun {
  id: number;
  status: string | null;
  conclusion: string | null;
  html_url: string;
}

export interface Deployment {
  id: number;
  environment: string;
  state: string;
  statuses_url: string;
}

export interface DeploymentStatus {
  state: string;
  environment_url: string | null;
  log_url: string | null;
}

/**
 * Creates an authenticated Octokit client using the GitHub App credentials
 */
export async function createGitHubClient(): Promise<Octokit> {
  if (!APP_ID || !PRIVATE_KEY) {
    throw new Error("GitHub App credentials (APP_ID, PRIVATE_KEY) not configured");
  }
  if (!process.env.INSTALLATION_ID) {
    throw new Error("GitHub App INSTALLATION_ID not set");
  }

  const installationId = parseInt(process.env.INSTALLATION_ID, 10);
  if (isNaN(installationId)) {
    throw new Error("GitHub App INSTALLATION_ID is not a valid number");
  }

  // Create an installation-specific client
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: APP_ID,
      privateKey: PRIVATE_KEY,
      installationId,
    },
  });
}

export interface WorkflowRunWithSha extends WorkflowRun {
  head_sha: string | null;
}

/**
 * Get the latest workflow runs for a specific branch
 */
export async function getWorkflowRunsForBranch(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string
): Promise<WorkflowRunWithSha[]> {
  try {
    const { data } = await octokit.actions.listWorkflowRunsForRepo({
      owner,
      repo,
      branch,
      per_page: 10,
    });
    return data.workflow_runs.map((run: { id: number; status: string | null; conclusion: string | null; html_url: string; head_sha?: string | null }) => ({
      id: run.id,
      status: run.status,
      conclusion: run.conclusion,
      html_url: run.html_url,
      head_sha: run.head_sha ?? null,
    }));
  } catch (err) {
    console.error(`[github] Failed to get workflow runs for ${owner}/${repo}@${branch}:`, err);
    return [];
  }
}

/**
 * Get deployments for a specific ref (branch name or commit SHA)
 */
export async function getDeploymentsForRef(
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string
): Promise<Deployment[]> {
  try {
    const { data } = await octokit.repos.listDeployments({
      owner,
      repo,
      ref,
      per_page: 10,
    });
    return data.map((deployment: { id: number; environment: string; payload?: unknown; statuses_url: string }) => ({
      id: deployment.id,
      environment: deployment.environment,
      state: (typeof deployment.payload === 'object' && deployment.payload !== null && 'state' in deployment.payload)
        ? String(deployment.payload.state)
        : "unknown",
      statuses_url: deployment.statuses_url,
    }));
  } catch (err) {
    console.error(`[github] Failed to get deployments for ${owner}/${repo}@${ref}:`, err);
    return [];
  }
}

/** @deprecated Use getDeploymentsForRef */
export async function getDeploymentsForBranch(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string
): Promise<Deployment[]> {
  return getDeploymentsForRef(octokit, owner, repo, branch);
}

/**
 * Get the latest deployment status for a deployment
 * This is where we extract the Vercel preview URL
 *
 * IMPORTANT: listDeploymentStatuses returns statuses in creation order (oldest first).
 * With per_page: 1 we'd get the initial "pending" status and never see "success".
 * We fetch multiple and pick the most recent by created_at.
 */
export async function getDeploymentStatus(
  octokit: Octokit,
  owner: string,
  repo: string,
  deploymentId: number
): Promise<DeploymentStatus | null> {
  try {
    const { data } = await octokit.repos.listDeploymentStatuses({
      owner,
      repo,
      deployment_id: deploymentId,
      per_page: 10,
    });
    if (data.length === 0) return null;

    // Pick the most recent status by created_at (API returns oldest-first)
    const statuses = data as Array<{ state: string; environment_url?: string | null; log_url?: string | null; created_at?: string }>;
    const latest = statuses.reduce((a, b) =>
      (b.created_at ?? "") > (a.created_at ?? "") ? b : a
    );
    return {
      state: latest.state,
      environment_url: latest.environment_url ?? null,
      log_url: latest.log_url ?? null,
    };
  } catch (err) {
    console.error(`[github] Failed to get deployment status for deployment ${deploymentId}:`, err);
    return null;
  }
}

/**
 * Check if a branch exists in the repository
 */
export async function branchExists(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string
): Promise<boolean> {
  try {
    await octokit.repos.getBranch({
      owner,
      repo,
      branch,
    });
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Get the head commit SHA for a branch
 */
async function getBranchHeadSha(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string
): Promise<string | null> {
  try {
    const { data } = await octokit.repos.getBranch({
      owner,
      repo,
      branch,
    });
    return data.commit.sha ?? null;
  } catch {
    return null;
  }
}

/**
 * Try to extract a Vercel preview URL from commit statuses (e.g. Vercel adds a status with target_url).
 * Prefers actual deployment URLs (*.vercel.app, *.vercel.sh) over dashboard URLs (vercel.com/...).
 */
async function getVercelUrlFromCommitStatus(
  octokit: Octokit,
  owner: string,
  repo: string,
  ref: string
): Promise<string | null> {
  try {
    const { data } = await octokit.repos.getCombinedStatusForRef({
      owner,
      repo,
      ref,
    });
    let vercelComUrl: string | null = null;
    for (const status of data.statuses) {
      const ctx = (status.context ?? "").toLowerCase();
      const url = status.target_url;
      if (!url || !(ctx.includes("vercel") || ctx.includes("preview") || url.includes("vercel.app") || url.includes("vercel.sh"))) continue;
      // Prefer actual deployment URLs over dashboard links
      if (url.includes("vercel.app") || url.includes("vercel.sh")) {
        return url;
      }
      vercelComUrl = vercelComUrl ?? url;
    }
    return vercelComUrl;
  } catch {
    // Ignore - commit statuses are optional
  }
  return null;
}

/**
 * Monitor a branch for deployment status and extract the Vercel URL
 * Supports both GitHub Deployments API and workflow completion fallback (for setups that don't create deployments)
 */
export async function monitorBranchDeployment(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string
): Promise<{
  status: "pending" | "success" | "failure" | "not_found";
  vercelUrl: string | null;
  workflowRunId: number | null;
  deploymentId: number | null;
}> {
  // First check if the branch exists
  const exists = await branchExists(octokit, owner, repo, branch);
  if (!exists) {
    console.log(`[github] Branch ${owner}/${repo}@${branch} not found`);
    return {
      status: "not_found",
      vercelUrl: null,
      workflowRunId: null,
      deploymentId: null,
    };
  }

  // Get branch head SHA (needed when no workflow runs - Vercel may use SHA for deployments/statuses)
  const branchHeadSha = await getBranchHeadSha(octokit, owner, repo, branch);

  // Get workflow runs to see if deployment is in progress
  const workflowRuns = await getWorkflowRunsForBranch(octokit, owner, repo, branch);
  const latestRun = workflowRuns[0];
  if (latestRun) {
    console.log(`[github] Workflow run #${latestRun.id} for ${owner}/${repo}@${branch}: status=${latestRun.status}, conclusion=${latestRun.conclusion ?? 'none'}`);
  }

  // Get deployments - try branch ref first, then SHA (Vercel often creates deployments with commit SHA)
  let deployments = await getDeploymentsForRef(octokit, owner, repo, branch);
  const shaToTry = latestRun?.head_sha ?? branchHeadSha;
  if (deployments.length === 0 && shaToTry) {
    deployments = await getDeploymentsForRef(octokit, owner, repo, shaToTry);
    if (deployments.length > 0) {
      console.log(`[github] Found ${deployments.length} deployment(s) for SHA ${shaToTry.slice(0, 7)}`);
    }
  }
  const latestDeployment = deployments[0];
  if (latestDeployment) {
    console.log(`[github] Deployment #${latestDeployment.id} for ${owner}/${repo}@${branch}: env=${latestDeployment.environment}`);
  }

  // If no deployment yet, check workflow status - FALLBACK for setups that don't create GitHub Deployments
  if (!latestDeployment) {
    if (!latestRun) {
      // No workflow runs (Vercel native integration doesn't use GitHub Actions) - check commit statuses
      // Vercel adds status checks with preview URL when it deploys
      if (branchHeadSha) {
        const vercelUrl = await getVercelUrlFromCommitStatus(octokit, owner, repo, branchHeadSha);
        if (vercelUrl) {
          console.log(`[github] Found Vercel URL from commit status for ${owner}/${repo}@${branch}`);
          return {
            status: "success",
            vercelUrl,
            workflowRunId: null,
            deploymentId: null,
          };
        }
      }
      console.log(`[github] No workflow runs, deployments, or Vercel status for ${owner}/${repo}@${branch} yet`);
      return {
        status: "not_found",
        vercelUrl: null,
        workflowRunId: null,
        deploymentId: null,
      };
    }
    if (latestRun.status === "completed" && latestRun.conclusion === "failure") {
      console.log(`[github] Workflow failed for ${branch} (run #${latestRun.id})`);
      return {
        status: "failure",
        vercelUrl: null,
        workflowRunId: latestRun.id,
        deploymentId: null,
      };
    }
    // FALLBACK: Workflow completed successfully but no GitHub Deployment - treat as success
    // (Common with Vercel for GitHub or vercel deploy in Actions that don't create deployments)
    if (latestRun.status === "completed" && latestRun.conclusion === "success") {
      const ref = latestRun.head_sha ?? branch;
      const vercelUrl = await getVercelUrlFromCommitStatus(octokit, owner, repo, ref);
      console.log(`[github] Workflow succeeded for ${branch} (no deployment record), vercelUrl from status: ${vercelUrl ?? 'none'}`);
      return {
        status: "success",
        vercelUrl,
        workflowRunId: latestRun.id,
        deploymentId: null,
      };
    }
    console.log(`[github] Workflow in progress for ${branch}, waiting for deployment...`);
    return {
      status: "pending",
      vercelUrl: null,
      workflowRunId: latestRun.id,
      deploymentId: null,
    };
  }

  // Get deployment status to extract the Vercel URL
  const deploymentStatus = await getDeploymentStatus(
    octokit,
    owner,
    repo,
    latestDeployment.id
  );

  if (!deploymentStatus) {
    console.log(`[github] Deployment #${latestDeployment.id} for ${branch}: no status yet`);
    return {
      status: "pending",
      vercelUrl: null,
      workflowRunId: latestRun?.id ?? null,
      deploymentId: latestDeployment.id,
    };
  }

  console.log(`[github] Deployment #${latestDeployment.id} for ${branch}: state=${deploymentStatus.state}, url=${deploymentStatus.environment_url ?? 'none'}`);

  // Map deployment state to our status
  let status: "pending" | "success" | "failure" | "not_found";
  if (deploymentStatus.state === "success") {
    status = "success";
  } else if (deploymentStatus.state === "failure" || deploymentStatus.state === "error") {
    status = "failure";
  } else {
    status = "pending";
  }

  return {
    status,
    vercelUrl: deploymentStatus.environment_url,
    workflowRunId: latestRun?.id ?? null,
    deploymentId: latestDeployment.id,
  };
}
