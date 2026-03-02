const express = require('express');
const { randomUUID } = require('crypto');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Tail } = require('tail');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors({ origin: '*' }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ─── Supabase ────────────────────────────────────────────────────────────────
// Si las env vars no están configuradas, DB queda deshabilitada y el backend
// sigue funcionando normalmente (solo WebSocket, sin persistencia).
const SUPABASE_URL = process.env.SUPABASE_URL || null;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || null;

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log('[supabase] Cliente inicializado:', SUPABASE_URL);
} else {
  console.warn('[supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configuradas — persistencia deshabilitada');
}

// ─── Estado de agentes en memoria ───────────────────────────────────────────
let logIdCounter = 1;
let activeAgents = {}; // keyed by agentName

// Cache de IDs de Supabase para evitar lookups repetidos
// { agentName -> agent_id (uuid) }
const agentIdCache = {};
// { runId -> task_id (uuid) }
const taskIdCache = {};
// Stack de eventos activos por agente para cadenas causales
// { agentName -> [eventId, ...] }  (tope = evento activo actual)
const eventStack = {};

// ─── Helpers Supabase (async, fire-and-forget, nunca bloquean el WebSocket) ──

/**
 * Mapea una acción del log a las 7 estaciones definidas.
 *
 * Estaciones: hq · dev · files · search · memory · comms · wildcard
 *
 * Orden de evaluación: de más específico a más general.
 * El fallback es 'hq' (no 'wildcard') para estados genéricos del agente.
 */
function mapActionToStation(action) {
  if (!action) return 'hq';
  const a = action.toLowerCase().trim();

  // 1. HQ — estados del agente, no tool calls
  if (['idle', 'thinking', 'initializing', 'completed', 'error',
       'heartbeat', 'new', 'tool_done'].includes(a)) return 'hq';
  if (a.endsWith('_done')) return 'hq';

  // 2. Memory
  if (a.includes('memory')) return 'memory';

  // 3. Search / Web
  if (a.includes('web_search') || a.includes('web_fetch') ||
      a.includes('search') || a.includes('fetch')) return 'search';

  // 4. Browser
  if (a.includes('browser')) return 'browser';

  // 5. Comms — mensajería y voz
  if (a.includes('message') || a.includes('telegram') ||
      a.includes('discord') || a.includes('tts') ||
      a.includes('send') || a.includes('notify')) return 'comms';

  // 6. Files — operaciones de archivo
  if (a === 'read' || a === 'write' || a === 'edit' ||
      a.includes('file') || a.includes('read') ||
      a.includes('write') || a.includes('edit')) return 'files';

  // 7. Dev — ejecución de código y shell
  if (a === 'exec' || a.includes('exec') || a.includes('bash') ||
      a.includes('code') || a.includes('run') ||
      a.includes('process') || a.includes('canvas')) return 'dev';

  // 8. Agents — sesiones y sub-agentes
  if (a.includes('agent') || a.includes('session') ||
      a.includes('spawn') || a.includes('subagent') ||
      a.includes('nodes')) return 'agents';

  // Fallback → hq (el agente está activo pero no en una tool conocida)
  return 'hq';
}

/**
 * Obtiene o crea un agente en la tabla `agents`.
 * Retorna el agent_id (uuid) o null si Supabase no está disponible.
 */
async function upsertAgent(agentName) {
  if (!supabase) return null;
  if (agentIdCache[agentName]) return agentIdCache[agentName];

  try {
    const { data, error } = await supabase
      .from('agents')
      .upsert({ name: agentName }, { onConflict: 'name', ignoreDuplicates: false })
      .select('id')
      .single();

    if (error) throw error;
    agentIdCache[agentName] = data.id;
    return data.id;
  } catch (err) {
    console.error('[supabase] upsertAgent error:', err.message);
    return null;
  }
}

/**
 * Inserta un evento en la tabla `agent_events`.
 * Gestiona el stack de cadenas causales por agente:
 *   - Eventos "tool start" (running, station != hq) → se pushean al stack
 *   - Eventos "tool end" (_done / completed / error) → popean el stack
 *   - Todos los eventos reciben parent_event_id = tope actual del stack
 * Retorna el eventId generado (para el WebSocket).
 */
