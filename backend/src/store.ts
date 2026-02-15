/**
 * In-memory job store. Replace with DB (e.g. Postgres) for production.
 */

export type AgentStatus =
  | "initializing"     // Agent is starting up
  | "developing"       // Agent is working on code
  | "pushing"          // Agent is pushing code to GitHub
  | "deploying"        // GitHub Action is deploying to Vercel
  | "ready"            // Deployment succeeded, preview available
  | "deployment_failed"// Deployment failed but code was pushed
  | "failed";          // Agent or push failed
export type JobStatus = "processing" | "review_needed" | "completed";

export interface Agent {
  id: string;
  runId: string;
  status: AgentStatus;
  terminalLogs: string[];
  deploymentUrl: string | null;
  deploymentDetailsUrl: string | null;
  sessionLink: string | null;
  stagehandVerify: { passed: boolean; reason: string } | null;
  branchName: string;  // The branch this agent is working on
  modelId?: string;   // Model used to generate this agent

  deploymentStatus: {
    workflowRunId: string | null;
    deploymentId: string | null;
    lastCheckedAt: string | null;
  } | null;
}

export interface Job {
  id: string;
  issueId: number;
  repoName: string;
  status: JobStatus;
  createdAt: string;
  issueTitle: string;
  issueDescription: string;
  agents: Agent[];
  githubRepoOwner?: string;
  githubRepoName?: string;
}

const jobs = new Map<string, Job>();

/** Generate a short job ID: first 8 characters of a UUID (no hyphens) */
export function generateJobId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

export function createJob(params: {
  jobId: string;
  issueId: number;
  repoName: string;
  issueTitle: string;
  issueDescription: string;
  runIds: string[];
  sessionLinks: (string | null)[];
  branchNames: string[];
  modelIds?: string[];
  githubRepoOwner?: string;
  githubRepoName?: string;
}): Job {
  const id = params.jobId;
  const agents: Agent[] = params.runIds.map((runId, i) => ({
    id: `agent_${["alpha", "beta", "gamma", "delta", "epsilon"][i] ?? `run_${i}`}`,
    runId,
    status: "initializing" as AgentStatus,
    terminalLogs: ["Agent started...", "Connecting to Warp..."],
    deploymentUrl: null,
    deploymentDetailsUrl: null,
    sessionLink: params.sessionLinks[i] ?? null,
    stagehandVerify: null,
    branchName: params.branchNames[i],
    modelId: params.modelIds?.[i],
    deploymentStatus: null,
  }));

  const job: Job = {
    id,
    issueId: params.issueId,
    repoName: params.repoName,
    status: "processing",
    createdAt: new Date().toISOString(),
    issueTitle: params.issueTitle,
    issueDescription: params.issueDescription,
    agents,
    githubRepoOwner: params.githubRepoOwner,
    githubRepoName: params.githubRepoName,
  };

  jobs.set(id, job);
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function listJobs(): Job[] {
  return Array.from(jobs.values()).sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function updateAgent(
  jobId: string,
  runId: string,
  updates: Partial<
    Pick<Agent, "status" | "terminalLogs" | "deploymentUrl" | "deploymentDetailsUrl" | "sessionLink" | "stagehandVerify" | "deploymentStatus">
  >
): void {
  const job = jobs.get(jobId);
  if (!job) return;
  const agent = job.agents.find((a) => a.runId === runId);
  if (!agent) return;
  Object.assign(agent, updates);
}

export function updateJobStatus(jobId: string, status: JobStatus): void {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = status;
}

export function getAgentByRunId(
  runId: string
): { job: Job; agent: Agent } | undefined {
  for (const job of jobs.values()) {
    const agent = job.agents.find((a) => a.runId === runId);
    if (agent) return { job, agent };
  }
  return undefined;
}
