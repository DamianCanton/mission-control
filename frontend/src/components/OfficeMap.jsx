import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrthographicCamera, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useMissionStore } from '../store/useMissionStore';
import { DeskStation } from './DeskStation';

const STATION_COORDS = {
  hq:        [0,   0,  0],
  dev:       [-6,  0, -5],
  search:    [6,   0, -5],
  files:     [-6,  0,  5],
  memory:    [6,   0,  5],
  comms:     [0,   0, -7],
  browser:   [-6,  0,  0],
  subagents: [6,   0,  0],
  misc:      [0,   0,  7],
};

const STATION_LABELS = {
  hq: '⭐ HQ', dev: '💻 Dev', search: '🔍 Search', files: '📁 Files',
  memory: '🧠 Memory', comms: '📨 Messages', browser: '🌐 Browser',
  subagents: '🤖 Agents', misc: '🔮 Wildcard',
};

function getStationIdForAction(action = '') {
  const a = action.toLowerCase();
  if (a.includes('search') || a.includes('fetch'))                     return 'search';
  if (a.includes('exec')   || a.includes('code') || a.includes('bash')) return 'dev';
  if (a.includes('read')   || a.includes('write') || a.includes('edit')) return 'files';
  if (a.includes('memory'))                                              return 'memory';
  if (a.includes('message') || a.includes('send') || a.includes('telegram')) return 'comms';
  if (a.includes('browser'))                                             return 'browser';
  if (a.includes('session') || a.includes('subagent') || a.includes('spawn')) return 'subagents';
  return 'misc';
}

const HQ_SLOTS = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * Math.PI * 2;
  return [Math.sin(angle) * 2.0, 0, Math.cos(angle) * 2.0];
});

// Ajusta el zoom de la cámara ortográfica según el tamaño del canvas
function ResponsiveCamera({ isMobile }) {
  const { camera, size } = useThree();
  useEffect(() => {
    // Mobile: zoom pequeño para que entren las 9 estaciones
    // La escena tiene coordenadas ±7 en X/Z, la cámara isométrica desde [15,18,15]
    // necesita zoom ≈ 18 para verlas todas en 360px de ancho
    const zoom = isMobile ? 18 : 55;
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
  }, [camera, isMobile, size.width]);
  return null;
}

function AgentMesh({ agent, seatIndex }) {
  const groupRef = useRef();
  const stationId = getStationIdForAction(agent.action);
  const base = STATION_COORDS[stationId] || STATION_COORDS.hq;

  let targetCoords = [...base];
  if (stationId === 'hq' && seatIndex !== undefined) {
    const slot = HQ_SLOTS[seatIndex % 8];
    targetCoords = [base[0] + slot[0], base[1], base[2] + slot[2]];
  }

  const COLOR_MAP = { running: '#3b82f6', thinking: '#d97706', completed: '#16a34a', error: '#dc2626' };
  const color     = COLOR_MAP[agent.status] || '#7c3aed';

  const statusFilter = useMissionStore(state => state.statusFilter);
  const isGhost      = statusFilter !== 'all' && agent.status !== statusFilter;
  const opacity      = isGhost ? 0.12 : 1;

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const targetY = stationId === 'hq' ? -0.25 : 0;
    const target  = new THREE.Vector3(targetCoords[0], targetY, targetCoords[2]);
    groupRef.current.position.lerp(target, delta * 2);
  });

  return (
    <group ref={groupRef} position={[targetCoords[0], 0, targetCoords[2]]}>
      <mesh position={[0, 1.4, 0]} castShadow>
        <boxGeometry args={[0.6, 0.6, 0.6]} />
        <meshStandardMaterial color="#e2d9ce" roughness={0.9} transparent={isGhost} opacity={opacity} />
      </mesh>
      <mesh position={[-0.13, 1.45, 0.31]}>
        <boxGeometry args={[0.12, 0.1, 0.02]} />
        <meshStandardMaterial color="#1e293b" transparent={isGhost} opacity={opacity} />
      </mesh>
      <mesh position={[0.13, 1.45, 0.31]}>
        <boxGeometry args={[0.12, 0.1, 0.02]} />
        <meshStandardMaterial color="#1e293b" transparent={isGhost} opacity={opacity} />
      </mesh>
      <mesh position={[0, 0.7, 0]} castShadow>
        <boxGeometry args={[0.7, 0.8, 0.4]} />
        <meshStandardMaterial color={color} roughness={0.8} metalness={0.1} transparent={isGhost} opacity={opacity} />
      </mesh>
      <mesh position={[-0.5, 0.75, 0]} castShadow>
        <boxGeometry args={[0.25, 0.7, 0.35]} />
        <meshStandardMaterial color={color} roughness={0.8} transparent={isGhost} opacity={opacity} />
      </mesh>
      <mesh position={[0.5, 0.75, 0]} castShadow>
        <boxGeometry args={[0.25, 0.7, 0.35]} />
        <meshStandardMaterial color={color} roughness={0.8} transparent={isGhost} opacity={opacity} />
      </mesh>
      <mesh position={[-0.2, 0.18, 0]} castShadow>
        <boxGeometry args={[0.28, 0.4, 0.35]} />
        <meshStandardMaterial color="#334155" roughness={0.9} transparent={isGhost} opacity={opacity} />
      </mesh>
      <mesh position={[0.2, 0.18, 0]} castShadow>
        <boxGeometry args={[0.28, 0.4, 0.35]} />
        <meshStandardMaterial color="#334155" roughness={0.9} transparent={isGhost} opacity={opacity} />
      </mesh>
      {agent.status === 'thinking' && !isGhost && (
        <mesh position={[0, 1.9, 0]}>
          <boxGeometry args={[0.8, 0.08, 0.8]} />
          <meshStandardMaterial color="#fbbf24" roughness={0.4} />
        </mesh>
      )}
      {!isGhost && (
        <Html position={[0, 2.5, 0]} center style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(4px)',
            border: `1px solid ${color}88`, color,
            fontSize: '9px', padding: '2px 6px', borderRadius: '4px',
            whiteSpace: 'nowrap', fontWeight: '700', fontFamily: 'monospace',
          }}>
            {agent.agentName}
          </div>
        </Html>
      )}
    </group>
  );
}

