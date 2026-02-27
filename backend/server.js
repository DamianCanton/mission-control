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

// Emisión periódica de logs (cada 2 segundos)
setInterval(() => {
  const randomAgent = AGENT_NAMES[Math.floor(Math.random() * AGENT_NAMES.length)];
  const randomStatus = STATUSES[Math.floor(Math.random() * STATUSES.length)];
  const randomAction = ACTIONS[Math.floor(Math.random() * ACTIONS.length)];

  const logEntry = {
    id: logIdCounter++,
    timestamp: new Date().toISOString(),
    agentName: randomAgent,
    action: randomAction,
    status: randomStatus,
    details: `Generated log detailing ${randomAction.toLowerCase()} operation`
  };

  io.emit('agent_log', logEntry);
  
  // Actualizar el estado del agente y notificar
  const agentIndex = activeAgents.findIndex(a => a.name === randomAgent);
  if (agentIndex !== -1) {
    activeAgents[agentIndex].status = randomStatus;
    activeAgents[agentIndex].lastSeen = new Date().toISOString();
  } else {
      activeAgents.push({
          id: `agent-${activeAgents.length + 1}`,
          name: randomAgent,
          status: randomStatus,
          lastSeen: new Date().toISOString()
      })
  }

}, 2000);

// Emisión periódica de estado de agentes (cada 5 segundos)
setInterval(() => {
    io.emit('agent_status', activeAgents);
}, 5000);

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Backend Server running on port ${PORT}`);
});
