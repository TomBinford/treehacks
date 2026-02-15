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
}

export interface JobDetail extends Job {
  issueTitle: string;
  issueDescription: string;
  agents: Agent[];
}

export interface SelectWinnerRequest {
  winnerAgentId: string;
}