async function insertEvent(entry, agentId) {
  if (!supabase || !agentId) return null;

  const stack    = eventStack[entry.agentName] || [];
  const parentId = stack.length > 0 ? stack[stack.length - 1] : null;
  const eventId  = randomUUID();
  const station  = mapActionToStation(entry.action);

  try {
    const { error } = await supabase.from('agent_events').insert({
      id:              eventId,
      agent_id:        agentId,
      agent_name:      entry.agentName,
      action:          entry.action,
      status:          entry.status,
      station:         station,
      occurred_at:     entry.timestamp,
      metadata:        { subsystem: entry.subsystem, details: entry.details },
      raw_log:         entry.details,
      parent_event_id: parentId,
      // session_id omitido — nullable en MVP
    });
    if (error) throw error;

    // ── Gestión del stack ──────────────────────────────────────────────────
    // Push: tool activa (running) que NO sea hq (no queremos thinking/idle en el stack)
    if (entry.status === 'running' && station !== 'hq') {
      if (!eventStack[entry.agentName]) eventStack[entry.agentName] = [];
      eventStack[entry.agentName].push(eventId);
      // Cap: máximo 8 niveles de profundidad para evitar leaks
      if (eventStack[entry.agentName].length > 8)
        eventStack[entry.agentName].shift();
    }
    // Pop: tool terminada
    else if (entry.action.endsWith('_done') ||
             entry.status === 'completed'   ||
             entry.status === 'error') {
      if (eventStack[entry.agentName]?.length > 0)
        eventStack[entry.agentName].pop();
    }

    return eventId;
  } catch (err) {
    console.error('[supabase] insertEvent error:', err.message);
    return null;
  }
}

/**
 * Crea o actualiza un registro en la tabla `tasks`.
 * - status 'running' + tarea nueva → INSERT
 * - status 'completed' / 'error'   → UPDATE con ended_at
 */
async function upsertTask(entry, agentId) {
  if (!supabase || !agentId) return;

  // Solo crear task para eventos "tool start" (running)
  // y cerrarla en completed/error
  const taskKey = `${entry.agentName}:${entry.action}`;

  try {
    if (entry.status === 'running' && !taskIdCache[taskKey]) {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          agent_id:   agentId,
          title:      entry.action,
          status:     'running',
          station:    mapActionToStation(entry.action),
          started_at: entry.timestamp,
          // session_id omitido — nullable en MVP
        })
        .select('id')
        .single();

      if (error) throw error;
      taskIdCache[taskKey] = data.id;

    } else if (taskIdCache[taskKey] && (entry.status === 'completed' || entry.status === 'error')) {
      const { error } = await supabase
        .from('tasks')
        .update({
          status:   entry.status,
          ended_at: entry.timestamp,
        })
        .eq('id', taskIdCache[taskKey]);

      if (error) throw error;
      delete taskIdCache[taskKey];
    }
  } catch (err) {
    console.error('[supabase] upsertTask error:', err.message);
  }
}

/**
 * Punto central de persistencia. Fire-and-forget, nunca bloquea el WebSocket.
 * Retorna una Promise con el eventId generado (para enriquecer el WebSocket emit).
 */
async function persistEntry(entry) {
  if (!supabase) return null;

  const agentId = await upsertAgent(entry.agentName);
  if (!agentId) return null;

  const [eventId] = await Promise.all([
    insertEvent(entry, agentId),
    upsertTask(entry, agentId),
  ]).catch(() => [null]);

  return eventId;
}

// ─── Log path ────────────────────────────────────────────────────────────────
function getLogPath() {
  const logDir = '/tmp/openclaw';
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const todayPath = `${logDir}/openclaw-${yyyy}-${mm}-${dd}.log`;
  if (fs.existsSync(todayPath)) return todayPath;

  try {
    const files = fs.readdirSync(logDir)
      .filter(f => f.startsWith('openclaw-') && f.endsWith('.log'))
      .map(f => ({ name: f, mtime: fs.statSync(`${logDir}/${f}`).mtime }))
      .sort((a, b) => b.mtime - a.mtime);
    if (files.length > 0) {
      const latest = `${logDir}/${files[0].name}`;
      console.log(`[tailer] Archivo de hoy no encontrado, usando más reciente: ${files[0].name}`);
      return latest;
    }
  } catch {}

  return todayPath;
}

