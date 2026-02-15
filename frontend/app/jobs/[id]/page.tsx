'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Github, ArrowLeft, Loader2, GitPullRequest, ExternalLink } from 'lucide-react';
import { AgentCard } from '@/components/arena/AgentCard';
import { TerminalView } from '@/components/arena/TerminalView';
import { fetchJobDetail, createPRs } from '@/lib/api';
import type { JobDetail, Agent } from '@/lib/types';

function jobStatusToLabel(
  status: JobDetail['status'],
  agents: Agent[] = []
): string {
  switch (status) {
    case 'processing': {
      const hasDeploying = agents.some(
        (a) => a.status === 'pushing' || a.status === 'deploying'
      );
      const hasReady = agents.some((a) => a.status === 'ready');
      if (hasDeploying && !hasReady) return 'Deploying to Vercel...';
      return 'Coding (Warp)';
    }
    case 'review_needed':
      return 'Ready for Review';
    case 'completed':
      return 'Completed';
    default:
      return status;
  }
}

export default function ArenaPage() {
  const params = useParams();
  const id = params?.id as string;

  const [job, setJob] = useState<JobDetail | null>(null);
  const [selectedAgentIds, setSelectedAgentIds] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);

  // Poll backend for status
  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function poll() {
      try {
        const data = await fetchJobDetail(id);
        if (!cancelled) setJob(data);
      } catch {
        if (!cancelled) setJob(null);
      }
    }

    poll();
    const interval = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id]);

  const toggleAgentSelection = (agentId: string) => {
    setSelectedAgentIds((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  };

  const handleCreatePRs = async () => {
    const ids = Array.from(selectedAgentIds);
    if (ids.length === 0 || !id) return;
    setIsCreating(true);
    try {
      await createPRs(id, ids);
      // Re-fetch to pick up the completed status + winner info
      const data = await fetchJobDetail(id);
      setJob(data);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to create PRs. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const agents: Agent[] = job?.agents ?? [];
  const readyAgents = agents.filter((a) => a.status === 'ready');
  const selectionMode = job?.status === 'review_needed' && readyAgents.length > 0;
  const isCompleted = job?.status === 'completed';
  const winnerIds = job?.winnerAgentIds ?? [];
  const prUrls = job?.prUrls ?? {};
  const displayedAgents = isCompleted && winnerIds.length > 0
    ? agents.filter((a) => winnerIds.includes(a.id))
    : agents;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Link
              href="/"
              className="shrink-0 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Back to Lobby"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white flex items-center gap-2 truncate">
                <Github className="w-5 h-5 shrink-0" />
                {job?.issueTitle ?? `Issue #${id}`}
              </h1>
              <p className="text-slate-400 text-sm mt-0.5">
                Arena Active • {agents.length} Warp Agents
                {readyAgents.length > 0 && ` • ${readyAgents.length} ready for review`}
              </p>
            </div>
          </div>
          <span
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border flex items-center gap-2 ${job?.status === 'processing'
              ? 'bg-amber-900/30 text-amber-400 border-amber-800'
              : job?.status === 'review_needed'
                ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800'
                : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
          >
            {job?.status === 'processing' && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            {job ? jobStatusToLabel(job.status, job.agents) : 'Loading...'}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 h-[calc(100vh-88px)]">
        {/* LEFT COL: Issue + Live Terminal */}
        <div className="lg:col-span-1 flex flex-col gap-4 min-h-0">
          {/* Issue Description */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 shrink-0">
            <h2 className="font-semibold text-white mb-2">The Request</h2>
            <p className="text-slate-400 text-sm whitespace-pre-wrap">
              {job?.issueDescription ?? 'Loading...'}
            </p>
          </div>

          {/* Live Terminal Feed */}
          <div className="flex-1 min-h-0 flex flex-col rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-900/50 shrink-0">
              <h2 className="font-semibold text-white">Arena Logs</h2>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <TerminalView agents={agents} />
            </div>
          </div>
        </div>

        {/* RIGHT COL: Candidates */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 overflow-y-auto flex-1">
            <h2 className="font-semibold text-white mb-4">
              {isCompleted && winnerIds.length > 0
                ? `Selected Candidate${winnerIds.length > 1 ? 's' : ''}`
                : 'Candidates (Vercel Previews)'}
            </h2>

            {/* Completed state: show PR links */}
            {isCompleted && winnerIds.length > 0 && (
              <div className="mb-4 p-4 rounded-lg bg-emerald-900/20 border border-emerald-800">
                <p className="text-emerald-300 text-sm font-medium mb-3">
                  Pull request{winnerIds.length > 1 ? 's have' : ' has'} been created for this job.
                </p>
                <div className="flex flex-col gap-2">
                  {winnerIds.map((agentId) => {
                    const url = prUrls[agentId];
                    if (!url) return null;
                    return (
                      <a
                        key={agentId}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 py-2 px-4 rounded-lg bg-slate-800 border border-slate-700 text-white hover:border-emerald-600 hover:bg-slate-700 transition-colors w-fit"
                      >
                        <GitPullRequest className="w-4 h-4 text-emerald-400" />
                        <span className="font-medium text-sm">View PR on GitHub</span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Selection mode for review_needed */}
            {selectionMode && (
              <div className="mb-4 p-4 rounded-lg bg-slate-800/60 border border-slate-700">
                <p className="text-slate-300 text-sm mb-3">
                  Select one or more preferred options below. This will create pull requests so you can review the code on GitHub. If you select a single option, a regular PR will be created. If you select multiple, draft PRs will be created (since only one will go to production in the end).
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleCreatePRs}
                    disabled={selectedAgentIds.size === 0 || isCreating}
                    className="flex items-center gap-2 py-2.5 px-4 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Creating PRs...
                      </>
                    ) : (
                      <>
                        <GitPullRequest className="w-4 h-4" />
                        Create PR{selectedAgentIds.size !== 1 ? 's' : ''} ({selectedAgentIds.size} selected)
                      </>
                    )}
                  </button>
                  {selectedAgentIds.size > 0 && (
                    <button
                      onClick={() => setSelectedAgentIds(new Set())}
                      disabled={isCreating}
                      className="text-slate-400 hover:text-white text-sm"
                    >
                      Clear selection
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className={`grid gap-4 ${isCompleted && winnerIds.length === 1 ? 'grid-cols-1 max-w-lg' : 'grid-cols-1 md:grid-cols-2'}`}>
              {displayedAgents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onPreview={() => {
                    const url = agent.vercelUrl ?? agent.sessionLink;
                    if (url) window.open(url);
                  }}
                  selectionMode={selectionMode}
                  selected={selectedAgentIds.has(agent.id)}
                  onToggleSelect={() => toggleAgentSelection(agent.id)}
                />
              ))}
            </div>

            {agents.length === 0 && (
              <div className="text-center text-slate-500 py-20">
                Initializing Agents...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
