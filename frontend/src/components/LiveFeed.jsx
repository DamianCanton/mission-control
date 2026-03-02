import React, { useState, useMemo } from 'react';
import { useMissionStore } from '../store/useMissionStore';

// ─── Constantes ───────────────────────────────────────────────────────────────

const STATUS_COLOR = {
  running:   'bg-blue-900/60   text-blue-300   border-blue-700',
  completed: 'bg-green-900/60  text-green-300  border-green-700',
  thinking:  'bg-yellow-900/60 text-yellow-300 border-yellow-700',
  error:     'bg-red-900/60    text-red-300    border-red-700',
};
function statusColor(s) { return STATUS_COLOR[s] ?? 'bg-gray-800 text-gray-300 border-gray-600'; }

const STATION_META = {
  dev:      { icon: '💻', label: 'Dev'      },
  search:   { icon: '🔍', label: 'Search'   },
  files:    { icon: '📁', label: 'Files'    },
  memory:   { icon: '🧠', label: 'Memory'   },
  messages: { icon: '📨', label: 'Messages' },
  browser:  { icon: '🌐', label: 'Browser'  },
  agents:   { icon: '🤖', label: 'Agents'   },
  hq:       { icon: '🏢', label: 'HQ'       },
  wildcard: { icon: '🔮', label: 'Wildcard' },
};

// Intentar inferir station desde el log si no viene explícito
function inferStation(log) {
  if (log.station)    return log.station;
  if (log.subsystem)  return log.subsystem;
  const a = (log.action ?? '').toLowerCase();
  if (a.includes('exec') || a.includes('bash') || a.includes('code')) return 'dev';
  if (a.includes('search') || a.includes('fetch'))                    return 'search';
  if (a.includes('read') || a.includes('write') || a.includes('edit')) return 'files';
  if (a.includes('memory'))                                            return 'memory';
  if (a.includes('message') || a.includes('telegram'))                return 'messages';
  if (a.includes('browser'))                                           return 'browser';
  if (a.includes('spawn') || a.includes('agent'))                      return 'agents';
  return 'wildcard';
}

// ─── LogCard ──────────────────────────────────────────────────────────────────

function LogCard({ log }) {
  const [expanded, setExpanded] = useState(false);
  const station = inferStation(log);
  const meta    = STATION_META[station] ?? STATION_META.wildcard;
  const ts      = log.timestamp ?? log.occurred_at;

  return (
    <div
      className="p-3 bg-gray-800/80 border border-gray-700 rounded-lg shadow-sm hover:border-gray-600 transition-colors cursor-pointer select-none"
      onClick={() => log.details && setExpanded(e => !e)}
    >
      {/* Fila superior */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="shrink-0">{meta.icon}</span>
          <span className="text-gray-500 text-xs font-mono shrink-0">
            {ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
          </span>
          <span className="text-gray-600 text-xs font-mono hidden sm:inline truncate">
            {meta.label}
          </span>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs border shrink-0 ${statusColor(log.status)}`}>
          {log.status}
        </span>
      </div>

      {/* Agente + acción */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="font-bold text-gray-200 text-xs">{log.agentName ?? log.agent_name ?? '?'}</span>
        <span className="text-gray-600 text-xs">→</span>
        <span className="text-blue-400 font-semibold text-xs break-all">{log.action}</span>
        {log.details && (
          <span className="ml-auto text-gray-600 text-xs">{expanded ? '▲' : '▼'}</span>
        )}
      </div>

      {/* Detalle expandible */}
      {expanded && log.details && (
        <div className="mt-2 pl-2 border-l-2 border-gray-700 text-gray-400 font-mono text-xs break-all whitespace-pre-wrap">
          {log.details}
        </div>
      )}
    </div>
  );
}

// ─── LiveFeed ─────────────────────────────────────────────────────────────────

const STATION_FILTERS = ['all', ...Object.keys(STATION_META)];

const LiveFeed = () => {
  const logs = useMissionStore(state => state.logs);

  const [stationFilter, setStationFilter] = useState('all');
  const [statusFilter,  setStatusFilter]  = useState('all');
  const [search,        setSearch]        = useState('');

  // Logs filtrados — orden: más nuevos primero
  const filtered = useMemo(() => {
    return [...logs]
      .reverse()
      .filter(log => {
        if (stationFilter !== 'all' && inferStation(log) !== stationFilter) return false;
        if (statusFilter  !== 'all' && log.status !== statusFilter)          return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          return (
            (log.action    ?? '').toLowerCase().includes(q) ||
            (log.agentName ?? log.agent_name ?? '').toLowerCase().includes(q) ||
            (log.details   ?? '').toLowerCase().includes(q)
          );
        }
        return true;
      });
  }, [logs, stationFilter, statusFilter, search]);

  return (
    <div
      className="flex flex-col bg-gray-900 border border-gray-700 rounded-lg overflow-hidden shadow-lg"
      style={{ height: 'calc(100dvh - 130px)' }}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="bg-gray-800 border-b border-gray-700 shrink-0">
        <div className="px-4 py-3 flex items-center justify-between">
          <h2 className="text-base md:text-lg font-semibold text-white">Live Feed</h2>
          <span className="text-xs text-gray-500 font-mono">
            {filtered.length} / {logs.length}
          </span>
        </div>

        {/* Búsqueda */}
        <div className="px-3 pb-2">
          <input
            type="text"
            placeholder="Buscar por acción, agente o detalle…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-1.5 text-xs font-mono text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-600 transition-colors"
          />
        </div>

        {/* Filtro status */}
        <div className="flex gap-1.5 px-3 pb-2 overflow-x-auto scrollbar-none">
          {['all', 'running', 'thinking', 'completed', 'error'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-full text-xs font-mono font-semibold shrink-0 border transition-all ${
                statusFilter === s
                  ? s === 'all'       ? 'bg-gray-600 text-white border-gray-400'
                  : s === 'running'   ? 'bg-blue-600 text-white border-blue-400'
                  : s === 'thinking'  ? 'bg-yellow-600 text-white border-yellow-400'
                  : s === 'completed' ? 'bg-green-700 text-white border-green-500'
                  :                    'bg-red-700 text-white border-red-500'
                  : 'bg-transparent text-gray-500 border-gray-700 hover:border-gray-500 hover:text-gray-300'
              }`}
            >
              {s === 'all' ? '⬡ All' : s === 'running' ? '▶ Run' : s === 'thinking' ? '◌ Think' : s === 'completed' ? '✓ Done' : '✕ Err'}
            </button>
          ))}
        </div>

        {/* Filtro estación — scrollable */}
        <div className="flex gap-1.5 px-3 pb-3 overflow-x-auto scrollbar-none">
          {STATION_FILTERS.map(s => {
            const meta = STATION_META[s];
            const active = stationFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStationFilter(s)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-semibold shrink-0 border transition-all ${
                  active
                    ? 'bg-indigo-700 text-white border-indigo-500'
                    : 'bg-transparent text-gray-500 border-gray-700 hover:border-gray-500 hover:text-gray-300'
                }`}
              >
                {meta ? `${meta.icon} ${meta.label}` : '⬡ All'}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Lista ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-gray-600 text-center italic text-sm font-mono mt-10">
            {logs.length === 0 ? 'Awaiting incoming logs…' : 'Ningún log coincide con los filtros.'}
          </div>
        ) : (
          filtered.map((log, i) => (
            <LogCard key={log.id ?? i} log={log} />
          ))
        )}
      </div>
    </div>
  );
};

export default LiveFeed;
