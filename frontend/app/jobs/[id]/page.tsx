'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Github, Clock, ArrowLeft, Loader2 } from 'lucide-react';
import { AgentCard } from '@/components/arena/AgentCard';
import { TerminalView } from '@/components/arena/TerminalView';
import { WinnerModal } from '@/components/arena/WinnerModal';
import { fetchJobDetail, selectWinner } from '@/lib/api';
import type { JobDetail, Agent } from '@/lib/types';

function jobStatusToLabel(status: JobDetail['status']): string {
  switch (status) {
    case 'processing':
      return 'Coding (Warp)';
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
  const router = useRouter();
  const id = params?.id as string;

  const [job, setJob] = useState<JobDetail | null>(null);
  const [winnerModalAgent, setWinnerModalAgent] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

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

  const handleSelectWinner = (agentId: string) => {
    setWinnerModalAgent(agentId);
  };

  const handleConfirmWinner = async () => {
    if (!winnerModalAgent || !id) return;
    setIsSelecting(true);
    try {
      await selectWinner(id, { winnerAgentId: winnerModalAgent });
      setWinnerModalAgent(null);
      router.push('/');
    } catch (err) {
      console.error(err);
      alert('Failed to select winner. Please try again.');
    } finally {
      setIsSelecting(false);
    }
  };

  const agents: Agent[] = job?.agents ?? [];
  const readyCount = agents.filter((a) => a.status === 'ready').length;

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
                {readyCount > 0 && ` • ${readyCount} ready for review`}
              </p>
            </div>
          </div>
          <span
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border flex items-center gap-2 ${
              job?.status === 'processing'
                ? 'bg-amber-900/30 text-amber-400 border-amber-800'
                : job?.status === 'review_needed'
                  ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {job?.status === 'processing' && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            {job ? jobStatusToLabel(job.status) : 'Loading...'}
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
              <h2 className="font-semibold text-white">Live Agent Logs</h2>
              <p className="text-xs text-slate-500">
                Streaming from Warp instances...
              </p>
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
              Candidates (Vercel Previews)
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onPreview={() => {
                    const url = agent.vercelUrl ?? agent.sessionLink;
                    if (url) window.open(url);
                  }}
                  onSelect={() => handleSelectWinner(agent.id)}
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

      {/* Winner Confirmation Modal */}
      {winnerModalAgent && (
        <WinnerModal
          agentId={winnerModalAgent}
          onConfirm={handleConfirmWinner}
          onCancel={() => setWinnerModalAgent(null)}
          isLoading={isSelecting}
        />
      )}
    </div>
  );
}
