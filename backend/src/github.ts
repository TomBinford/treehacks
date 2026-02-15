/**
 * GitHub API client for monitoring deployments and workflow runs
 * Uses Probot's built-in Octokit for authentication
 */

import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";

// TODO: Ensure these environment variables are set in .env:
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
export async function createGitHubClient(installationId?: number): Promise<Octokit> {
  if (!APP_ID || !PRIVATE_KEY) {
    throw new Error("GitHub App credentials (APP_ID, PRIVATE_KEY) not configured");
  }

  const appOctokit = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: APP_ID,
      privateKey: PRIVATE_KEY,
    },
  });

  // If no installation ID provided, use the first installation
  if (!installationId) {
    const { data: installations } = await appOctokit.apps.listInstallations();
    if (installations.length === 0) {
      throw new Error("GitHub App has no installations");
    }
    installationId = installations[0].id;
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

/**
 * Get the latest workflow runs for a specific branch
 */
export async function getWorkflowRunsForBranch(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string
): Promise<WorkflowRun[]> {
  try {
    const { data } = await octokit.actions.listWorkflowRunsForRepo({
      owner,
      repo,
      branch,
      per_page: 10,
    });
    return data.workflow_runs.map((run) => ({
      id: run.id,
      status: run.status,
      conclusion: run.conclusion,
      html_url: run.html_url,
    }));
  } catch (err) {
    console.error(`[github] Failed to get workflow runs for ${owner}/${repo}@${branch}:`, err);
    return [];
  }
}

/**
 * Get deployments for a specific branch
 */
export async function getDeploymentsForBranch(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string
): Promise<Deployment[]> {
  try {
    const { data } = await octokit.repos.listDeployments({
      owner,
      repo,
      ref: branch,
      per_page: 10,
    });
    return data.map((deployment) => ({
      id: deployment.id,
      environment: deployment.environment,
      state: (typeof deployment.payload === 'object' && deployment.payload !== null && 'state' in deployment.payload)
        ? String(deployment.payload.state)
        : "unknown",
      statuses_url: deployment.statuses_url,
    }));
  } catch (err) {
    console.error(`[github] Failed to get deployments for ${owner}/${repo}@${branch}:`, err);
    return [];
  }
}

/**
 * Get the latest deployment status for a deployment
 * This is where we extract the Vercel preview URL
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
      per_page: 1,
    });
    if (data.length === 0) return null;

    const status = data[0];
    return {
      state: status.state,
      environment_url: status.environment_url ?? null,
      log_url: status.log_url ?? null,
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
 * Monitor a branch for deployment status and extract the Vercel URL
 * Returns the deployment URL if found, null otherwise
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

  // Get workflow runs to see if deployment is in progress
  const workflowRuns = await getWorkflowRunsForBranch(octokit, owner, repo, branch);
  const latestRun = workflowRuns[0];
  if (latestRun) {
    console.log(`[github] Workflow run #${latestRun.id} for ${branch}: status=${latestRun.status}, conclusion=${latestRun.conclusion ?? 'none'}`);
  }

  // Get deployments to extract the Vercel URL
  const deployments = await getDeploymentsForBranch(octokit, owner, repo, branch);
  const latestDeployment = deployments[0];
  if (latestDeployment) {
    console.log(`[github] Deployment #${latestDeployment.id} for ${branch}: env=${latestDeployment.environment}`);
  }

  // If no deployment yet, check workflow status
  if (!latestDeployment) {
    if (!latestRun) {
      console.log(`[github] No workflow runs or deployments for ${branch} yet`);
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
