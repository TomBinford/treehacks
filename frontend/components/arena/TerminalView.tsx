'use client';

import { useState } from 'react';
import type { Agent } from '@/lib/types';

function formatAgentName(id: string): string {
  const match = id.match(/agent_(.+)/);
  return match ? match[1].charAt(0).toUpperCase() + match[1].slice(1) : id;
}

export function TerminalView({ agents }: { agents: Agent[] }) {
  if (!agents || agents.length === 0) {
    return (
      <div className="p-4 text-slate-600 font-mono text-sm h-full flex items-center justify-center">
        <span className="animate-pulse">Waiting for connection...</span>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState(0);
  const currentAgent = agents[activeTab];
  const currentLogs = currentAgent?.terminalLogs ?? [];

  return (
    <div className="flex flex-col h-full font-mono text-xs">
      {/* Tabs for switching between Agent Terminals */}
      <div className="flex border-b border-slate-800 shrink-0">
        {agents.map((agent, idx) => (
          <button
            key={agent.id}
            onClick={() => setActiveTab(idx)}
            className={`px-4 py-2.5 hover:bg-slate-800 transition-colors border-b-2 -mb-px ${
              activeTab === idx
                ? 'bg-slate-800 text-emerald-400 border-emerald-500'
                : 'text-slate-500 border-transparent'
            }`}
          >
            {formatAgentName(agent.id)}
          </button>
        ))}
      </div>

      {/* The Logs - Matrix style */}
      <div className="flex-1 p-4 overflow-y-auto bg-black/80 text-emerald-400/90 space-y-1 min-h-0">
        {currentLogs.map((log: string, i: number) => (
          <div key={i} className="break-all leading-relaxed">
            <span className="text-slate-600 mr-2 select-none">$</span>
            {log}
          </div>
        ))}
        {/* Cursor effect */}
        <div className="flex items-center gap-1 mt-1">
          <span className="text-slate-600 select-none">$</span>
          <span className="animate-pulse text-emerald-400">_</span>
        </div>
      </div>
    </div>
  );
}
