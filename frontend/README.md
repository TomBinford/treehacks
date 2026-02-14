# Arena Frontend

Next.js app for the Arena UI. Shows jobs (GitHub issues) and their Warp agent runs.

## Setup

```bash
cd frontend && npm install
```

## Running

**Option A: Run everything together**

From the project root:

```bash
npm run dev
```

This starts both the Probot backend (port 3000) and this frontend (port 3001).

**Option B: Run separately**

Terminal 1 – Probot backend:

```bash
npm start
# or: probot run ./lib/index.js
```

Terminal 2 – Frontend:

```bash
cd frontend && npm run dev
```

## Test flow

1. **Start Smee** (if not already) – forwards GitHub webhooks to localhost. Use your `WEBHOOK_PROXY_URL` from `.env`:
   ```bash
   npx smee-client -u $WEBHOOK_PROXY_URL -t http://localhost:3000
   ```

2. **Start the app** – from project root: `npm run dev` (runs both backend + frontend), or run `npm start` and `cd frontend && npm run dev` in separate terminals.

3. **Set `ARENA_UI_URL`** (optional) – in `.env`, set `ARENA_UI_URL=http://localhost:3001` so the GitHub comment "View progress" links point to your local frontend.

4. **Open the frontend** – http://localhost:3001

5. **Start agents** in one of two ways:
   - **From the UI**: Click "New job", fill in repo, title, and description, then "Start agents"
   - **From GitHub**: Comment `arena` (or `arena: your instructions`) on an issue. The app will spawn agents and reply with a link.

6. **View the job** – click the job in the lobby or use the link from the GitHub comment.

**Note:** For the GitHub trigger, your app must subscribe to `issue_comment` events. Add it in GitHub App settings if needed.

## API

The frontend proxies `/api/*` to the Probot backend (localhost:3000). No CORS config needed.
