import { Probot, Context } from "probot";
import type { ApplicationFunctionOptions } from "probot";
import { createJobAndSpawnAgents, mountArenaRoutes } from "./arena.js";

export default (app: Probot, options: ApplicationFunctionOptions) => {
  if (options.getRouter) {
    const router = options.getRouter("/api");
    mountArenaRoutes(router);
  }

  const ARENA_TRIGGER = /arena\b/i;

  async function spawnAndReply(
    context: Context<"issue_comment.created">,
    params: { issueId: number; repoName: string; issueTitle: string; issueDescription: string; githubRepoOwner: string; githubRepoName: string }
  ) {
    try {
      const { arenaUrl, sessionLinks } = await createJobAndSpawnAgents(params);
      const watchSection =
        sessionLinks.filter(Boolean).length > 0
          ? `\n\n**Watch agents live:**\n${sessionLinks.filter(Boolean).map((link, i) => `- [Agent ${i + 1}](${link})`).join("\n")}`
          : "";
      await context.octokit.issues.createComment(
        context.issue({
          body: `🚀 **Arena is on it!** ${sessionLinks.length} Warp agent(s) are working on this.\n\n**[View progress →](${arenaUrl})**${watchSection}`,
        })
      );
    } catch (err) {
      console.error("Failed to create arena job:", err);
      await context.octokit.issues.createComment(
        context.issue({
          body: `⚠️ Arena could not start agents. Please check WARP_API_KEY is set.\n\nError: ${err instanceof Error ? err.message : String(err)}`,
        })
      );
    }
  }

  app.on("issue_comment.created", async (context) => {
    const { comment, issue, repository } = context.payload;
    if (issue.pull_request) return; // only issues, not PRs
    if (!ARENA_TRIGGER.test(comment.body)) return;

    const [owner, repo] = repository.full_name.split("/");
    const issueDescription = `${issue.body ?? ""}\n\n---\nRequested changes (from comment):\n${comment.body}`.trim();

    await spawnAndReply(context, {
      issueId: issue.number,
      repoName: repository.full_name,
      issueTitle: issue.title,
      issueDescription,
      githubRepoOwner: owner,
      githubRepoName: repo,
    });
  });
};
