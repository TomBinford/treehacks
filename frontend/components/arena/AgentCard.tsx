'use client';

import { ExternalLink, Check, Loader2, AlertTriangle } from 'lucide-react';
import type { Agent } from '@/lib/types';

function formatAgentName(id: string): string {
  const match = id.match(/agent_(.+)/);
  return match ? match[1].charAt(0).toUpperCase() + match[1].slice(1) : id;
}

export function AgentCard({
  agent,
  onPreview,
  onSelect,
}: {
  agent: Agent;
  onPreview?: () => void;
  onSelect: () => void;
}) {
  const isReady = agent.status === 'ready';

  return (
    <div
      className={`
        relative group rounded-xl border p-4 transition-all
        ${
          isReady
            ? 'border-slate-700 bg-slate-800/40 hover:border-violet-500/50'
            : 'border-slate-800 bg-slate-900/50 opacity-80'
        }
      `}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-slate-200">
            {formatAgentName(agent.id)}
          </h3>
          <span
            className={`text-xs uppercase tracking-wider font-bold ${
              isReady ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {agent.status}
          </span>
        </div>

        {/* Status Icon */}
        {agent.status === 'coding' && (
          <Loader2 className="w-5 h-5 text-amber-400 animate-spin shrink-0" />
        )}
        {agent.status === 'deploying' && (
          <Loader2 className="w-5 h-5 text-amber-400 animate-spin shrink-0" />
        )}
        {agent.status === 'ready' && (
          <Check className="w-5 h-5 text-emerald-400 shrink-0" />
        )}
        {agent.status === 'failed' && (
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
        )}
      </div>

      {/* Preview Area */}
      <div className="aspect-video bg-slate-950 rounded-lg border border-slate-800 mb-4 flex items-center justify-center relative overflow-hidden min-h-[120px]">
        {isReady && (agent.vercelUrl || agent.sessionLink) ? (
          <>
            <iframe
              src={agent.vercelUrl ?? agent.sessionLink ?? ''}
              className="w-[200%] h-[200%] scale-50 origin-top-left pointer-events-none"
              title={`Preview ${formatAgentName(agent.id)}`}
              sandbox="allow-scripts"
            />
            {/* Overlay for full preview */}
            <a
              href={agent.vercelUrl ?? agent.sessionLink ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 hover:bg-black/60 transition-all"
              onClick={(e) => {
                onPreview?.();
              }}
            >
              <span className="flex items-center gap-2 text-white font-bold bg-black/80 px-4 py-2 rounded-full">
                Open Interactive Preview <ExternalLink className="w-4 h-4" />
              </span>
            </a>
          </>
        ) : (
          <p className="text-slate-600 text-xs">
            {agent.sessionLink ? 'Watch in Warp...' : 'Waiting for deployment...'}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {isReady && (agent.vercelUrl || agent.sessionLink) && onPreview && (
          <a
            href={agent.vercelUrl ?? agent.sessionLink ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2 px-3 text-center text-sm font-medium rounded-lg border border-slate-600 text-slate-300 hover:border-slate-500 hover:text-white transition-colors"
          >
            Preview
          </a>
        )}
        <button
          onClick={onSelect}
          disabled={!isReady}
          className="flex-1 py-2 bg-white text-black font-bold rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
        >
          Select as Winner
        </button>
      </div>
    </div>
  );
}
