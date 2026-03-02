import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrthographicCamera, OrbitControls, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useMissionStore } from '../store/useMissionStore';
import { DeskStation } from './DeskStation';

const STATION_COORDS = {
  hq:      [ 0,  0,  0],
  dev:     [-6,  0, -4],
  files:   [ 6,  0, -4],
  search:  [-6,  0,  4],
  memory:  [ 6,  0,  4],
  comms:   [ 0,  0, -7],
  agents:  [ 0,  0,  7],
};

const STATION_LABELS = {
  hq: '⭐ HQ', dev: '💻 Dev', search: '🔍 Search', files: '📁 Files',
  memory: '🧠 Memory', comms: '📨 Messages', browser: '🌐 Browser',
  subagents: '🤖 Agents', misc: '🔮 Wildcard',
};

function getStationIdForAction(action = '') {
  const a = action.toLowerCase().trim();
  if (['idle','thinking','initializing','completed','error','heartbeat','new'].includes(a) || a.endsWith('_done')) return 'hq';
  if (a.includes('memory'))                                                  return 'memory';
  if (a.includes('web_search') || a.includes('web_fetch') || a.includes('search') || a.includes('fetch')) return 'search';
  if (a.includes('message') || a.includes('telegram') || a.includes('tts') || a.includes('send'))         return 'comms';
  if (a.includes('read') || a.includes('write') || a.includes('edit') || a.includes('file'))               return 'files';
  if (a.includes('exec') || a.includes('bash') || a.includes('run') || a.includes('canvas'))               return 'dev';
  if (a.includes('agent') || a.includes('spawn') || a.includes('session') || a.includes('nodes'))         return 'agents';
  return 'hq';
}

const HQ_SLOTS = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * Math.PI * 2;
  return [Math.sin(angle) * 2.0, 0, Math.cos(angle) * 2.0];
});

// ─── Colores por status ───────────────────────────────────────────────────────

const PARTICLE_COLOR = {
  running:   '#60a5fa',
  thinking:  '#fbbf24',
  completed: '#4ade80',
  error:     '#f87171',
};

// ─── Hook: transiciones entre estaciones ─────────────────────────────────────

function useStationConnections() {
  const agents  = useMissionStore(state => state.agents);
  const [connections, setConnections] = useState([]);
  const prevRef = useRef({});

  useEffect(() => {
    const safe = (agents || [])
      .filter(a => a && (a.agentName || a.name))
      .map(a => ({
        ...a,
        agentName: a.agentName || a.name || 'Unknown',
        action:    a.action    || 'idle',
        status:    a.status    || 'running',
      }));

    for (const agent of safe) {
      const station = getStationIdForAction(agent.action);
      const prev    = prevRef.current[agent.agentName];

      if (prev && prev !== station && STATION_COORDS[prev] && STATION_COORDS[station]) {
        const conn = {
          id:     `${agent.agentName}-${Date.now()}`,
          from:   STATION_COORDS[prev],
          to:     STATION_COORDS[station],
          status: agent.status,
          born:   Date.now(),
        };
        setConnections(cs =>
          [...cs.filter(c => Date.now() - c.born < 8000), conn].slice(-15)
        );
      }
      prevRef.current[agent.agentName] = station;
    }
  }, [agents]);

  // GC periódico
  useEffect(() => {
    const id = setInterval(() => {
      setConnections(cs => cs.filter(c => Date.now() - c.born < 8000));
    }, 2000);
    return () => clearInterval(id);
  }, []);

  return connections;
}

// ─── Partículas animadas entre dos estaciones ─────────────────────────────────

function ParticleConnection({ from, to, status }) {
  const NUM   = 4;
  const LIFE  = 7000;   // ms que dura la conexión
  const SPEED = 1600;   // ms por recorrido completo

  const particleRefs = useRef([]);
  const ageRef       = useRef(0);

  const fromVec = useMemo(() => new THREE.Vector3(from[0], 0.85, from[2]), [from]);
  const toVec   = useMemo(() => new THREE.Vector3(to[0],   0.85, to[2]),   [to]);
  const color   = PARTICLE_COLOR[status] || '#60a5fa';
  const phases  = useMemo(() => Array.from({ length: NUM }, (_, i) => i / NUM), []);
  const linePoints = useMemo(() => [fromVec, toVec], [fromVec, toVec]);

  useFrame((_, delta) => {
    ageRef.current += delta * 1000;
    const age   = ageRef.current;
    const ratio = age / LIFE;

    // Fade in (0–10 %) · plateau · fade out (80–100 %)
    const opacity =
      ratio < 0.1  ? ratio / 0.1 :
      ratio > 0.8  ? (1 - ratio) / 0.2 :
      1;
    const safeOpacity = Math.max(0, Math.min(1, opacity));

    particleRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const phase = ((age / SPEED) + phases[i]) % 1;
      mesh.position.lerpVectors(fromVec, toVec, phase);
      if (mesh.material) {
        mesh.material.opacity          = safeOpacity;
        mesh.material.emissiveIntensity = safeOpacity * 1.4;
      }
    });
  });

  return (
    <group>
      {/* Línea tenue de referencia */}
      <Line
        points={linePoints}
        color={color}
        lineWidth={0.6}
        transparent
        opacity={0.18}
      />
      {/* Partículas viajeras */}
      {phases.map((_, i) => (
        <mesh
          key={i}
          ref={el => { particleRefs.current[i] = el; }}
          position={fromVec.toArray()}
        >
          <sphereGeometry args={[0.1, 7, 7]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={1.4}
            transparent
            opacity={1}
          />
        </mesh>
      ))}
    </group>
  );
}

