'use client';

import { X, CheckCircle } from 'lucide-react';

function formatAgentName(id: string): string {
  const match = id.match(/agent_(.+)/);
  return match ? match[1].charAt(0).toUpperCase() + match[1].slice(1) : id;
}

export function WinnerModal({
  agentId,
  onConfirm,
  onCancel,
  isLoading,
}: {
  agentId: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden
      />

      {/* Modal */}
      <div
        className="relative w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="winner-modal-title"
      >
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
            <CheckCircle className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h2
              id="winner-modal-title"
              className="text-xl font-bold text-white mb-1"
            >
              Select Winner
            </h2>
            <p className="text-slate-400 text-sm">
              Confirm <strong className="text-white">{formatAgentName(agentId)}</strong> as the
              winning solution. This will open one clean PR on GitHub and close
              the other branches.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 py-2.5 rounded-lg border border-slate-600 text-slate-300 hover:border-slate-500 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Finalizing...
              </>
            ) : (
              'Confirm Selection'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
