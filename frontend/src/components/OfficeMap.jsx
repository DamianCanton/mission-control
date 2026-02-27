import React from 'react';
import { useMissionStore } from '../store/useMissionStore';

// Mapeo de personajes a emojis y colores
const getCharacterTheme = (agentName) => {
  if (!agentName) return { emoji: '👾', color: 'bg-gray-600', borderColor: 'border-gray-500' };
  
  const name = agentName.toLowerCase();
  
  if (name.includes('star platinum')) {
    return { emoji: '⭐', color: 'bg-yellow-500', borderColor: 'border-yellow-400' };
  }
  if (name.includes('alpha')) {
    return { emoji: '🤖', color: 'bg-blue-500', borderColor: 'border-blue-400' };
  }
  if (name.includes('beta')) {
    return { emoji: '🦾', color: 'bg-green-500', borderColor: 'border-green-400' };
  }
  if (name.includes('mission control')) {
    return { emoji: '🎮', color: 'bg-purple-500', borderColor: 'border-purple-400' };
  }
  
  return { emoji: '👾', color: 'bg-gray-500', borderColor: 'border-gray-400' };
};

// Mapeo de estado a animación
const getStatusAnimation = (status) => {
  switch (status) {
    case 'thinking': return 'animate-shake';
    case 'running': return 'animate-bounce';
    case 'completed': return 'animate-pulse-green';
    case 'error': return 'animate-wiggle bg-red-500 border-red-400 text-white';
    default: return '';
  }
};

// Determina en qué estación debe estar un agente según su acción
const getStationIdForAction = (action) => {
  if (!action) return 'misc';
  
  const a = action.toLowerCase();
  
  if (a.includes('web_search') || a.includes('web_fetch') || a.includes('search')) return 'search';
  if (a.includes('exec') || a.includes('bash') || a.includes('code') || a.includes('dev')) return 'dev';
  if (a.includes('read') || a.includes('write') || a.includes('edit') || a.includes('file')) return 'files';
  if (a.includes('memory')) return 'memory';
  if (a.includes('message') || a.includes('send') || a.includes('telegram') || a.includes('comms')) return 'comms';
  if (a.includes('browser')) return 'browser';
  if (a.includes('sessions_spawn') || a.includes('subagent')) return 'subagents';
  if (a.includes('idle') || a.includes('thinking') || a.includes('default') || a === 'hq') return 'hq';
  
  return 'misc';
};

const STATIONS = [
  { id: 'search', icon: '🔍', name: 'Search', desc: 'Monitores' },
  { id: 'dev', icon: '💻', name: 'Dev', desc: 'Coding Station' },
  { id: 'files', icon: '📁', name: 'Files', desc: 'Archivero' },
  { id: 'memory', icon: '🧠', name: 'Memory', desc: 'Biblioteca' },
  { id: 'comms', icon: '💬', name: 'Comms', desc: 'Centralita' },
  { id: 'browser', icon: '🌐', name: 'Browser', desc: 'Navegador' },
  { id: 'subagents', icon: '🤖', name: 'Sub-Agents', desc: 'Mesa Redonda' },
  { id: 'hq', icon: '⭐', name: 'HQ', desc: 'Escritorio Principal' },
  { id: 'misc', icon: '🔧', name: 'Misc', desc: 'Taller' }
];

const Character = ({ agent }) => {
  const theme = getCharacterTheme(agent.agentName);
  const animClass = getStatusAnimation(agent.status);
  
  // Si está en error, sobreescribimos los colores del theme
  const bgColor = agent.status === 'error' ? 'bg-red-500' : theme.color;
  const borderColor = agent.status === 'error' ? 'border-red-400' : theme.borderColor;
  
  return (
    <div 
      className={`relative z-10 flex flex-col items-center justify-center p-2 rounded-full border-2 ${bgColor} ${borderColor} ${animClass} shadow-lg transition-all duration-300`}
      title={`${agent.agentName} - ${agent.status} - ${agent.action || 'Idle'}`}
    >
      <span className="text-2xl drop-shadow-md">{theme.emoji}</span>
      {/* Pequeño tooltip flotante con el nombre del agente */}
      <div className="absolute -bottom-6 bg-black/80 text-white text-[10px] px-2 py-1 rounded opacity-0 hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-20">
        {agent.agentName}
      </div>
    </div>
  );
};

const Station = ({ station, agentsInStation }) => {
  const isActive = agentsInStation.length > 0;
  
  return (
    <div className={`relative flex flex-col items-center justify-center p-6 bg-gray-800 rounded-xl border border-gray-700 shadow-inner transition-all duration-500 h-40 ${isActive ? 'ring-2 ring-blue-500/30 bg-gray-750' : 'opacity-60 grayscale-[30%]'}`}>
      
      {/* Fondo de la estación */}
      <div className={`text-5xl mb-3 transition-transform duration-500 ${isActive ? 'scale-110 drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'scale-100'}`}>
        {station.icon}
      </div>
      
      {/* Información de la estación */}
      <div className="text-center z-0">
        <h3 className="font-bold text-gray-200">{station.name}</h3>
        <p className="text-xs text-gray-500">{station.desc}</p>
      </div>
      
      {/* Contenedor de agentes (absoluto sobre la estación) */}
      {isActive && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 flex-wrap p-2 bg-black/20 rounded-xl backdrop-blur-[1px]">
          {agentsInStation.map((agent, idx) => (
            <Character key={`${agent.agentName}-${idx}`} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
};

const OfficeMap = () => {
  const agents = useMissionStore(state => state.agents) || [];
  
  return (
    <div className="mb-10 w-full">
      <div className="flex flex-col mb-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          🏢 Office Live View
        </h2>
        <p className="text-gray-400 text-sm">Real-time agent activity</p>
      </div>
      
      {/* Estilos inyectados para las animaciones custom si no están en tailwind config */}
      <style>{`
        @keyframes bounce { 
          0%, 100% { transform: translateY(0); } 
          50% { transform: translateY(-8px); } 
        }
        @keyframes shake { 
          0%, 100% { transform: rotate(0deg); } 
          25% { transform: rotate(-5deg); } 
          75% { transform: rotate(5deg); } 
        }
        @keyframes pulse-green { 
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); } 
          50% { opacity: 0.8; box-shadow: 0 0 15px 5px rgba(74, 222, 128, 0.4); } 
        }
        @keyframes wiggle { 
          0%, 100% { transform: translateX(0); } 
          25% { transform: translateX(-3px); } 
          75% { transform: translateX(3px); } 
        }
        
        .animate-bounce { animation: bounce 1s infinite; }
        .animate-shake { animation: shake 0.5s infinite; }
        .animate-pulse-green { animation: pulse-green 1.5s infinite; }
        .animate-wiggle { animation: wiggle 0.3s infinite; }
      `}</style>
      
      <div className="bg-gray-900 p-6 rounded-2xl border border-gray-700 shadow-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {STATIONS.map(station => {
            // Filtrar los agentes que pertenecen a esta estación
            const agentsInStation = agents.filter(agent => {
              // Si el agente está activo y tiene acción, vemos si mapea a esta estación
              if (agent.action) {
                return getStationIdForAction(agent.action) === station.id;
              }
              // Si no tiene acción pero está "idle", lo mandamos al HQ
              if ((!agent.action || agent.status === 'idle') && station.id === 'hq') {
                return true;
              }
              return false;
            });
            
            return (
              <Station 
                key={station.id} 
                station={station} 
                agentsInStation={agentsInStation} 
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default OfficeMap;