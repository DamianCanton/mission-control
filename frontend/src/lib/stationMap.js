// ─── Coordenadas de estaciones (fuente de verdad compartida) ─────────────────

export const STATION_COORDS = {
  hq:      [ 0,  0,  0],
  dev:     [-6,  0, -4],
  files:   [ 6,  0, -4],
  search:  [-6,  0,  4],
  memory:  [ 6,  0,  4],
  comms:   [ 0,  0, -7],
  agents:  [ 0,  0,  7],
};

// ─── Mapeo acción → estación (sincronizado con server.js) ────────────────────

export function getStationForAction(action = '') {
  const a = action.toLowerCase().trim();
  if (['idle','thinking','initializing','completed','error',
       'heartbeat','new','agent_start'].includes(a)) return 'hq';
  if (a.endsWith('_done'))                           return 'hq';
  if (a.includes('memory'))                          return 'memory';
  if (a.includes('web_search') || a.includes('web_fetch') ||
      a.includes('search')     || a.includes('fetch'))     return 'search';
  if (a.includes('message') || a.includes('telegram') ||
      a.includes('discord')  || a.includes('tts') ||
      a.includes('send')     || a.includes('notify'))      return 'comms';
  if (a === 'read' || a === 'write' || a === 'edit' ||
      a.includes('file')  || a.includes('read') ||
      a.includes('write') || a.includes('edit'))           return 'files';
  if (a === 'exec' || a.includes('exec') || a.includes('bash') ||
      a.includes('run')     || a.includes('process') ||
      a.includes('canvas')  || a.includes('browser'))      return 'dev';
  if (a.includes('agent')   || a.includes('session') ||
      a.includes('spawn')   || a.includes('subagent') ||
      a.includes('nodes'))                                  return 'agents';
  return 'hq';
}

// Estación "home" según tipo de agente
// Star Platinum vive en HQ; sub-agentes salen de Agents
export function getHomeStation(agentName = '') {
  return agentName.startsWith('Sub-Agent') ? 'agents' : 'hq';
}

// Color de partículas según agente (estrella dorada, sub-agentes variados)
const SUB_COLORS = ['#60a5fa', '#34d399', '#a78bfa', '#f472b6', '#fb923c'];

export function getAgentColor(agentName = '') {
  if (agentName === 'Star Platinum') return '#fbbf24';
  let hash = 0;
  for (let i = 0; i < agentName.length; i++)
    hash = agentName.charCodeAt(i) + ((hash << 5) - hash);
  return SUB_COLORS[Math.abs(hash) % SUB_COLORS.length];
}
