import { Probot } from "probot";

export default (app: Probot) => {
  app.on("issues.opened", async (context) => {
    const issueComment = context.issue({
      body: "Thanks for opening this issue!",
    });
    await context.octokit.issues.createComment(issueComment);
  });

  // TODO run this code when the user has chosen a winning branch
  /*
  // Properties of the installation
  const installationId = 110161046;
  const repoOwner = "TomBinford";
  const repoName = "treehacks-testing-repo";
  const mainBranch = "main";

  // Properties of the arena / its winner
  const arenaPurpose = "TODO short purpose";
  // null if the arena was created by a prompt, otherwise the issue number it is responding to
  const arenaIssue: number | null = null;
  const winningBranch = "test-winning-branch";

  app.auth(installationId).then((github) => {
    github.pulls.create({
      owner: repoOwner,
      repo: repoName,
      title: arenaPurpose,
      head: winningBranch,
      base: mainBranch,
      // TODO link to the arena in our frontend
      body: (arenaIssue
        ? `This PR created by TreeHacks Vibe Bot. Addresses #${arenaIssue}.`
        : "This PR created by TreeHacks Vibe Bot."),
    });
  });
  */

  // For more information on building apps:
  // https://probot.github.io/docs/

  // To get your app running against GitHub, see:
  // https://probot.github.io/docs/development/
};
