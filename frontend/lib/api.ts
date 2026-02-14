import type { Job, JobDetail, SelectWinnerRequest } from './types';

const API_BASE = '/api';

// Mock data for development when backend is unavailable
const MOCK_JOBS: Job[] = [
  {
    id: 'job_123',
    issueId: 45,
    repoName: 'my-org/marketing-site',
    status: 'review_needed',
    createdAt: '2023-10-27T10:00:00Z',
    issueTitle: 'Fix navbar alignment on mobile',
  },
  {
    id: 'job_456',
    issueId: 12,
    repoName: 'acme/dashboard',
    status: 'processing',
    createdAt: '2023-10-27T11:30:00Z',
    issueTitle: 'Add dark mode toggle',
  },
];

const MOCK_JOB_DETAIL: JobDetail = {
  id: 'job_123',
  issueId: 45,
  repoName: 'my-org/marketing-site',
  status: 'review_needed',
  createdAt: '2023-10-27T10:00:00Z',
  issueTitle: 'Fix navbar alignment on mobile',
  issueDescription:
    'The hamburger menu overlaps the logo on mobile viewports. Please fix the z-index and ensure proper spacing.',
  agents: [
    {
      id: 'agent_alpha',
      status: 'ready',
      terminalLogs: [
        '> npm run build',
        '✓ Build complete',
        'Deploying to Vercel...',
        '✓ Deployment ready',
      ],
      vercelUrl: 'https://vercel.com',
      sessionLink: 'https://app.warp.dev',
      stagehandVerify: {
        passed: true,
        reason: 'Navbar does not overlap logo on mobile viewport',
      },
    },
    {
      id: 'agent_beta',
      status: 'ready',
      terminalLogs: [
        '> git checkout -b arena/beta-fix',
        '> npm install',
        '> npm run build',
        '✓ Build complete',
        'Deploying to Vercel...',
        '✓ Deployment ready',
      ],
      vercelUrl: 'https://vercel.com',
      sessionLink: 'https://app.warp.dev',
      stagehandVerify: {
        passed: true,
        reason: 'Verified that the header is now blue and properly aligned',
      },
    },
    {
      id: 'agent_gamma',
      status: 'developing',
      terminalLogs: [
        '> npm run build',
        'Building...',
        'Compiling components...',
      ],
      vercelUrl: null,
      sessionLink: 'https://app.warp.dev',
      stagehandVerify: null,
    },
  ],
};

async function fetchWithMockFallback<T>(
  url: string,
  mockData: T
): Promise<T> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch {
    return mockData;
  }
}

export async function fetchJobs(): Promise<Job[]> {
  return fetchWithMockFallback(`${API_BASE}/jobs`, MOCK_JOBS);
}

export async function fetchJobDetail(id: string): Promise<JobDetail> {
  return fetchWithMockFallback(`${API_BASE}/jobs/${id}`, {
    ...MOCK_JOB_DETAIL,
    id,
  });
}

export interface CreateJobRequest {
  repoName: string;
  issueTitle: string;
  issueDescription: string;
  issueId?: number;
}

export async function createJob(payload: CreateJobRequest): Promise<{ jobId: string; arenaUrl: string }> {
  const res = await fetch(`${API_BASE}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      issueId: payload.issueId ?? 0,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Failed to create job: ${res.statusText}`);
  }
  const data = (await res.json()) as { jobId: string; arenaUrl: string };
  return data;
}

export async function selectWinner(
  jobId: string,
  payload: SelectWinnerRequest
): Promise<void> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Failed to select winner: ${res.statusText}`);
  }
}
