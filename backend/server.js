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

// ─── WebSocket ───────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('[ws] Cliente conectado:', socket.id);
  // Enviar estado actual al nuevo cliente
  socket.emit('agent_status', Object.values(activeAgents));
  socket.on('disconnect', () => console.log('[ws] Cliente desconectado:', socket.id));
});

// ─── Arranque ────────────────────────────────────────────────────────────────
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`[server] Mission Control backend en puerto ${PORT}`);
  startTailer();
});
