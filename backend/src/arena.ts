import type { Router } from "express";
import express from "express";
import { WarpClient, type RunState } from "./warp.js";
import {
  createJob,
  generateJobId,
  getJob,
  listJobs,
  updateAgent,
  updateJobStatus,
  getAgentByRunId,
  type AgentStatus,
} from "./store.js";

const WARP_API_KEY = process.env.WARP_API_KEY;
const WARP_ENVIRONMENT_ID = process.env.WARP_ENVIRONMENT_ID;
const ARENA_UI_URL = process.env.ARENA_UI_URL ?? "http://localhost:3000";

/** Default agent config when not specified (e.g. GitHub trigger) */
const DEFAULT_AGENT_CONFIG = [{ count: 1, modelId: "claude-4-sonnet" }];

// Debug: log env config on startup
console.log("[arena] WARP_ENVIRONMENT_ID:", WARP_ENVIRONMENT_ID ?? "(not set)");
console.log("[arena] WARP_API_KEY:", WARP_API_KEY ? "***" + WARP_API_KEY.slice(-4) : "(not set)");

const MONITOR_POLL_MS = 10_000;
const MAJORITY_THRESHOLD = 0.5;
const IDLE_TIMEOUT_MS = 60_000;
const MAX_WAIT_MS = 30 * 60 * 1000;

const monitoredJobs = new Map<
  string,
  { runIds: string[]; startedAt: number; lastFinisherAt: number }
>();

function warpStateToAgentStatus(state: RunState): AgentStatus {
  switch (state) {
    case "SUCCEEDED":
      return "ready";
    case "FAILED":
    case "CANCELLED":
      return "failed";
    case "INPROGRESS":
      return "developing";
    case "QUEUED":
    case "PENDING":
    case "CLAIMED":
      return "initializing";
    default:
      return "initializing";
  }
}

function toListJob(job: NonNullable<ReturnType<typeof getJob>>) {
  return {
    id: job.id,
    issueId: job.issueId,
    repoName: job.repoName,
    status: job.status,
    createdAt: job.createdAt,
    issueTitle: job.issueTitle,
  };
}

function toDetailJob(job: NonNullable<ReturnType<typeof getJob>>) {
  return {
    ...toListJob(job),
    issueDescription: job.issueDescription,
    agents: job.agents.map((a) => ({
      id: a.id,
      status: a.status,
      terminalLogs: a.terminalLogs,
      vercelUrl: a.vercelUrl,
      sessionLink: a.sessionLink,
      stagehandVerify: a.stagehandVerify,
    })),
  };
}

async function monitorRuns(): Promise<void> {
  if (!WARP_API_KEY) return;
  const warp = new WarpClient(WARP_API_KEY);

  for (const [jobId, meta] of monitoredJobs) {
    const job = getJob(jobId);
    if (!job || job.status === "completed") {
      monitoredJobs.delete(jobId);
      continue;
    }

    let anyUpdate = false;
    for (const runId of meta.runIds) {
      try {
        const run = await warp.getRun(runId);
        const entry = getAgentByRunId(runId);
        if (!entry) continue;
        const { agent } = entry;

        const newStatus = warpStateToAgentStatus(run.state);
        if (newStatus !== agent.status) {
          anyUpdate = true;
          if (newStatus === "ready" || newStatus === "failed") {
            meta.lastFinisherAt = Date.now();
          }
        }

        const statusMsg = run.status_message?.message ?? `State: ${run.state}`;
        if (newStatus === "failed") {
          console.log("[arena] Run", runId, "FAILED:", statusMsg);
        } else if (newStatus !== agent.status) {
          console.log("[arena] Run", runId, "status:", agent.status, "->", newStatus, statusMsg);
        }
        updateAgent(jobId, runId, {
          status: newStatus,
          terminalLogs: [
            ...agent.terminalLogs.slice(0, -1),
            statusMsg,
          ],
          sessionLink: run.session_link ?? agent.sessionLink,
          vercelUrl: newStatus === "ready" ? agent.vercelUrl : agent.vercelUrl,
          stagehandVerify:
            newStatus === "ready"
              ? { passed: true, reason: "Agent completed successfully" }
              : agent.stagehandVerify,
        });
      } catch (err) {
        console.error(`Monitor run ${runId}:`, err);
      }
    }

    if (!anyUpdate) continue;

    const job2 = getJob(jobId);
    if (!job2) continue;

    const finished = job2.agents.filter(
      (a) => a.status === "ready" || a.status === "failed"
    ).length;
    const total = job2.agents.length;
    const majorityReached = finished >= Math.ceil(total * MAJORITY_THRESHOLD);
    const elapsed = Date.now() - meta.startedAt;
    const idleSinceLast = Date.now() - meta.lastFinisherAt;
    const maxWaitReached = elapsed >= MAX_WAIT_MS;
    const idleTimeoutReached =
      majorityReached &&
      meta.lastFinisherAt > 0 &&
      idleSinceLast >= IDLE_TIMEOUT_MS;

    if (
      finished === total ||
      maxWaitReached ||
      (majorityReached && idleTimeoutReached)
    ) {
      updateJobStatus(jobId, "review_needed");
      monitoredJobs.delete(jobId);
    }
  }
}

