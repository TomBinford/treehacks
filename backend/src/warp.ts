/**
 * Warp Oz Agent API client
 * https://app.warp.dev/api/v1
 */

const WARP_API_BASE = "https://app.warp.dev/api/v1";

export type RunState =
  | "QUEUED"
  | "PENDING"
  | "CLAIMED"
  | "INPROGRESS"
  | "SUCCEEDED"
  | "FAILED";

export interface RunAgentResponse {
  run_id: string;
  state: RunState;
}

export interface RunItem {
  run_id: string;
  title: string;
  state: RunState;
  prompt: string;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  status_message?: { message: string };
  source: string;
  session_id?: string;
  session_link?: string;
  creator?: { type: string; uid: string };
  agent_config?: Record<string, unknown>;
}

export interface ListRunsResponse {
  runs: RunItem[];
  page_info: { has_next_page: boolean; next_cursor?: string };
}

export class WarpClient {
  constructor(private apiKey: string) {
    if (!apiKey) {
      throw new Error("WARP_API_KEY is required");
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: object
  ): Promise<T> {
    const url = `${WARP_API_BASE}${path}`;
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Warp API ${res.status}: ${errText}`);
    }

    return res.json() as Promise<T>;
  }

  async runAgent(
    prompt: string,
    options?: {
      title?: string;
      config?: { name?: string; model_id?: string };
    }
  ): Promise<RunAgentResponse> {
    const body: Record<string, unknown> = { prompt };
    if (options?.title) body.title = options.title;
    if (options?.config) body.config = options.config;
    return this.request<RunAgentResponse>("POST", "/agent/run", body);
  }

  async getRun(runId: string): Promise<RunItem> {
    return this.request<RunItem>("GET", `/agent/runs/${runId}`);
  }

  async listRuns(params?: {
    limit?: number;
    cursor?: string;
    state?: RunState | RunState[];
    created_after?: string;
  }): Promise<ListRunsResponse> {
    const search = new URLSearchParams();
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.cursor) search.set("cursor", params.cursor);
    if (params?.state) {
      const states = Array.isArray(params.state) ? params.state : [params.state];
      states.forEach((s) => search.append("state", s));
    }
    if (params?.created_after) search.set("created_after", params.created_after);
    const qs = search.toString();
    return this.request<ListRunsResponse>(
      "GET",
      `/agent/runs${qs ? `?${qs}` : ""}`
    );
  }
}
