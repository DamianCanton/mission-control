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
const SUPABASE_URL = process.env.SUPABASE_URL || null;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || null;

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  console.log('[supabase] Cliente inicializado:', SUPABASE_URL);
} else {
  console.warn('[supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configuradas — persistencia deshabilitada');
}

// ─── Estado ──────────────────────────────────────────────────────────────────
let logIdCounter = 1;
let activeAgents = {};

// Caches de IDs de Supabase
const agentIdCache  = {};   // agentName → agent_id (uuid)
const taskIdCache   = {};   // `agentName:action` → task_id (uuid)

// Cadenas causales — dos mecanismos combinados:
//   1. toolCallId map (preciso): toolCallId → eventId
//   2. stack (fallback): per-agent stack de eventIds
const toolCallEventMap = {}; // `agentName:toolCallId` → eventId
const eventStack       = {}; // agentName → [eventId, ...]

// ─── Helpers de parseo ────────────────────────────────────────────────────────

/**
 * Extrae pares key=value del mensaje de log.
 * Ejemplo: "tool=exec runId=abc123 toolCallId=toolu_bdrk_01XYZ"
 * → { tool: 'exec', runId: 'abc123', toolCallId: 'toolu_bdrk_01XYZ' }
 */
function parseKV(msg) {
  const kv = {};
  const re = /(\w+)=([^\s]+)/g;
  let m;
  while ((m = re.exec(msg)) !== null) {
    kv[m[1]] = m[2];
  }
  return kv;
}

/**
 * Clasifica mensajes del subsistema agent/embedded.
 * El formato siempre es "embedded run <tipo>: key=val ..."
 * Se chequea en orden de más a menos específico.
 */
function classifyEmbeddedRun(msg, kv) {
  if (msg.includes('tool start'))   return { type: 'tool_start',   tool: kv.tool,    toolCallId: kv.toolCallId };
  if (msg.includes('tool end'))     return { type: 'tool_end',     tool: kv.tool,    toolCallId: kv.toolCallId };
  if (msg.includes('agent end'))    return { type: 'agent_end',    isError: kv.isError === 'true' };
  if (msg.includes('prompt start')) return { type: 'prompt_start' };
  if (msg.includes('prompt end'))   return { type: 'prompt_end',   durationMs: Number(kv.durationMs) || 0 };
  if (msg.includes('agent start'))  return { type: 'agent_start'  };
  if (msg.includes('run done'))     return { type: 'run_done',     durationMs: Number(kv.durationMs) || 0, aborted: kv.aborted === 'true' };
  if (msg.includes('run start'))    return { type: 'run_start',    model: kv.model,  provider: kv.provider };
  return { type: 'unknown' };
}

// ─── Mapeo de acciones a estaciones ──────────────────────────────────────────

function mapActionToStation(action) {
  if (!action) return 'hq';
  const a = action.toLowerCase().trim();

  if (['idle', 'thinking', 'initializing', 'completed', 'error',
       'heartbeat', 'new', 'tool_done', 'agent_start'].includes(a)) return 'hq';
  if (a.endsWith('_done'))                                           return 'hq';
  if (a.includes('memory'))                                          return 'memory';
  if (a.includes('web_search') || a.includes('web_fetch') ||
      a.includes('search')     || a.includes('fetch'))              return 'search';
  if (a.includes('message') || a.includes('telegram') ||
      a.includes('discord')    || a.includes('tts') ||
      a.includes('send')       || a.includes('notify'))             return 'comms';
  if (a === 'read' || a === 'write' || a === 'edit' ||
      a.includes('file')  || a.includes('read') ||
      a.includes('write') || a.includes('edit'))                    return 'files';
  if (a === 'exec' || a.includes('exec') || a.includes('bash') ||
      a.includes('code')    || a.includes('run') ||
      a.includes('process') || a.includes('canvas') ||
      a.includes('browser'))                                        return 'dev';
  if (a.includes('agent')   || a.includes('session') ||
      a.includes('spawn')   || a.includes('subagent') ||
      a.includes('nodes'))                                          return 'agents';
  return 'hq';
}

// ─── Parser de línea de log ───────────────────────────────────────────────────

/**
 * Convierte una línea JSON del log de OpenClaw en un entry estructurado.
 * Retorna null para líneas de ruido puro que no aportan valor al dashboard.
 */