// Wrapper dentro del Canvas (recibe conexiones como prop para evitar
// llamar al hook desde adentro del Canvas boundary)
function ConnectionsLayer({ connections }) {
  return (
    <>
      {connections.map(c => (
        <ParticleConnection
          key={c.id}
          from={c.from}
          to={c.to}
          status={c.status}
        />
      ))}
    </>
  );
}

// ─── Cámara responsiva ────────────────────────────────────────────────────────

// La escena ocupa ~±8 unidades en X y ~±9 en Z (estaciones más alejadas: comms/agents en z=±7).
// La cámara isométrica proyecta desde [15,18,15]: el eje diagonal comprime ~√2 en cada dimensión.
// Queremos que las 7 estaciones entren con margen → calculamos el zoom a partir del tamaño real del canvas.
// factor = min(width, height * 0.85) / 22  (22 ≈ diámetro aparente de la escena en unidades de pantalla)
function ResponsiveCamera({ isMobile }) {
  const { camera, size } = useThree();
  useEffect(() => {
    let zoom;
    if (isMobile) {
      zoom = 18;
    } else {
      // Ajustar por el tamaño real del canvas — escena ≈ 22 unidades de diámetro aparente
      const effective = Math.min(size.width, size.height * 0.85);
      zoom = Math.max(30, Math.min(70, effective / 22));
    }
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
  }, [camera, isMobile, size.width, size.height]);
  return null;
}

// ─── AgentMesh ────────────────────────────────────────────────────────────────

function AgentMesh({ agent, seatIndex }) {
  const groupRef  = useRef();
  const stationId = getStationIdForAction(agent.action);
  const base      = STATION_COORDS[stationId] || STATION_COORDS.hq;

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
      {/* Cabeza */}
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
      {/* Cuerpo */}
      <mesh position={[0, 0.7, 0]} castShadow>
        <boxGeometry args={[0.7, 0.8, 0.4]} />
        <meshStandardMaterial color={color} roughness={0.8} metalness={0.1} transparent={isGhost} opacity={opacity} />
      </mesh>
      {/* Brazos */}
      <mesh position={[-0.5, 0.75, 0]} castShadow>
        <boxGeometry args={[0.25, 0.7, 0.35]} />
        <meshStandardMaterial color={color} roughness={0.8} transparent={isGhost} opacity={opacity} />
      </mesh>
      <mesh position={[0.5, 0.75, 0]} castShadow>
        <boxGeometry args={[0.25, 0.7, 0.35]} />
        <meshStandardMaterial color={color} roughness={0.8} transparent={isGhost} opacity={opacity} />
      </mesh>
      {/* Piernas */}
      <mesh position={[-0.2, 0.18, 0]} castShadow>
        <boxGeometry args={[0.28, 0.4, 0.35]} />
        <meshStandardMaterial color="#334155" roughness={0.9} transparent={isGhost} opacity={opacity} />
      </mesh>
      <mesh position={[0.2, 0.18, 0]} castShadow>
        <boxGeometry args={[0.28, 0.4, 0.35]} />
        <meshStandardMaterial color="#334155" roughness={0.9} transparent={isGhost} opacity={opacity} />
      </mesh>
      {/* Halo de pensamiento */}
      {agent.status === 'thinking' && !isGhost && (
        <mesh position={[0, 1.9, 0]}>
          <boxGeometry args={[0.8, 0.08, 0.8]} />
          <meshStandardMaterial color="#fbbf24" roughness={0.4} />
        </mesh>
      )}
      {/* Label */}
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
  const agents          = useMissionStore(state => state.agents);
  const statusFilter    = useMissionStore(state => state.statusFilter);
  const setStatusFilter = useMissionStore(state => state.setStatusFilter);
  const connections     = useStationConnections();

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
    { key: 'all',       label: '⬡ All'      },
    { key: 'running',   label: '▶ Running'  },
    { key: 'thinking',  label: '◌ Thinking' },
    { key: 'completed', label: '✓ Done'     },
    { key: 'error',     label: '✕ Error'    },
  ];

  const FILTER_COLORS = {
    all: '#4b5563', running: '#2563eb', thinking: '#d97706',
    completed: '#16a34a', error: '#dc2626',
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>

      {/* Filtros */}
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

      {/* Canvas */}
      <div style={{ width: '100%', height: '100%', background: '#020617', borderRadius: '0.5rem', overflow: 'hidden' }}>
        <Canvas shadows gl={{ antialias: true }}>
          <color attach="background" args={['#020617']} />
          <OrthographicCamera makeDefault position={[15, 18, 15]} zoom={isMobile ? 18 : 55} />          <ResponsiveCamera isMobile={isMobile} />

          <ambientLight intensity={0.5} />
          <directionalLight
            position={[10, 15, 10]} intensity={1.3} castShadow
            shadow-mapSize-width={1024} shadow-mapSize-height={1024}
            shadow-camera-far={60} shadow-camera-left={-20}
            shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20}
          />
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

          {/* Estaciones */}
          {Object.entries(STATION_COORDS).map(([id, pos]) => (
            <DeskStation key={id} id={id} position={pos} />
          ))}

          {/* Partículas entre estaciones */}
          <ConnectionsLayer connections={connections} />

          {/* Agentes */}
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
              const sid       = getStationIdForAction(agent.action);
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
