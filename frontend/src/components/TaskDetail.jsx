import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  running:   'bg-blue-900/60  text-blue-300  border-blue-700',
  thinking:  'bg-yellow-900/60 text-yellow-300 border-yellow-700',
  completed: 'bg-green-900/60 text-green-300  border-green-700',
  error:     'bg-red-900/60   text-red-300    border-red-700',
  idle:      'bg-gray-800 text-gray-400 border-gray-600',
};

const STATUS_DOT = {
  running:   'bg-blue-400',
  thinking:  'bg-yellow-400',
  completed: 'bg-green-400',
  error:     'bg-red-400',
  idle:      'bg-gray-500',
};

const STATION_ICON = {
  hq: '⭐', dev: '💻', files: '📁', search: '🔍',
  memory: '🧠', comms: '📡', agents: '🤖',
};

// Estaciones viejas → nuevas (compat con eventos históricos en DB)
const STATION_COMPAT = {
  messages: 'comms', browser: 'dev', subagents: 'agents',
  misc: 'hq', wildcard: 'hq',
};
function normalizeStation(s) {
  return STATION_COMPAT[s] ?? (STATION_ICON[normalizeStation(s)] ?? '⭐' ? s : 'hq');
}


function statusStyle(s) { return STATUS_STYLES[s] ?? STATUS_STYLES.idle; }
function statusDot(s)   { return STATUS_DOT[s]    ?? STATUS_DOT.idle;    }