// ─── Mapeo de log raw → entry estructurado ───────────────────────────────────
function mapLogEntry(raw) {
  const subsystem = (() => {
    try { return JSON.parse(raw['0']).subsystem || ''; } catch { return raw['0'] || ''; }
  })();
  const msg  = raw['1'] || '';
  const time = raw.time || raw._meta?.date || new Date().toISOString();

  const runIdMatch   = msg.match(/runId=([^\s]+)/);
  const toolMatch    = msg.match(/tool=([^\s]+)/);
  const sessionMatch = msg.match(/sessionId=([^\s]+)/);

  const runId = runIdMatch?.[1] || sessionMatch?.[1] || 'main';
  const tool  = toolMatch?.[1]  || null;

  let agentName = 'Star Platinum';
  if (subsystem.includes('subagent') || msg.includes('subagent'))
    agentName = `Sub-Agent ${runId.slice(0, 6)}`;
  else if (subsystem.includes('diagnostic'))
    agentName = 'System';

  let action = 'idle';
  if (tool)                              action = tool;
  else if (msg.includes('tool start'))   action = toolMatch?.[1] || 'exec';
  else if (msg.includes('tool end'))     action = `${toolMatch?.[1] || 'tool'}_done`;
  else if (msg.includes('prompt start')) action = 'thinking';
  else if (msg.includes('agent start'))  action = 'initializing';
  else if (msg.includes('run complete')) action = 'completed';
  else if (msg.includes('error'))        action = 'error';

  let status = 'running';
  if (action === 'completed' || msg.includes('run complete')) status = 'completed';
  else if (action === 'thinking' || msg.includes('prompt start')) status = 'thinking';
  else if (action === 'error'    || msg.includes('error'))        status = 'error';
  else if (msg.includes('tool start'))                            status = 'running';

  return {
    id: logIdCounter++,
    timestamp: time,
    agentName,
    runId,
    action,
    status,
    subsystem,
    details: msg.length > 120 ? msg.slice(0, 120) + '…' : msg,
  };
}

// ─── Actualizar agentes activos en memoria y emitir agent_status ─────────────
function updateAgent(entry) {
  const key = entry.agentName;

  if (!activeAgents[key]) {
    activeAgents[key] = {
      id:        key,
      agentName: key,
      action:    entry.action,
      status:    entry.status,
      lastSeen:  entry.timestamp,
    };
  } else {
    activeAgents[key].action   = entry.action;
    activeAgents[key].status   = entry.status;
    activeAgents[key].lastSeen = entry.timestamp;
  }

  // Eviction: agentes sin actividad hace más de 5 min
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const k of Object.keys(activeAgents)) {
    if (new Date(activeAgents[k].lastSeen).getTime() < cutoff) {
      delete activeAgents[k];
    }
  }

  io.emit('agent_status', Object.values(activeAgents));
}

// ─── Tailer ───────────────────────────────────────────────────────────────────
let tail = null;

function startTailer() {
  const logPath = getLogPath();

  if (!fs.existsSync(logPath)) {
    console.log(`[tailer] Log no encontrado: ${logPath} — reintentando en 10s`);
    setTimeout(startTailer, 10000);
    return;
  }

  console.log(`[tailer] Leyendo: ${logPath}`);
  tail = new Tail(logPath, { follow: true, fromBeginning: false });

  tail.on('line', (line) => {
    try {
      const raw   = JSON.parse(line);
      const entry = mapLogEntry(raw);

      const skip = ['abort failed', 'heartbeat', 'keepalive'];
      if (skip.some(s => entry.details.includes(s))) return;

      // 1. Capturar parent_event_id del stack ANTES de persistir
      //    (el stack se actualiza dentro de insertEvent, pero el parent actual
      //     ya está en el tope AHORA, antes del push)
      const currentStack = eventStack[entry.agentName] || [];
      entry.parentEventId = currentStack.length > 0
        ? currentStack[currentStack.length - 1]
        : null;

      // 2. WebSocket — siempre, sincrónico, con parentEventId ya adjunto
      io.emit('agent_log', entry);
      updateAgent(entry);

      // 3. Supabase — async, fire-and-forget, nunca bloquea el stream
      persistEntry(entry);

    } catch {
      // línea no-JSON, ignorar
    }
  });

  tail.on('error', (err) => {
    console.error('[tailer] Error:', err.message);
  });

  // Reiniciar tailer a medianoche cuando rota el archivo de log
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 5, 0);
  setTimeout(() => {
    if (tail) tail.unwatch();
    startTailer();
  }, midnight - now);
}

// ─── WebSocket ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('[ws] Cliente conectado:', socket.id);
  socket.emit('agent_status', Object.values(activeAgents));
  socket.on('disconnect', () => console.log('[ws] Cliente desconectado:', socket.id));
});

// ─── Arranque ─────────────────────────────────────────────────────────────────
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`[server] Mission Control backend en puerto ${PORT}`);
  startTailer();
});