setInterval(monitorRuns, MONITOR_POLL_MS);
setTimeout(monitorRuns, 2000);

export interface AgentSlot {
  count: number;
  modelId: string;
}

export function createJobAndSpawnAgents(params: {
  issueId: number;
  repoName: string;
  issueTitle: string;
  issueDescription: string;
  githubRepoOwner?: string;
  githubRepoName?: string;
  agentConfigs?: AgentSlot[];
}): Promise<{
  jobId: string;
  arenaUrl: string;
  sessionLinks: (string | null)[];
}> {
  if (!WARP_API_KEY) {
    throw new Error("WARP_API_KEY not configured");
  }

  const warp = new WarpClient(WARP_API_KEY);
  const jobId = generateJobId();

  const runIds: string[] = [];
  const sessionLinks: (string | null)[] = [];

  const agentConfigs = params.agentConfigs ?? DEFAULT_AGENT_CONFIG;
  const totalAgents = agentConfigs.reduce((sum, s) => sum + s.count, 0);

  console.log("[arena] Creating job", jobId, "agentConfigs:", JSON.stringify(agentConfigs));
  console.log("[arena] WARP_ENVIRONMENT_ID being used:", WARP_ENVIRONMENT_ID ?? "(none - running without environment)");

  return (async () => {
    let agentNum = 0;
    for (const slot of agentConfigs) {
      for (let c = 0; c < slot.count; c++) {
        agentNum++;
        const branchName = `${jobId}-${agentNum}`;

        const baseConfig = {
          name: `arena-${jobId}`,
          model_id: slot.modelId,
          ...(WARP_ENVIRONMENT_ID && { environment_id: WARP_ENVIRONMENT_ID }),
        };

        const repoContext = WARP_ENVIRONMENT_ID
          ? `\n\nThe repository (${params.repoName}) has been cloned and is available in your workspace. You can immediately explore the files and start coding—no need to clone or set up the repo.`
          : `\n\nRepository: ${params.repoName}`;

        const prompt = `Repository: ${params.repoName}

GitHub Issue: ${params.issueTitle}

${params.issueDescription}
${repoContext}

Instructions:
- You are working on the repository \`${params.repoName}\`—all changes must target this repo
- Create a branch named \`${branchName}\` for your pull request (e.g. \`git checkout -b ${branchName}\`)
- Implement the requested change or feature
- Commit your work to \`${branchName}\` and push to origin when ready
- Do NOT create a pull request for your work. The human will review your branch and decide whether to open a PR.`;

        console.log("[arena] Spawning agent", agentNum, "/", totalAgents, "model:", slot.modelId);
        const { run_id, state } = await warp.runAgent(prompt, {
          title: `Arena: ${params.issueTitle} (Agent ${agentNum}/${totalAgents})`,
          config: baseConfig,
        });
        console.log("[arena] Agent spawned run_id:", run_id, "state:", state);
        runIds.push(run_id);
        try {
          const run = await warp.getRun(run_id);
          console.log("[arena] Run", run_id, "session_link:", run.session_link ?? "(none)", "status_message:", run.status_message?.message ?? "(none)");
          sessionLinks.push(run.session_link ?? null);
        } catch (err) {
          console.warn("[arena] Failed to fetch run", run_id, ":", err);
          sessionLinks.push(null);
        }
      }
    }

    const job = createJob({
      jobId,
      ...params,
      runIds,
      sessionLinks,
    });

    monitoredJobs.set(job.id, {
      runIds,
      startedAt: Date.now(),
      lastFinisherAt: 0,
    });

    return {
      jobId: job.id,
      arenaUrl: `${ARENA_UI_URL}/jobs/${job.id}`,
      sessionLinks: job.agents.map((a) => a.sessionLink),
    };
  })();
}