function mapLogEntry(raw) {
  let subsystem = '';
  try {
    const parsed = JSON.parse(raw['0']);
    subsystem = parsed.subsystem || '';
  } catch {
    subsystem = raw['0'] || '';
  }

  const msg  = raw['1'] || '';
  const time = raw.time || raw._meta?.date || new Date().toISOString();
  const kv   = parseKV(msg);

  const runId      = kv.runId      || null;
  const sessionId  = kv.sessionId  || null;
  const toolCallId = kv.toolCallId || null;

  // ── Ruido puro → skip ────────────────────────────────────────────────────
  if (subsystem === 'diagnostic') {
    // Lane plumbing: no value para el dashboard
    if (msg.includes('lane enqueue') ||
        msg.includes('lane dequeue') ||
        msg.includes('run registered') ||
        msg.includes('run cleared') ||
        msg.includes('lane task done') ||
        msg.includes('update available')) return null;
    return null; // todo lo diagnostic es ruido, filtrar
  }

  // ── agent/embedded: lógica principal ────────────────────────────────────
  if (subsystem === 'agent/embedded') {
    const ev = classifyEmbeddedRun(msg, kv);

    // Tipos que no aportan nada al dashboard
    if (ev.type === 'agent_start' ||
        ev.type === 'prompt_end'  ||
        ev.type === 'unknown')          return null;

    // agent_end sin error → run_done lo cubre
    if (ev.type === 'agent_end' && !ev.isError) return null;

    let action, status, details;

    switch (ev.type) {
      case 'run_start':
        action  = 'initializing';
        status  = 'running';
        details = `Sesión iniciada · model: ${ev.model ?? '?'} · provider: ${ev.provider ?? '?'}`;
        break;

      case 'prompt_start':
        action  = 'thinking';
        status  = 'thinking';
        details = '🤔 Procesando...';
        break;

      case 'tool_start':
        action  = ev.tool || 'exec';
        status  = 'running';
        details = `▶ ${ev.tool ?? 'tool'} iniciado`;
        break;

      case 'tool_end':
        action  = `${ev.tool || 'tool'}_done`;
        status  = 'completed';
        details = `✓ ${ev.tool ?? 'tool'} completado`;
        break;

      case 'agent_end': // isError === true
        action  = 'error';
        status  = 'error';
        details = '✗ Error en la ejecución del agente';
        break;

      case 'run_done':
        action  = ev.aborted ? 'error' : 'completed';
        status  = ev.aborted ? 'error' : 'completed';
        details = ev.aborted
          ? `✗ Abortado tras ${(ev.durationMs / 1000).toFixed(1)}s`
          : `✓ Listo · ${(ev.durationMs / 1000).toFixed(1)}s`;
        break;

      default:
        return null;
    }

    // Nombre del agente: detectar sub-agentes por subsystem o sessionId
    let agentName = 'Star Platinum';
    if (subsystem.includes('subagent') || (sessionId && sessionId !== 'main'))
      agentName = `Sub-Agent ${(runId || sessionId || '').slice(0, 6)}`;

    return {
      id:          logIdCounter++,
      timestamp:   time,
      agentName,
      runId,
      sessionId,
      toolCallId,
      action,
      status,
      subsystem,
      details,
    };
  }

  // ── gateway/channels → evento de comms ──────────────────────────────────
  if (subsystem.startsWith('gateway/channels/')) {
    const channel = subsystem.split('/').pop(); // 'telegram', 'discord', etc.
    if (!msg.includes('sendMessage ok') && !msg.includes('send ok')) return null;

    return {
      id:          logIdCounter++,
      timestamp:   time,
      agentName:   'Star Platinum',
      runId:       runId || 'main',
      sessionId:   null,
      toolCallId:  null,
      action:      'message',
      status:      'completed',
      subsystem,
      details:     `📨 Mensaje enviado · ${channel}`,
    };
  }

  // Todo lo demás → skip
  return null;
}

// ─── Helpers Supabase ─────────────────────────────────────────────────────────

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
 * Inserta un evento con parent_event_id resuelto por toolCallId (preciso)
 * con fallback al stack posicional.
 */
