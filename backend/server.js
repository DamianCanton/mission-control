const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Tail } = require('tail');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors({ origin: '*' }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ─── Estado de agentes en memoria ───────────────────────────────────────────
let logIdCounter = 1;
let activeAgents = {}; // keyed by runId

function getLogPath() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `/tmp/openclaw/openclaw-${yyyy}-${mm}-${dd}.log`;
}

// ─── Mapeo de subsistema + mensaje a campos del frontend ────────────────────
function mapLogEntry(raw) {
  const subsystem = (() => {
    try { return JSON.parse(raw['0']).subsystem || ''; } catch { return raw['0'] || ''; }
  })();
  const msg = raw['1'] || '';
  const time = raw.time || raw._meta?.date || new Date().toISOString();

  // Extraer runId y tool del mensaje
  const runIdMatch = msg.match(/runId=([^\s]+)/);
  const toolMatch  = msg.match(/tool=([^\s]+)/);
  const sessionMatch = msg.match(/sessionId=([^\s]+)/);

  const runId   = runIdMatch?.[1]  || sessionMatch?.[1] || 'main';
  const tool    = toolMatch?.[1]   || null;

  // Determinar agentName
  let agentName = 'Star Platinum';
  if (subsystem.includes('subagent') || msg.includes('subagent')) agentName = `Sub-Agent ${runId.slice(0, 6)}`;
  else if (subsystem.includes('embedded')) agentName = 'Star Platinum';
  else if (subsystem.includes('diagnostic')) agentName = 'System';

  // Determinar action
  let action = 'idle';
  if (tool)                              action = tool;
  else if (msg.includes('tool start'))   action = toolMatch?.[1] || 'exec';
  else if (msg.includes('tool end'))     action = `${toolMatch?.[1] || 'tool'}_done`;
  else if (msg.includes('prompt start')) action = 'thinking';
  else if (msg.includes('agent start'))  action = 'initializing';
  else if (msg.includes('run complete')) action = 'completed';
  else if (msg.includes('error'))        action = 'error';

  // Determinar status
  let status = 'running';
  if (action === 'completed' || msg.includes('run complete')) status = 'completed';
  else if (action === 'thinking' || msg.includes('prompt start')) status = 'thinking';
  else if (action === 'error' || msg.includes('error'))           status = 'error';
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

// ─── Actualizar agentes activos y emitir agent_status ───────────────────────
function updateAgent(entry) {
  const key = entry.agentName;

  if (!activeAgents[key]) {
    activeAgents[key] = {
      id: key,
      agentName: key,
      action: entry.action,
      status: entry.status,
      lastSeen: entry.timestamp,
    };
  } else {
    activeAgents[key].action   = entry.action;
    activeAgents[key].status   = entry.status;
    activeAgents[key].lastSeen = entry.timestamp;
  }

  // Limpiar agentes que no se ven hace más de 5 minutos
  const cutoff = Date.now() - 5 * 60 * 1000;
  for (const k of Object.keys(activeAgents)) {
    if (new Date(activeAgents[k].lastSeen).getTime() < cutoff) {
      delete activeAgents[k];
    }
  }

  io.emit('agent_status', Object.values(activeAgents));
}

// ─── Iniciar el tailer con retry si el archivo no existe aún ────────────────
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
      const raw = JSON.parse(line);
      const entry = mapLogEntry(raw);

      // Filtrar líneas muy ruidosas (diagnóstico de abort / heartbeat)
      const skip = ['abort failed', 'heartbeat', 'keepalive'];
      if (skip.some(s => entry.details.includes(s))) return;

      io.emit('agent_log', entry);
      updateAgent(entry);
    } catch {
      // línea no-JSON, ignorar
    }
  });

  tail.on('error', (err) => {
    console.error('[tailer] Error:', err.message);
  });

  // A medianoche el archivo cambia — reiniciar el tailer al día siguiente
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 5, 0);
  const msToMidnight = midnight - now;
  setTimeout(() => {
    if (tail) tail.unwatch();
    startTailer();
  }, msToMidnight);
}

// ─── MODO DEMO ───────────────────────────────────────────────────────────────
const DEMO_AGENTS = [
  { name: 'Star Platinum',  emoji: '⭐' },
  { name: 'Hierophant',     emoji: '🌊' },
  { name: 'Magician\'s Red',emoji: '🔥' },
  { name: 'Silver Chariot', emoji: '⚔️'  },
  { name: 'The Fool',       emoji: '🃏' },
  { name: 'Crazy Diamond', emoji: '💎' },
  { name: 'Killer Queen',   emoji: '💣' },
  { name: 'Gold Experience',emoji: '🌿' },
];

