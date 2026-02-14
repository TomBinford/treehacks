import type { Router } from "express";
import express from "express";
import { WarpClient, type RunState } from "./warp.js";
import {
  createJob,
  getJob,
  listJobs,
  updateAgent,
  updateJobStatus,
  getAgentByRunId,
  type AgentStatus,
} from "./store.js";

const WARP_API_KEY = process.env.WARP_API_KEY;
const ARENA_UI_URL = process.env.ARENA_UI_URL ?? "http://localhost:3000";
const NUM_AGENTS = parseInt(process.env.NUM_AGENTS ?? "3", 10);

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
      return "failed";
    case "INPROGRESS":
    case "CLAIMED":
      return "deploying";
    default:
      return "coding";
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

        updateAgent(jobId, runId, {
          status: newStatus,
          terminalLogs: [
            ...agent.terminalLogs.slice(0, -1),
            run.status_message?.message ?? `State: ${run.state}`,
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

export function createJobAndSpawnAgents(params: {
  issueId: number;
  repoName: string;
  issueTitle: string;
  issueDescription: string;
  githubRepoOwner?: string;
  githubRepoName?: string;
}): Promise<{
  jobId: string;
  arenaUrl: string;
  sessionLinks: (string | null)[];
}> {
  if (!WARP_API_KEY) {
    throw new Error("WARP_API_KEY not configured");
  }

  const warp = new WarpClient(WARP_API_KEY);
  const prompt = `GitHub Issue: ${params.issueTitle}\n\n${params.issueDescription}\n\nPlease implement a fix for this issue. Create a branch, make the necessary changes, and deploy a preview.`;

  const runIds: string[] = [];
  const sessionLinks: (string | null)[] = [];

  return (async () => {
    for (let i = 0; i < NUM_AGENTS; i++) {
      const { run_id } = await warp.runAgent(prompt, {
        title: `Arena: ${params.issueTitle} (Agent ${i + 1}/${NUM_AGENTS})`,
        config: { name: `arena-issue-${params.issueId}` },
      });
      runIds.push(run_id);
      try {
        const run = await warp.getRun(run_id);
        sessionLinks.push(run.session_link ?? null);
      } catch {
        sessionLinks.push(null);
      }
    }

    const job = createJob({
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

    try {
      const data = await createJobAndSpawnAgents({
        issueId,
        repoName,
        issueTitle,
        issueDescription,
        githubRepoOwner: owner,
        githubRepoName: repo,
      });
      return res.status(201).json(data);
    } catch (err) {
      console.error("Failed to spawn Warp agents:", err);
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
