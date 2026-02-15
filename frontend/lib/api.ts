import type { Job, JobDetail } from './types';

const API_BASE = '/api';

export async function fetchJobs(): Promise<Job[]> {
  try {
    const res = await fetch(`${API_BASE}/jobs`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as Job[];
  } catch {
    return [];
  }
}

export async function fetchJobDetail(id: string): Promise<JobDetail> {
  const res = await fetch(`${API_BASE}/jobs/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as JobDetail;
}

export interface AgentSlot {
  count: number;
  modelId: string;
}

export interface CreateJobRequest {
  repoName: string;
  issueTitle: string;
  issueDescription: string;
  issueId?: number;
  agentConfigs?: AgentSlot[];
}

export async function createJob(payload: CreateJobRequest): Promise<{ jobId: string; arenaUrl: string }> {
  const body: Record<string, unknown> = {
    ...payload,
    issueId: payload.issueId ?? 0,
  };
  if (payload.agentConfigs && payload.agentConfigs.length > 0) {
    body.agentConfigs = payload.agentConfigs;
  }
  const res = await fetch(`${API_BASE}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Failed to create job: ${res.statusText}`);
  }
  const data = (await res.json()) as { jobId: string; arenaUrl: string };
  return data;
}

export interface CreatePRsResponse {
  prs: Array<{ agentId: string; htmlUrl: string; number: number; draft: boolean }>;
}

export async function createPRs(
  jobId: string,
  agentIds: string[]
): Promise<CreatePRsResponse> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/create-prs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentIds }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Failed to create PRs: ${res.statusText}`);
  }
  return res.json() as Promise<CreatePRsResponse>;
}
