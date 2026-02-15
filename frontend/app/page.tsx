'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Github, Loader2, Rocket, CheckCircle, Clock, Plus, Trash2 } from 'lucide-react';
import { fetchJobs, createJob } from '@/lib/api';
import type { Job } from '@/lib/types';
import type { AgentSlot } from '@/lib/api';

const MODEL_OPTIONS: { id: string; label: string }[] = [
  { id: 'claude-4-sonnet', label: 'Claude 4 Sonnet' },
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { id: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
  { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
  { id: 'claude-opus-4-1', label: 'Claude Opus 4.1' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
  { id: 'claude-sonnet-4', label: 'Claude Sonnet 4' },
];

const REPO_OPTIONS = [
  'gsonntag/treehacks-testing-repo',
  'TomBinford/treehacks-testing-repo',
] as const;

function statusToLabel(status: Job['status']): string {
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

function StatusBadge({ status }: { status: Job['status'] }) {
  const isProcessing = status === 'processing';
  const isReady = status === 'review_needed';
  const isCompleted = status === 'completed';

  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${isProcessing
        ? 'bg-amber-900/30 text-amber-400 border-amber-800'
        : isReady
          ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800'
          : isCompleted
            ? 'bg-slate-800 text-slate-400 border-slate-700'
            : 'bg-slate-800 text-slate-400 border-slate-700'
        }`}
    >
      {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
      {isReady && <CheckCircle className="w-4 h-4" />}
      {isCompleted && <CheckCircle className="w-4 h-4" />}
      {status === 'processing' && <Clock className="w-4 h-4" />}
      {statusToLabel(status)}
    </span>
  );
}

export default function LobbyPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ repoName: '', issueTitle: '', issueDescription: '' });
  const [agentSlots, setAgentSlots] = useState<AgentSlot[]>([{ count: 1, modelId: 'claude-4-sonnet' }]);

  const totalAgents = agentSlots.reduce((sum, s) => sum + s.count, 0);
  const canAddSlot = agentSlots.length < 10 && totalAgents < 10;

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (totalAgents < 1 || totalAgents > 10) {
      setFormError('Total agents must be between 1 and 10');
      return;
    }
    setCreating(true);
    try {
      const { arenaUrl, jobId } = await createJob({
        repoName: form.repoName.trim(),
        issueTitle: form.issueTitle.trim(),
        issueDescription: form.issueDescription.trim(),
        agentConfigs: agentSlots,
      });
      setShowForm(false);
      setForm({ repoName: '', issueTitle: '', issueDescription: '' });
      setAgentSlots([{ count: 1, modelId: 'claude-4-sonnet' }]);
      router.push(`/jobs/${jobId}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create job');
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchJobs();
        if (!cancelled) setJobs(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center">
              <Github className="w-5 h-5 text-white" />
            </div>
            Arena
          </h1>
          <p className="text-slate-400 text-sm">
            Mission Control for AI Agents
          </p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white mb-1">
              Active Jobs
            </h2>
            <p className="text-slate-500 text-sm">
              Monitor and start groups of agents here
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New job
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleCreateJob}
            className="mb-8 rounded-xl border border-slate-800 bg-slate-900/50 p-6 space-y-4"
          >
            <h3 className="font-semibold text-white">Create a new job</h3>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Repo (owner/name)</label>
              <select
                value={form.repoName}
                onChange={(e) => setForm((f) => ({ ...f, repoName: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-violet-500"
                required
              >
                <option value="" className="bg-slate-800 text-slate-500">
                  Select from authorized repositories
                </option>
                {REPO_OPTIONS.map((repo) => (
                  <option key={repo} value={repo} className="bg-slate-800">
                    {repo}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Title</label>
              <input
                type="text"
                value={form.issueTitle}
                onChange={(e) => setForm((f) => ({ ...f, issueTitle: e.target.value }))}
                placeholder="Fix navbar alignment"
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Description / Instructions</label>
              <textarea
                value={form.issueDescription}
                onChange={(e) => setForm((f) => ({ ...f, issueDescription: e.target.value }))}
                placeholder="Describe the changes you want the agents to make..."
                rows={4}
                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 resize-none"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Agents ({totalAgents}/10)</label>
              <div className="space-y-2">
                {agentSlots.map((slot, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={slot.count}
                      onChange={(e) => {
                        const v = Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1));
                        setAgentSlots((s) => {
                          const next = [...s];
                          next[idx] = { ...next[idx], count: v };
                          return next;
                        });
                      }}
                      className="w-14 px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-violet-500 text-center"
                    />
                    <span className="text-slate-500 text-sm">×</span>
                    <select
                      value={slot.modelId}
                      onChange={(e) =>
                        setAgentSlots((s) => {
                          const next = [...s];
                          next[idx] = { ...next[idx], modelId: e.target.value };
                          return next;
                        })
                      }
                      className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-violet-500"
                    >
                      {MODEL_OPTIONS.map((m) => (
                        <option key={m.id} value={m.id} className="bg-slate-800">
                          {m.label}
                        </option>
                      ))}
                    </select>
                    {agentSlots.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setAgentSlots((s) => s.filter((_, i) => i !== idx))}
                        className="p-2 text-slate-500 hover:text-red-400 rounded"
                        aria-label="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                {canAddSlot && (
                  <button
                    type="button"
                    onClick={() => setAgentSlots((s) => [...s, { count: 1, modelId: 'claude-4-sonnet' }])}
                    className="text-sm text-violet-400 hover:text-violet-300 flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Add agent slot
                  </button>
                )}
              </div>
              <p className="text-slate-500 text-xs mt-1">
                Same model: one slot. Different models: add multiple slots.
              </p>
            </div>
            {formError && (
              <p className="text-red-400 text-sm">{formError}</p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium"
              >
                {creating ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Starting...
                  </span>
                ) : (
                  'Start agents'
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg border border-slate-600 text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-12 text-center">
            <Rocket className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 mb-2">No active jobs</p>
            <p className="text-slate-500 text-sm">
              Create a job with the button above
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {jobs.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/jobs/${job.id}`}
                  className="block rounded-xl border border-slate-800 bg-slate-900/50 p-5 hover:border-slate-700 hover:bg-slate-900/80 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-slate-500 font-mono text-sm">
                          {job.issueId ? `#${job.issueId}` : '—'}
                        </span>
                        <span className="text-slate-400 font-mono text-sm truncate">
                          {job.repoName}
                        </span>
                      </div>
                      <p className="text-white font-medium group-hover:text-violet-400 transition-colors truncate">
                        {job.issueTitle ?? `Issue #${job.issueId}`} →
                      </p>
                    </div>
                    <StatusBadge status={job.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
