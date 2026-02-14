'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Github, Loader2, Rocket, CheckCircle, Clock } from 'lucide-react';
import { fetchJobs } from '@/lib/api';
import type { Job } from '@/lib/types';

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
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${
        isProcessing
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
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

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
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-1">
            Active Issues
          </h2>
          <p className="text-slate-500 text-sm">
            GitHub Issues currently being processed by Arena agents
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-12 text-center">
            <Rocket className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 mb-2">No active jobs</p>
            <p className="text-slate-500 text-sm">
              Issues will appear here when Arena starts processing them
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
                          #{job.issueId}
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
