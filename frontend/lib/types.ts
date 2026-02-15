// API types - matches backend contract

export type JobStatus = 'processing' | 'review_needed' | 'completed';

export type AgentStatus =
  | 'initializing'
  | 'developing'
  | 'pushing'
  | 'deploying'
  | 'ready'
  | 'deployment_failed'
  | 'failed';

export interface Job {
  id: string;
  issueId: number;
  repoName: string;
  status: JobStatus;
  createdAt: string;
  issueTitle?: string; // Optional - backend may include for list view
}

export interface StagehandVerify {
  passed: boolean;
  reason: string;
}

export interface Agent {
  id: string;
  status: AgentStatus;
  terminalLogs: string[];
  vercelUrl: string | null;
  /** Link to watch the agent session in Warp (when vercelUrl not yet available) */
  sessionLink?: string | null;
  stagehandVerify: StagehandVerify | null;
  /** Model used to generate this agent (e.g. claude-4-sonnet) */
  modelId?: string | null;
}

export interface JobDetail extends Job {
  issueTitle: string;
  issueDescription: string;
  agents: Agent[];
  /** Agent IDs that were selected as winners (PRs created) */
  winnerAgentIds?: string[];
  /** Map of agentId -> PR HTML URL */
  prUrls?: Record<string, string>;
}