function formatDuration(start, end) {
  if (!start) return '—';
  const ms = new Date(end ?? Date.now()) - new Date(start);
  if (ms < 1000)  return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatTs(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function MetaChip({ label, value, mono = false }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
      <span className={`text-sm text-gray-200 ${mono ? 'font-mono' : 'font-medium'}`}>
        {value ?? '—'}
      </span>
    </div>
  );
}

function EventRow({ event }) {
  // Soporta tanto 'occurred_at' (DB) como 'timestamp' (fallback legacy)
  const ts      = event.occurred_at ?? event.timestamp;
  const details = event.metadata?.details ?? event.raw_log ?? null;
  const station = event.station;

  return (
    <div className="flex gap-4 group">
      <div className="flex flex-col items-center">
        <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${statusDot(event.status)}`} />
        <div className="w-px flex-1 bg-gray-700 group-last:hidden mt-1" />
      </div>

      <div className="pb-5 flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-gray-500 font-mono text-xs">{formatTs(ts)}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs border ${statusStyle(event.status)}`}>
            {event.status}
          </span>
          <span className="text-blue-400 font-mono text-xs font-semibold">{event.action}</span>
          {station && (
            <span className="text-gray-500 text-xs">
              {STATION_ICON[normalizeStation(station)] ?? '⭐'} {station}
            </span>
          )}
        </div>

        {details && (
          <div className="mt-1 pl-3 border-l-2 border-gray-700 text-gray-400 font-mono text-xs whitespace-pre-wrap break-all">
            {details}
          </div>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-500">
      <div className="w-8 h-8 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin" />
      <span className="font-mono text-sm">Loading task data...</span>
    </div>
  );
}

// ─── TaskDetail ───────────────────────────────────────────────────────────────

const TaskDetail = () => {
  const { agentId, taskId } = useParams();

  const [task,    setTask]    = useState(null);
  const [events,  setEvents]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!agentId || !taskId) {
      setError('Parámetros de ruta inválidos.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        // 1. Fetch tarea
        const { data: taskData, error: taskErr } = await supabase
          .from('tasks')
          .select('*')
          .eq('id', taskId)
          .single();

        if (taskErr || !taskData) {
          setError('Task not found (404).');
          setLoading(false);
          return;
        }

        if (!cancelled) setTask(taskData);

        // 2. Fetch eventos del agente — filtrar por rango temporal de la tarea
        // Columna correcta: occurred_at (renombrada de 'timestamp' por conflicto con PG)
        let query = supabase
          .from('agent_events')
          .select('*')
          .eq('agent_id', agentId)
          .order('occurred_at', { ascending: true });

        if (taskData.started_at) {
          query = query.gte('occurred_at', taskData.started_at);
          if (taskData.ended_at) {
            query = query.lte('occurred_at', taskData.ended_at);
          } else {
            // Tarea todavía running — tomar eventos de los últimos 5 min
            const cutoff = new Date(new Date(taskData.started_at).getTime() + 5 * 60 * 1000).toISOString();
            query = query.lte('occurred_at', cutoff);
          }
        }

        const { data: eventsData, error: eventsErr } = await query.limit(200);
        if (eventsErr) throw eventsErr;
        if (!cancelled) setEvents(eventsData ?? []);

      } catch (err) {
        if (!cancelled) setError(err.message ?? 'Error inesperado al cargar datos.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [agentId, taskId]);

  // ── Render states ─────────────────────────────────────────────────────────

  if (loading) return <div className="min-h-full bg-gray-900"><Spinner /></div>;

  if (error) return (
    <div className="min-h-full bg-gray-900 flex flex-col items-center justify-center gap-4 text-center py-24">
      <span className="text-5xl">🔍</span>
      <h2 className="text-xl font-semibold text-gray-200">{error}</h2>
      <p className="text-gray-500 font-mono text-sm">
        agent: <span className="text-gray-400">{agentId}</span> · task: <span className="text-gray-400">{taskId}</span>
      </p>
      <Link to="/agents" className="mt-2 text-blue-400 hover:text-blue-300 text-sm underline underline-offset-4">
        ← Back to Agents
      </Link>
    </div>
  );

  const duration = formatDuration(task.started_at, task.ended_at);

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 font-mono">
        <Link to="/agents" className="hover:text-gray-300 transition-colors">agents</Link>
        <span>/</span>
        <span className="text-gray-400">{task.title ?? agentId}</span>
        <span>/</span>
        <span className="text-gray-400">tasks</span>
        <span>/</span>
        <span className="text-gray-200">{taskId.slice(0, 8)}…</span>
      </nav>

      {/* Header card */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden shadow-lg">
        <div className="p-5 border-b border-gray-700 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {task.station && (
                <span className="text-xl">{STATION_ICON[normalizeStation(task.station)] ?? '⭐'}</span>
              )}
              <h1 className="text-xl font-bold text-white font-mono">{task.title ?? task.id}</h1>
            </div>
            <p className="text-gray-400 text-sm">
              station <span className="font-mono text-gray-300">{task.station ?? '—'}</span>
              {task.event_count > 0 && (
                <span className="ml-3 text-gray-500">{task.event_count} events logged</span>
              )}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium border ${statusStyle(task.status)}`}>
            {task.status}
          </span>
        </div>

        <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-5">
          <MetaChip label="Duration" value={duration}               mono />
          <MetaChip label="Started"  value={formatTs(task.started_at)} mono />
          <MetaChip label="Ended"    value={formatTs(task.ended_at)}   mono />
          <MetaChip label="Events"   value={events.length}          mono />
        </div>

        {task.error_message && (
          <div className="px-5 pb-5">
            <div className="bg-red-900/30 border border-red-800 rounded-md px-4 py-3 font-mono text-xs text-red-300">
              <span className="text-red-500 font-bold mr-2">ERROR</span>{task.error_message}
            </div>
          </div>
        )}
      </div>

      {/* Events timeline */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden shadow-lg">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Execution Timeline</h2>
          <span className="text-xs text-gray-500 font-mono">{events.length} events</span>
        </div>

        <div className="p-5 font-mono text-sm">
          {events.length === 0 ? (
            <div className="text-gray-500 italic text-center py-10">
              No events found for this task window.
            </div>
          ) : (
            events.map((event, i) => (
              <EventRow key={event.id ?? i} event={event} />
            ))
          )}
        </div>
      </div>

    </div>
  );
};

export default TaskDetail;