// ─── OfficeMap ────────────────────────────────────────────────────────────────

export default function OfficeMap() {
  const agents        = useMissionStore(state => state.agents);
  const statusFilter  = useMissionStore(state => state.statusFilter);
  const setStatusFilter = useMissionStore(state => state.setStatusFilter);

  // Inicializar isMobile INMEDIATAMENTE con window.innerWidth
  // para evitar el flash de zoom=55 en el primer render
  const containerRef = useRef(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setIsMobile(entry.contentRect.width < 768);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const FILTERS = [
    { key: 'all',       label: '⬡ All'       },
    { key: 'running',   label: '▶ Running'   },
    { key: 'thinking',  label: '◌ Thinking'  },
    { key: 'completed', label: '✓ Done'      },
    { key: 'error',     label: '✕ Error'     },
  ];

  const FILTER_COLORS = {
    all: '#4b5563', running: '#2563eb', thinking: '#d97706',
    completed: '#16a34a', error: '#dc2626',
  };

  return (
    // No height aquí — hereda 100% del contenedor padre (Dashboard)
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>

      {/* Filtros — scrollable en mobile */}
      <div style={{
        position: 'absolute', top: 8, left: 0, right: 0,
        zIndex: 10, display: 'flex', gap: 6, padding: '0 10px',
        overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
      }}>
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            style={{
              padding: isMobile ? '3px 10px' : '4px 14px',
              borderRadius: 20,
              fontSize: isMobile ? 11 : 12,
              fontWeight: 600,
              fontFamily: 'monospace',
              border: statusFilter === f.key ? '2px solid white' : '2px solid transparent',
              cursor: 'pointer',
              opacity: statusFilter === f.key ? 1 : 0.55,
              background: statusFilter === f.key
                ? FILTER_COLORS[f.key]
                : 'rgba(30,30,40,0.75)',
              color: 'white',
              backdropFilter: 'blur(4px)',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Canvas — fill container */}
      <div style={{ width: '100%', height: '100%', background: '#020617', borderRadius: '0.5rem', overflow: 'hidden' }}>
        <Canvas shadows gl={{ antialias: true }}>
          <color attach="background" args={['#020617']} />
          <OrthographicCamera makeDefault position={[15, 18, 15]} zoom={isMobile ? 18 : 55} />
          <ResponsiveCamera isMobile={isMobile} />

          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 15, 10]} intensity={1.3} castShadow
            shadow-mapSize-width={1024} shadow-mapSize-height={1024}
            shadow-camera-far={60} shadow-camera-left={-20}
            shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} />
          <directionalLight position={[-8, 6, -8]} intensity={0.3} />

          {/* Piso */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[35, 35]} />
            <meshStandardMaterial color="#0f172a" roughness={0.9} />
          </mesh>
          {/* Paredes */}
          <mesh position={[-15, 1.5, 0]} castShadow>
            <boxGeometry args={[0.3, 3, 35]} />
            <meshStandardMaterial color="#1e293b" roughness={0.95} />
          </mesh>
          <mesh position={[0, 1.5, -15]} castShadow>
            <boxGeometry args={[35, 3, 0.3]} />
            <meshStandardMaterial color="#1e293b" roughness={0.95} />
          </mesh>

          {Object.entries(STATION_COORDS).map(([id, pos]) => (
            <DeskStation key={id} id={id} position={pos} />
          ))}

          {(() => {
            const safeAgents = (agents || [])
              .filter(a => a && (a.agentName || a.name))
              .map(a => ({
                ...a,
                agentName: a.agentName || a.name || 'Unknown',
                action:    a.action    || 'idle',
                status:    a.status    || 'running',
              }));
            let hqSeat = 0;
            return safeAgents.map(agent => {
              const sid = getStationIdForAction(agent.action);
              const seatIndex = sid === 'hq' ? hqSeat++ : undefined;
              return <AgentMesh key={agent.agentName} agent={agent} seatIndex={seatIndex} />;
            });
          })()}

          <OrbitControls enableRotate={false} enableZoom={false} enablePan={false} />
        </Canvas>
      </div>
    </div>
  );
}
