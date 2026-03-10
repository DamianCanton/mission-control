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
 *
 * Formato actual de OpenClaw (desde ~2026-03):
 *   - NO existe más el subsystem agent/embedded
 *   - Señales útiles: gateway/channels/*, gateway (model info), hooks/session-memory, [tools] errors
 */
function mapLogEntry(raw) {
  let subsystem = '';
  const raw0 = raw['0'] || '';
  try {
    const parsed = JSON.parse(raw0);
    subsystem = parsed.subsystem || '';
  } catch {
    // raw0 es texto plano — puede ser "[tools] ...", ANSI, etc.
    subsystem = '';
  }

  // Mensaje: field '1' si hay subsystem, si no el raw0 es el mensaje
  const msg  = subsystem ? String(raw['1'] || '') : String(raw0);
  const time = raw.time || raw._meta?.date || new Date().toISOString();
  const kv   = parseKV(msg);

  const runId      = kv.runId      || null;
  const sessionId  = kv.sessionId  || null;
  const toolCallId = kv.toolCallId || null;

  // ── Ruido puro → skip ────────────────────────────────────────────────────
  if (subsystem === 'diagnostic') return null;

  // ── agent/embedded → errores y eventos de run ────────────────────────────
  if (subsystem === 'agent/embedded') {
    const kv2 = parseKV(msg);
    // Solo capturar agent end con error (isError=true o error=terminated)
    if (msg.includes('agent end') && (kv2.isError === 'true' || kv2.error)) {
      return {
        id:        logIdCounter++,
        timestamp: time,
        agentName: 'Star Platinum',
        runId:     kv2.runId || null,
        sessionId: null,
        toolCallId: null,
        action:    'error',
        status:    'error',
        subsystem,
        details:   `✗ Agente terminado${kv2.error ? ` · ${kv2.error}` : ''}`,
      };
    }
    // run_start
    if (msg.includes('run start')) {
      return {
        id:        logIdCounter++,
        timestamp: time,
        agentName: 'Star Platinum',
        runId:     kv2.runId || null,
        sessionId: null,
        toolCallId: null,
        action:    'initializing',
        status:    'running',
        subsystem,
        details:   `⭐ Run iniciado · ${kv2.model || '?'}`,
      };
    }
    // tool_start
    if (msg.includes('tool start') && kv2.tool) {
      return {
        id:        logIdCounter++,
        timestamp: time,
        agentName: 'Star Platinum',
        runId:     kv2.runId || null,
        sessionId: null,
        toolCallId: kv2.toolCallId || null,
        action:    kv2.tool,
        status:    'running',
        subsystem,
        details:   `▶ ${kv2.tool} iniciado`,
      };
    }
    // tool_end
    if (msg.includes('tool end') && kv2.tool) {
      return {
        id:        logIdCounter++,
        timestamp: time,
        agentName: 'Star Platinum',
        runId:     kv2.runId || null,
        sessionId: null,
        toolCallId: kv2.toolCallId || null,
        action:    `${kv2.tool}_done`,
        status:    'completed',
        subsystem,
        details:   `✓ ${kv2.tool} completado`,
      };
    }
    // run_done
    if (msg.includes('run done')) {
      const aborted = kv2.aborted === 'true';
      const dur = kv2.durationMs ? (Number(kv2.durationMs) / 1000).toFixed(1) : '?';
      return {
        id:        logIdCounter++,
        timestamp: time,
        agentName: 'Star Platinum',
        runId:     kv2.runId || null,
        sessionId: null,
        toolCallId: null,
        action:    aborted ? 'error' : 'completed',
        status:    aborted ? 'error' : 'completed',
        subsystem,
        details:   aborted ? `✗ Abortado · ${dur}s` : `✓ Listo · ${dur}s`,
      };
    }
    return null;
  }

  // ── gateway principal → modelo del agente (startup) ──────────────────────
  if (subsystem === 'gateway') {
    // "agent model: github-copilot/claude-opus-4.6"
    if (msg.includes('agent model:')) {
      const model = msg.split('agent model:')[1]?.trim() || '?';
      return {
        id:        logIdCounter++,
        timestamp: time,
        agentName: 'Star Platinum',
        runId:     'main',
        sessionId: null,
        toolCallId: null,
        action:    'initializing',
        status:    'running',
        subsystem,
        details:   `⭐ Gateway iniciado · ${model}`,
      };
    }
    return null;
  }

  // ── hooks/session-memory → actividad de memoria ──────────────────────────
  if (subsystem === 'hooks/session-memory') {
    if (!msg.includes('Session context saved')) return null;
    const match = msg.match(/memory\/(.+)$/);
    const file  = match ? match[1] : 'memoria';
    return {
      id:        logIdCounter++,
      timestamp: time,
      agentName: 'Star Platinum',
      runId:     'main',
      sessionId: null,
      toolCallId: null,
      action:    'memory',
      status:    'completed',
      subsystem,
      details:   `🧠 Memoria guardada · ${file}`,
    };
  }

  // ── [tools] texto plano → errores de herramientas ────────────────────────
  if (subsystem === '' && msg.startsWith('[tools]') && msg.includes('failed')) {
    const toolMatch = msg.match(/\[tools\]\s+(\w+)\s+failed:\s*(.+)/);
    const tool   = toolMatch ? toolMatch[1] : 'tool';
    const errMsg = toolMatch ? toolMatch[2].slice(0, 80) : msg.slice(0, 80);
    return {
      id:        logIdCounter++,
      timestamp: time,
      agentName: 'Star Platinum',
      runId:     'main',
      sessionId: null,
      toolCallId: null,
      action:    tool,
      status:    'error',
      subsystem: 'tools',
      details:   `✗ ${tool}: ${errMsg}`,
    };
  }

  // ── gateway/ws → send de mensaje al canal ────────────────────────────────
  if (subsystem === 'gateway/ws') {
    // "⇄ res ✓ send 414ms channel=telegram conn=... id=..."
    if (msg.includes('res ✓ send') && msg.includes('channel=')) {
      const chMatch  = msg.match(/channel=(\S+)/);
      const durMatch = msg.match(/✓ send\s+(\d+)ms/);
      const channel  = chMatch  ? chMatch[1]  : 'channel';
      const dur      = durMatch ? durMatch[1] : '?';
      return {
        id:        logIdCounter++,
        timestamp: time,
        agentName: 'Star Platinum',
        runId:     'main',
        sessionId: null,
        toolCallId: null,
        action:    'message',
        status:    'completed',
        subsystem,
        details:   `📨 Mensaje enviado · ${channel} · ${dur}ms`,
      };
    }
    // "⇄ res ✓ agent.wait Nms" → agente procesando
    if (msg.includes('res ✓ agent.wait')) {
      const durMatch = msg.match(/agent\.wait\s+(\d+)ms/);
      const dur      = durMatch ? durMatch[1] : '?';
      return {
        id:        logIdCounter++,
        timestamp: time,
        agentName: 'Star Platinum',
        runId:     'main',
        sessionId: null,
        toolCallId: null,
        action:    'thinking',
        status:    'completed',
        subsystem,
        details:   `🤔 Respuesta generada · ${dur}ms`,
      };
    }
    return null;
  }

  // ── gateway/channels → mensaje enviado (fallback) ─────────────────────────
  if (subsystem.startsWith('gateway/channels/')) {
    const channel = subsystem.split('/').pop();
    if (!msg.includes('sendMessage ok') && !msg.includes('send ok')) return null;

    const chatMatch = msg.match(/chat=(\S+)/);
    const msgMatch  = msg.match(/message=(\S+)/);
    const msgId     = msgMatch ? msgMatch[1] : '';

    return {
      id:        logIdCounter++,
      timestamp: time,
      agentName: 'Star Platinum',
      runId:     runId || 'main',
      sessionId: null,
      toolCallId: null,
      action:    'message',
      status:    'completed',
      subsystem,
      details:   `📨 Mensaje enviado · ${channel}${msgId ? ` · #${msgId}` : ''}`,
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
  // Eviction: sin actividad hace más de 30 min
  const cutoff = Date.now() - 30 * 60 * 1000;
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