async function insertEvent(entry, agentId) {
  if (!supabase || !agentId) return null;

  // ── Resolver parent_event_id ──────────────────────────────────────────
  const tcKey = entry.toolCallId
    ? `${entry.agentName}:${entry.toolCallId}`
    : null;

  let parentId = null;
  if (tcKey && toolCallEventMap[tcKey]) {
    // tool_end → su parent ES el tool_start con el mismo toolCallId
    parentId = toolCallEventMap[tcKey];
  } else {
    // fallback: tope del stack posicional
    const stack = eventStack[entry.agentName] || [];
    parentId = stack.length > 0 ? stack[stack.length - 1] : null;
  }

  const eventId = randomUUID();
  const station = mapActionToStation(entry.action);

  try {
    const { error } = await supabase.from('agent_events').insert({
      id:              eventId,
      agent_id:        agentId,
      agent_name:      entry.agentName,
      action:          entry.action,
      status:          entry.status,
      station,
      occurred_at:     entry.timestamp,
      metadata: {
        subsystem:   entry.subsystem,
        details:     entry.details,
        toolCallId:  entry.toolCallId,
        sessionId:   entry.sessionId,
        runId:       entry.runId,
      },
      raw_log:         entry.details,
      parent_event_id: parentId,
    });
    if (error) throw error;

    // ── Actualizar estructuras de cadena causal ──────────────────────
    if (entry.status === 'running' && station !== 'hq') {
      // tool_start: registrar en map + push al stack
      if (!eventStack[entry.agentName]) eventStack[entry.agentName] = [];
      eventStack[entry.agentName].push(eventId);
      if (eventStack[entry.agentName].length > 8) eventStack[entry.agentName].shift();
      if (tcKey) toolCallEventMap[tcKey] = eventId;

    } else if (entry.action.endsWith('_done') ||
               entry.status === 'completed'   ||
               entry.status === 'error') {
      // tool_end / completado / error: pop del stack + limpiar map
      if (eventStack[entry.agentName]?.length > 0)
        eventStack[entry.agentName].pop();
      if (tcKey) delete toolCallEventMap[tcKey];
    }

    return eventId;
  } catch (err) {
    console.error('[supabase] insertEvent error:', err.message);
    return null;
  }
}

async function upsertTask(entry, agentId) {
  if (!supabase || !agentId) return;
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
        })
        .select('id')
        .single();
      if (error) throw error;
      taskIdCache[taskKey] = data.id;
    } else if (taskIdCache[taskKey] &&
               (entry.status === 'completed' || entry.status === 'error')) {
      const { error } = await supabase
        .from('tasks')
        .update({ status: entry.status, ended_at: entry.timestamp })
        .eq('id', taskIdCache[taskKey]);
      if (error) throw error;
      delete taskIdCache[taskKey];
    }
  } catch (err) {
    console.error('[supabase] upsertTask error:', err.message);
  }
}

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
  // OpenClaw puede escribir en /tmp/openclaw o /tmp/openclaw-<uid>
  // Buscar el directorio correcto dinámicamente
  const candidates = ['/tmp/openclaw-1000', '/tmp/openclaw'];
  let logDir = candidates.find(d => {
    try {
      const files = fs.readdirSync(d);
      return files.some(f => f.startsWith('openclaw-') && f.endsWith('.log'));
    } catch { return false; }
  }) || '/tmp/openclaw';
  const now    = new Date();
  const yyyy   = now.getFullYear();
  const mm     = String(now.getMonth() + 1).padStart(2, '0');
  const dd     = String(now.getDate()).padStart(2, '0');
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

// ─── Estado de agentes activos ────────────────────────────────────────────────

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
  // Eviction: sin actividad hace más de 5 min
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const k of Object.keys(activeAgents)) {
    if (new Date(activeAgents[k].lastSeen).getTime() < cutoff)
      delete activeAgents[k];
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

      // null = línea de ruido → skip
      if (!entry) return;

      // Adjuntar parentEventId para el WebSocket (el stack todavía no se actualizó)
      const currentStack = eventStack[entry.agentName] || [];
      const tcKey = entry.toolCallId ? `${entry.agentName}:${entry.toolCallId}` : null;
      entry.parentEventId =
        (tcKey && toolCallEventMap[tcKey]) ||
        (currentStack.length > 0 ? currentStack[currentStack.length - 1] : null);

      // 1. WebSocket — siempre, sincrónico
      io.emit('agent_log', entry);
      updateAgent(entry);

      // 2. Supabase — async, fire-and-forget
      persistEntry(entry);

    } catch {
      // línea no-JSON → ignorar
    }
  });

  tail.on('error', (err) => {
    console.error('[tailer] Error:', err.message);
  });

  // Reiniciar a medianoche cuando rota el log
  const now      = new Date();
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
