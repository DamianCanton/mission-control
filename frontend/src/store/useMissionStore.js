import { create } from 'zustand';
import { io } from 'socket.io-client';
import { supabase } from '../lib/supabaseClient';

const host      = window.location.hostname;
const socketUrl = `http://${host}:3000`;
const socket    = io(socketUrl, { autoConnect: true });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dbEventToLog(ev, idx) {
  return {
    id:        ev.id ?? `db-${idx}`,
    timestamp: ev.occurred_at,
    agentName: ev.agent_name,
    action:    ev.action,
    status:    ev.status,
    details:   ev.metadata?.details ?? ev.raw_log ?? '',
    subsystem: ev.metadata?.subsystem ?? '',
    _fromDb:   true,
  };
}

async function loadRecentLogsFromDb() {
  try {
    const { data, error } = await supabase
      .from('agent_events')
      .select('id, agent_name, action, status, occurred_at, metadata, raw_log')
      .order('occurred_at', { ascending: false })
      .limit(200);

    if (error) throw error;
    // Devolver en orden cronológico (ascendente)
    return (data ?? []).reverse().map(dbEventToLog);
  } catch (err) {
    console.warn('[store] No se pudieron cargar logs históricos:', err.message);
    return [];
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useMissionStore = create((set, get) => {

  socket.on('connect', async () => {
    set({ connected: true });
    // Cargar histórico solo si el store está vacío (primera conexión)
    if (get().logs.length === 0) {
      const historical = await loadRecentLogsFromDb();
      if (historical.length > 0) {
        set(state => ({
          logs: historical.slice(-500),
        }));
        console.log(`[store] Cargados ${historical.length} logs históricos desde Supabase`);
      }
    }
  });

  socket.on('disconnect', () => set({ connected: false }));

  socket.on('agent_log', (log) => {
    set((state) => {
      const newLogs = [...state.logs, log];
      if (newLogs.length > 500) newLogs.shift();
      return { logs: newLogs };
    });
  });

  socket.on('agent_status', (agents) => set({ agents }));

  return {
    logs:         [],
    agents:       [],
    connected:    false,
    statusFilter: 'all',

    setStatusFilter: (filter) => set({ statusFilter: filter }),

    addLog: (log) => set((state) => {
      const newLogs = [...state.logs, log];
      if (newLogs.length > 500) newLogs.shift();
      return { logs: newLogs };
    }),

    setConnected: (status) => set({ connected: status }),
    setAgents:    (agents) => set({ agents }),

    connect:    () => { if (!socket.connected) socket.connect(); },
    disconnect: () => { if (socket.connected)  socket.disconnect(); },
  };
});
