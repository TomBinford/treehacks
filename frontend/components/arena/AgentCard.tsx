'use client';

import { ExternalLink, Check, Loader2, AlertTriangle } from 'lucide-react';
import type { Agent } from '@/lib/types';

function formatAgentName(id: string): string {
  const match = id.match(/agent_(.+)/);
  return match ? match[1].charAt(0).toUpperCase() + match[1].slice(1) : id;
}

function formatModelId(modelId: string | null | undefined): string {
  if (!modelId) return '';
  return modelId
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

const STATUS_LABELS: Record<Agent['status'], string> = {
  initializing: 'Initializing environment',
  developing: 'Developing',
  pushing: 'Pushing to GitHub',
  deploying: 'Deploying to Vercel',
  ready: 'Ready for Review',
  deployment_failed: 'Deployment failed',
  failed: 'Failed',
};

export function AgentCard({
  agent,
  selectionMode,
  selected,
  onToggleSelect,
}: {
  agent: Agent;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const isReady = agent.status === 'ready';

  return (
    <div
      className={`
        relative group rounded-xl border p-4 transition-all
        ${isReady
          ? 'border-slate-700 bg-slate-800/40 hover:border-violet-500/50'
          : 'border-slate-800 bg-slate-900/50 opacity-80'
        }
      `}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3 gap-3">
        {selectionMode && isReady && onToggleSelect && (
          <label className="shrink-0 cursor-pointer flex items-center justify-center w-8 h-8 rounded-lg border border-slate-600 hover:border-violet-500/50 transition-colors mt-0.5">
            <input
              type="checkbox"
              checked={selected ?? false}
              onChange={onToggleSelect}
              className="sr-only"
            />
            <span
              className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${selected
                ? 'bg-violet-500 border-violet-500'
                : 'border-slate-500 bg-transparent'
                }`}
            >
              {selected && (
                <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
              )}
            </span>
          </label>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-slate-200">
            {formatAgentName(agent.id)}
          </h3>
          {agent.modelId && (
            <p className="text-xs text-slate-500 mt-0.5">
              {formatModelId(agent.modelId)}
            </p>
          )}
          <span
            className={`text-xs uppercase tracking-wider font-bold ${isReady
              ? 'text-emerald-400'
              : agent.status === 'failed' || agent.status === 'deployment_failed'
                ? 'text-red-400'
                : 'text-amber-400'
              }`}
          >
            {STATUS_LABELS[agent.status]}
          </span>
        </div>

        {/* Status Icon */}
        {(agent.status === 'initializing' ||
          agent.status === 'developing' ||
          agent.status === 'pushing' ||
          agent.status === 'deploying') && (
            <Loader2 className="w-5 h-5 text-amber-400 animate-spin shrink-0" />
          )}
        {agent.status === 'ready' && (
          <Check className="w-5 h-5 text-emerald-400 shrink-0" />
        )}
        {(agent.status === 'failed' || agent.status === 'deployment_failed') && (
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
        )}
      </div>

      {/* Preview Area - Vercel iframe when ready, Warp link while developing/deploying */}
      <div className="aspect-video bg-slate-950 rounded-lg border border-slate-800 mb-4 flex items-center justify-center relative overflow-hidden min-h-[120px]">
        {agent.sessionLink ? (
          <>
            {isReady && agent.deploymentDetailsUrl ? (
              <>
                <iframe
                  src={agent.deploymentDetailsUrl}
                  className="w-[200%] h-[200%] scale-50 origin-top-left pointer-events-none"
                  title={`Preview ${formatAgentName(agent.id)}`}
                  sandbox="allow-scripts"
                />
                <a
                  href={agent.deploymentUrl!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 hover:bg-black/60 transition-all"
                >
                  <span className="flex items-center gap-2 text-white font-bold bg-black/80 px-4 py-2 rounded-full">
                    Open Deployment <ExternalLink className="w-4 h-4" />
                  </span>
                </a>
              </>
            ) : (
              <a
                href={agent.sessionLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-2 p-4 text-slate-300 hover:text-white transition-colors w-full h-full"
              >
                <ExternalLink className="w-8 h-8" />
                <span className="text-sm font-medium">Watch live in Warp</span>
                <span className="text-xs text-slate-500">
                  {agent.status === 'developing'
                    ? 'Agent is working...'
                    : agent.status === 'initializing'
                      ? 'Starting up...'
                      : agent.status === 'pushing'
                        ? 'Pushing code...'
                        : agent.status === 'deploying'
                          ? 'Deploying to Vercel...'
                          : 'Open to view terminal'}
                </span>
              </a>
            )}
          </>
        ) : (
          <p className="text-slate-600 text-xs">
            Waiting for environment...
          </p>
        )}
      </div>

      {/* Actions - Vercel as main, Warp as secondary when ready */}
      <div className="flex items-center gap-2">
        {isReady && agent.deploymentDetailsUrl && (
          <a
            href={agent.deploymentDetailsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2 px-3 text-center text-sm font-medium rounded-lg bg-violet-600 text-white hover:bg-violet-500 transition-colors"
          >
            View Vercel Page
          </a>
        )}
        {agent.sessionLink && (
          <a
            href={agent.sessionLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2 px-3 text-center text-sm font-medium rounded-lg border border-slate-600 text-slate-300 hover:border-slate-500 hover:text-white transition-colors"
          >
            View Warp Session
          </a>
        )}
      </div>
    </div>
  );
}
