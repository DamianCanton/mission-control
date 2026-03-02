import { create } from 'zustand';
import { io } from 'socket.io-client';
import { supabase } from '../lib/supabaseClient';
import { getStationForAction, getHomeStation } from '../lib/stationMap';

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
    toolCallId: ev.metadata?.toolCallId ?? null,
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
    return (data ?? []).reverse().map(dbEventToLog);
  } catch (err) {
    console.warn('[store] No se pudieron cargar logs históricos:', err.message);
    return [];
  }
}

// ─── Gestión de conexiones activas ───────────────────────────────────────────
//
// Modelo correcto:
//   - tool_start  → crea conexión home→estación mientras dure el tool call
//   - tool_end    → cierra esa conexión + emite un pulso de completado
//   - thinking    → agente pensando en HQ (sin conexión externa)
//   - run_done    → pulso final en HQ
//
// Cada conexión tiene:
//   { id, agentName, from, to, color, toolCallId, born }
// Los pulsos tienen:
//   { id, agentName, station, color, born }

function processLogForConnections(log, connections, pulses) {
  const { agentName, action, status, toolCallId } = log;
  const homeStation = getHomeStation(agentName);
  const toolStation = getStationForAction(action);

  const newConnections = [...connections];
  const newPulses      = [...pulses];
  const connKey        = toolCallId
    ? `${agentName}:${toolCallId}`
    : `${agentName}:${action}`;

  if (status === 'running' && toolStation !== 'hq' && toolStation !== homeStation) {
    // tool_start: abrir conexión home → estación, si no existe ya
    const exists = newConnections.some(c => c.id === connKey);
    if (!exists) {
      newConnections.push({
        id:          connKey,
        agentName,
        fromStation: homeStation,
        toStation:   toolStation,
        toolCallId:  toolCallId ?? null,
        born:        Date.now(),
      });
    }

  } else if (action.endsWith('_done') || status === 'completed') {
    // tool_end: cerrar la conexión correspondiente + emitir pulso
    const idx = newConnections.findIndex(c => c.id === connKey);
    if (idx !== -1) {
      const conn = newConnections[idx];
      // Pulso en la estación de destino al completar
      newPulses.push({
        id:      `pulse-${Date.now()}-${Math.random()}`,
        station: conn.toStation,
        born:    Date.now(),
      });
      newConnections.splice(idx, 1);
    }

  } else if (action === 'completed' || (action === 'run_done' && status === 'completed')) {
    // Run completo: pulso en HQ
    newPulses.push({
      id:      `pulse-hq-${Date.now()}`,
      station: homeStation,
      born:    Date.now(),
    });
    // Limpiar todas las conexiones de este agente (cierre limpio)
    return {
      connections: newConnections.filter(c => c.agentName !== agentName),
      pulses:      newPulses,
    };
  }

  // GC: conexiones de más de 60s (tool call muy largo / never closed)
  const cutoff = Date.now() - 60_000;
  return {
    connections: newConnections.filter(c => c.born > cutoff),
    pulses:      newPulses,
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useMissionStore = create((set, get) => {

  socket.on('connect', async () => {
    set({ connected: true });
    if (get().logs.length === 0) {
      const historical = await loadRecentLogsFromDb();
      if (historical.length > 0) {
        set({ logs: historical.slice(-500) });
        console.log(`[store] Cargados ${historical.length} logs históricos desde Supabase`);
      }
    }
  });

  socket.on('disconnect', () => set({ connected: false }));

  socket.on('agent_log', (log) => {
    set((state) => {
      const newLogs = [...state.logs, log];
      if (newLogs.length > 500) newLogs.shift();

      // Actualizar conexiones y pulsos basado en este evento
      const { connections, pulses } = processLogForConnections(
        log,
        state.connections,
        state.pulses,
      );

      return { logs: newLogs, connections, pulses };
    });
  });

  socket.on('agent_status', (agents) => set({ agents }));

  // GC de pulsos cada 3s (duran 2.5s en el render)
  setInterval(() => {
    set(state => ({
      pulses: state.pulses.filter(p => Date.now() - p.born < 3000),
    }));
  }, 3000);

  return {
    logs:         [],
    agents:       [],
    connections:  [],   // conexiones activas (tools en curso)
    pulses:       [],   // pulsos efímeros de completado
    connected:    false,
    statusFilter: 'all',

    setStatusFilter: (filter) => set({ statusFilter: filter }),
    setConnected:    (v)      => set({ connected: v }),
    setAgents:       (a)      => set({ agents: a }),
    connect:    () => { if (!socket.connected) socket.connect(); },
    disconnect: () => { if (socket.connected)  socket.disconnect(); },
  };
});
