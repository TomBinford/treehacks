/**
 * Warp Oz Agent API client
 * Uses the official oz-agent-sdk: https://github.com/warpdotdev/oz-sdk-typescript
 */

import OzAPI from "oz-agent-sdk";

// Run states from Oz Agent API (matches SDK RunState)
export type RunState =
  | "QUEUED"
  | "PENDING"
  | "CLAIMED"
  | "INPROGRESS"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED";

export type RunItem = Awaited<
  ReturnType<InstanceType<typeof OzAPI>["agent"]["runs"]["retrieve"]>
>;

export interface RunAgentResponse {
  run_id: string;
  state: RunState;
}

export interface ListRunsResponse {
  runs: RunItem[];
  page_info: { has_next_page: boolean; next_cursor?: string };
}

export class WarpClient {
  private client: OzAPI;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("WARP_API_KEY is required");
    }
    this.client = new OzAPI({ apiKey });
  }

  async runAgent(
    prompt: string,
    options?: {
      title?: string;
      config?: { name?: string; model_id?: string; environment_id?: string };
    }
  ): Promise<RunAgentResponse> {
    const body = {
      prompt,
      title: options?.title,
      config: options?.config,
    };
    console.log("[warp] runAgent request config:", JSON.stringify(body.config, null, 2));
    const response = await this.client.agent.run(body);
    console.log("[warp] runAgent response:", { run_id: response.run_id, state: response.state });
    return { run_id: response.run_id, state: response.state };
  }

  async getRun(runId: string): Promise<RunItem> {
    const run = await this.client.agent.runs.retrieve(runId);
    if (run.state === "FAILED" && run.status_message?.message) {
      console.log("[warp] getRun", runId, "FAILED:", run.status_message.message);
    }
    return run;
  }

  async listRuns(params?: {
    limit?: number;
    cursor?: string;
    state?: RunState | RunState[];
    created_after?: string;
    config_name?: string;
    model_id?: string;
    creator?: string;
    source?: string;
    created_before?: string;
  }): Promise<ListRunsResponse> {
    const query: Parameters<OzAPI["agent"]["runs"]["list"]>[0] = {};
    if (params?.limit != null) query.limit = params.limit;
    if (params?.cursor) query.cursor = params.cursor;
    if (params?.state) {
      query.state = Array.isArray(params.state) ? params.state : [params.state];
    }
    if (params?.created_after) query.created_after = params.created_after;
    if (params?.config_name) query.name = params.config_name;
    if (params?.model_id) query.model_id = params.model_id;
    if (params?.creator) query.creator = params.creator;
    if (params?.source) query.source = params.source as never;
    if (params?.created_before) query.created_before = params.created_before;

    return this.client.agent.runs.list(query ?? undefined);
  }
}
