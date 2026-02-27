import { create } from 'zustand';
import { io } from 'socket.io-client';

const host = window.location.hostname;
const socketUrl = `http://${host}:3000`;
const socket = io(socketUrl, {
  autoConnect: true,
});

export const useMissionStore = create((set) => {
  // Inicialización de los listeners de Socket.io
  socket.on('connect', () => {
    set({ connected: true });
  });

  socket.on('disconnect', () => {
    set({ connected: false });
  });

  socket.on('agent_log', (log) => {
    set((state) => {
      const newLogs = [...state.logs, log];
      // Truncar a un máximo de 500 elementos
      if (newLogs.length > 500) {
        newLogs.shift();
      }
      return { logs: newLogs };
    });
  });

  socket.on('agent_status', (agents) => {
    set({ agents });
  });

  return {
    logs: [],
    agents: [],
    connected: false,
    
    // Acciones para uso manual si fuera necesario (aunque principalmente se alimentará por WebSockets)
    addLog: (log) => set((state) => {
      const newLogs = [...state.logs, log];
      if (newLogs.length > 500) {
        newLogs.shift();
      }
      return { logs: newLogs };
    }),
    
    setConnected: (status) => set({ connected: status }),
    
    setAgents: (agents) => set({ agents }),
    
    // Exponer el método para conectar manualmente desde la app
    connect: () => {
      if (!socket.connected) {
        socket.connect();
      }
    },
    
    disconnect: () => {
      if (socket.connected) {
        socket.disconnect();
      }
    }
  };
});
