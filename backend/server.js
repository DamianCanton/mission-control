const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors({ origin: '*' }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const AGENT_NAMES = ['Star Platinum', 'Sub-Agent Alpha', 'Sub-Agent Beta', 'Mission Control'];
const STATUSES = ['running', 'completed', 'thinking', 'error'];
const ACTIONS = ['Executing command', 'Parsing response', 'Fetching data', 'Analyzing context', 'Storing memory'];

let logIdCounter = 1;

// Lista inicial de agentes
let activeAgents = AGENT_NAMES.map((name, index) => ({
  id: `agent-${index + 1}`,
  name,
  status: 'running',
  lastSeen: new Date().toISOString()
}));

io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);
  
  // Enviar estado inicial
  socket.emit('agent_status', activeAgents);

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

// Mock timers desactivados — esperando eventos reales de OpenClaw

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Backend Server running on port ${PORT}`);
});
