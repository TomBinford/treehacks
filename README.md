Our TreeHacks project is Arena, an orchestration tool that makes agents compete to write the software that best serves you.

Traditional coding agents on GitHub result in one-shot PRs that require feedback iterations and sometimes are so bad that it's easier to start over. Arena overcomes this by 

To use:
- Have a repository in mind that is deployed to Vercel
- Follow the comments in .env.example to set up your backend .env
- From the repository root, run `npm install`, `npm run build` and `npm run dev`
- Go to localhost:3000 and add the bot to the repository you want the agents to work on
- Get a Warp account and set up an Oz environment with your preferred container. Use its ID for `WARP_ENVIRONMENT_ID`.
- Go to localhost:3001 and define a job!

Our devpost: https://devpost.com/software/arena-lz2m84