export function mountArenaRoutes(router: Router): void {
  router.use(express.json());

  router.post("/jobs", async (req, res) => {
    const {
      issueId = 0,
      repoName,
      issueTitle,
      issueDescription,
      githubRepoOwner,
      githubRepoName,
      agentConfigs,
    } = req.body;

    if (!repoName || !issueTitle || !issueDescription) {
      return res.status(400).json({
        error:
          "Missing required fields: repoName, issueTitle, issueDescription",
      });
    }

    const [owner, repo] =
      githubRepoOwner && githubRepoName
        ? [githubRepoOwner, githubRepoName]
        : repoName.includes("/")
          ? repoName.split("/")
          : ["", repoName];

    if (!WARP_API_KEY) {
      return res.status(503).json({
        error: "WARP_API_KEY not configured. Set it in .env to spawn agents.",
      });
    }

    let validatedConfigs: AgentSlot[] | undefined;
    if (agentConfigs && Array.isArray(agentConfigs) && agentConfigs.length > 0) {
      const total = agentConfigs.reduce((sum: number, s: { count?: number }) => sum + Math.max(1, Math.min(10, parseInt(String(s.count ?? 1), 10) || 1)), 0);
      if (total < 1 || total > 10) {
        return res.status(400).json({
          error: "Total agents must be between 1 and 10",
        });
      }
      validatedConfigs = agentConfigs.map((s: { count?: number; modelId?: string }) => ({
        count: Math.max(1, Math.min(10, parseInt(String(s.count ?? 1), 10) || 1)),
        modelId: typeof s.modelId === "string" && s.modelId ? s.modelId : "claude-4-sonnet",
      }));
    }

    try {
      console.log("[arena] POST /jobs", { repoName, issueTitle, agentConfigs: validatedConfigs });
      const data = await createJobAndSpawnAgents({
        issueId,
        repoName,
        issueTitle,
        issueDescription,
        githubRepoOwner: owner,
        githubRepoName: repo,
        agentConfigs: validatedConfigs,
      });
      console.log("[arena] Job created:", data.jobId, "arenaUrl:", data.arenaUrl);
      return res.status(201).json(data);
    } catch (err) {
      console.error("[arena] Failed to spawn Warp agents:", err);
      return res.status(502).json({
        error: "Failed to spawn Warp agents",
        details: err instanceof Error ? err.message : String(err),
      });
    }
  });

  router.get("/jobs", (_req, res) => {
    res.json(listJobs().map(toListJob));
  });

  router.get("/jobs/:id", (req, res) => {
    const job = getJob(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    return res.json(toDetailJob(job));
  });

  router.post("/jobs/:id/select", (req, res) => {
    const { winnerAgentId } = req.body;
    if (!winnerAgentId) {
      return res.status(400).json({ error: "winnerAgentId required" });
    }
    const job = getJob(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    if (!job.agents.some((a) => a.id === winnerAgentId)) {
      return res.status(400).json({ error: "Agent not found" });
    }
    updateJobStatus(req.params.id, "completed");
    return res.json({ ok: true });
  });
}
