import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useMissionStore } from '../store/useMissionStore';
import { supabase } from '../lib/supabaseClient';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LIVE = {
  running:   'bg-blue-900/60  text-blue-300  border-blue-700',
  thinking:  'bg-yellow-900/60 text-yellow-300 border-yellow-700',
  completed: 'bg-green-900/60 text-green-300  border-green-700',
  error:     'bg-red-900/60   text-red-300    border-red-700',
  idle:      'bg-gray-800     text-gray-400   border-gray-700',
};

const STATUS_DOT = {
  running:  'bg-blue-400 animate-pulse',
  thinking: 'bg-yellow-400 animate-pulse',
  error:    'bg-red-400',
};

const STATION_ICON = {
  hq: '⭐', dev: '💻', files: '📁', search: '🔍',
  memory: '🧠', comms: '📡', agents: '🤖',
};

function statusBadge(s)  { return STATUS_LIVE[s] ?? STATUS_LIVE.idle; }
function statusDot(s)    { return STATUS_DOT[s] ?? null; }

function formatTimeAgo(iso) {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function formatDuration(start, end) {
  if (!start) return null;
  const ms = new Date(end ?? Date.now()) - new Date(start);
  if (ms < 1000)  return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

// ─── TaskRow ──────────────────────────────────────────────────────────────────

function TaskRow({ task, agentDbId }) {
  const duration = formatDuration(task.started_at, task.ended_at);
  const station  = task.station;

  return (
    <Link
      to={`/agents/${agentDbId}/tasks/${task.id}`}
      className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-700/60 transition-colors group"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-base shrink-0">{STATION_ICON[station] ?? '⭐'}</span>
        <span className="font-mono text-xs text-gray-300 truncate group-hover:text-white transition-colors">
          {task.title ?? task.id.slice(0, 12) + '…'}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        {duration && (
          <span className="font-mono text-xs text-gray-500">{duration}</span>
        )}
        <span className={`px-2 py-0.5 rounded-full text-xs border ${statusBadge(task.status)}`}>
          {task.status}
        </span>
      </div>
    </Link>
  );
}

// ─── AgentCard ────────────────────────────────────────────────────────────────

function AgentCard({ agent }) {
  const [tasks,     setTasks]     = useState([]);
  const [dbAgentId, setDbAgentId] = useState(null);
  const [loadingTasks, setLoadingTasks] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!agent.agentName) return;

    // 1. Buscar el agente en Supabase por nombre
    const { data: agentRow } = await supabase
      .from('agents')
      .select('id')
      .eq('name', agent.agentName)
      .single();

    if (!agentRow) {
      setLoadingTasks(false);
      return;
    }

    setDbAgentId(agentRow.id);

    // 2. Últimas 8 tasks del agente
    const { data: taskRows } = await supabase
      .from('tasks')
      .select('id, title, status, station, started_at, ended_at')
      .eq('agent_id', agentRow.id)
      .order('started_at', { ascending: false })
      .limit(8);

    setTasks(taskRows ?? []);
    setLoadingTasks(false);
  }, [agent.agentName]);

  useEffect(() => {
    fetchTasks();
    // Refrescar cada 10s si el agente está activo
    const interval = setInterval(fetchTasks, 10000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  const dot = statusDot(agent.status);

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-lg hover:border-gray-600 transition-colors overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-gray-700/60">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-indigo-900 flex items-center justify-center text-indigo-300 font-bold text-lg">
                {(agent.agentName || '?').charAt(0)}
              </div>
              {dot && (
                <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-800 ${dot}`} />
              )}
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">{agent.agentName}</h3>
              <p className="text-xs text-gray-500 font-mono mt-0.5">
                {agent.action ?? 'idle'}
              </p>
            </div>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusBadge(agent.status)}`}>
            {agent.status ?? 'idle'}
          </span>
        </div>

        <div className="mt-3 flex gap-4 text-xs text-gray-500">
          <span>Last seen: <span className="text-gray-400">{formatTimeAgo(agent.lastSeen)}</span></span>
        </div>
      </div>

      {/* Tasks */}
      <div className="p-3">
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Recent Tasks</span>
          {dbAgentId && (
            <span className="text-xs text-gray-600 font-mono">{tasks.length} loaded</span>
          )}
        </div>

        {loadingTasks ? (
          <div className="flex items-center justify-center py-4">
            <div className="w-5 h-5 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-4 text-xs text-gray-600 italic font-mono">
            {dbAgentId ? 'No tasks recorded yet' : 'Agent not yet in DB'}
          </div>
        ) : (
          <div className="space-y-0.5">
            {tasks.map(task => (
              <TaskRow key={task.id} task={task} agentDbId={dbAgentId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Agents ───────────────────────────────────────────────────────────────────

const Agents = () => {
  const agents = useMissionStore(state => state.agents);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-white">Active Agents</h2>
        <span className="text-sm text-gray-500 font-mono">{agents.length} online</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {agents.length === 0 ? (
          <div className="col-span-full text-center text-gray-500 py-16 font-mono text-sm">
            No agents currently active
          </div>
        ) : (
          agents.map(agent => (
            <AgentCard key={agent.id || agent.agentName} agent={agent} />
          ))
        )}
      </div>
    </div>
  );
};

export default Agents;