const DEMO_ACTIONS = [
  { action: 'web_search',   status: 'running',   station: 'search'    },
  { action: 'read_file',    status: 'running',   station: 'files'     },
  { action: 'write_file',   status: 'running',   station: 'files'     },
  { action: 'exec_command', status: 'running',   station: 'dev'       },
  { action: 'memory_search',status: 'running',   station: 'memory'    },
  { action: 'send_message', status: 'running',   station: 'comms'     },
  { action: 'browser_open', status: 'running',   station: 'browser'   },
  { action: 'spawn_agent',  status: 'running',   station: 'subagents' },
  { action: 'thinking',     status: 'thinking',  station: 'hq'        },
  { action: 'initializing', status: 'running',   station: 'hq'        },
  { action: 'completed',    status: 'completed', station: 'hq'        },
  { action: 'error',        status: 'error',     station: 'misc'      },
];

let demoInterval = null;
let demoAgentStates = {};

function getStationForAction(action) {
  const a = action.toLowerCase();
  if (a.includes('search') || a.includes('fetch')) return 'search';
  if (a.includes('exec') || a.includes('code'))    return 'dev';
  if (a.includes('read') || a.includes('write'))   return 'files';
  if (a.includes('memory'))                        return 'memory';
  if (a.includes('message') || a.includes('send')) return 'comms';
  if (a.includes('browser'))                       return 'browser';
  if (a.includes('spawn') || a.includes('agent'))  return 'subagents';
  if (a.includes('thinking') || a.includes('init') || a.includes('completed')) return 'hq';
  return 'misc';
}

function startDemo() {
  if (demoInterval) return;
  console.log('[demo] Iniciando modo demo');

  // Estado inicial: todos en HQ pensando
  demoAgentStates = {};
  DEMO_AGENTS.forEach(ag => {
    demoAgentStates[ag.name] = {
      id: ag.name,
      agentName: ag.name,
      action: 'thinking',
      status: 'thinking',
      lastSeen: new Date().toISOString(),
    };
  });

  io.emit('agent_status', Object.values(demoAgentStates));

  // Cada 1.5s actualizar un agente aleatorio
  demoInterval = setInterval(() => {
    const ag = DEMO_AGENTS[Math.floor(Math.random() * DEMO_AGENTS.length)];
    const task = DEMO_ACTIONS[Math.floor(Math.random() * DEMO_ACTIONS.length)];

    const entry = {
      id: logIdCounter++,
      timestamp: new Date().toISOString(),
      agentName: ag.name,
      runId: `demo-${ag.name.toLowerCase().replace(/\s/g, '-')}`,
      action: task.action,
      status: task.status,
      details: `[DEMO] ${ag.emoji} ${ag.name} → ${task.action}`,
    };

    // Actualizar estado del agente
    demoAgentStates[ag.name] = {
      id: ag.name,
      agentName: ag.name,
      action: task.action,
      status: task.status,
      lastSeen: entry.timestamp,
    };

    io.emit('agent_log', entry);
    io.emit('agent_status', Object.values(demoAgentStates));
  }, 1500);
}

function stopDemo() {
  if (demoInterval) {
    clearInterval(demoInterval);
    demoInterval = null;
    demoAgentStates = {};
    io.emit('agent_status', []);
    console.log('[demo] Modo demo detenido');
  }
}

// Endpoints HTTP para controlar el demo
app.get('/api/demo/start', (_, res) => { startDemo(); res.json({ ok: true, msg: 'Demo iniciado' }); });
app.get('/api/demo/stop',  (_, res) => { stopDemo();  res.json({ ok: true, msg: 'Demo detenido' }); });
app.get('/api/demo/status',(_, res) => res.json({ running: !!demoInterval, agents: Object.keys(demoAgentStates).length }));

// ─── WebSocket ───────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('[ws] Cliente conectado:', socket.id);
  // Enviar estado actual al nuevo cliente
  const state = demoInterval
    ? Object.values(demoAgentStates)
    : Object.values(activeAgents);
  socket.emit('agent_status', state);
  socket.on('disconnect', () => console.log('[ws] Cliente desconectado:', socket.id));
});

// ─── Arranque ────────────────────────────────────────────────────────────────
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`[server] Mission Control backend en puerto ${PORT}`);
  startTailer();
});
