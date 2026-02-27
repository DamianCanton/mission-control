import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
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
  hq: '⭐ HQ',
  dev: '💻 Dev',
  search: '🔍 Search',
  files: '📁 Files',
  memory: '🧠 Memory',
  comms: '💬 Comms',
  browser: '🌐 Browser',
  subagents: '🤖 Agents',
  misc: '🔧 Misc'
};

function getStationIdForAction(action = '') {
  const a = action.toLowerCase()
  if (a.includes('search') || a.includes('fetch')) return 'search'
  if (a.includes('exec') || a.includes('code') || a.includes('bash')) return 'dev'
  if (a.includes('read') || a.includes('write') || a.includes('edit')) return 'files'
  if (a.includes('memory')) return 'memory'
  if (a.includes('message') || a.includes('send') || a.includes('telegram')) return 'comms'
  if (a.includes('browser')) return 'browser'
  if (a.includes('session') || a.includes('subagent') || a.includes('spawn')) return 'subagents'
  if (a.includes('star') || a.includes('hq') || a.includes('idle')) return 'hq'
  return 'misc'
}

// Posiciones de sillas alrededor de la mesa HQ (5 sillas)
// 8 sillas distribuidas en círculo radio 2.0 alrededor del centro del HQ
const HQ_SLOTS = Array.from({ length: 8 }, (_, i) => {
  const angle = (i / 8) * Math.PI * 2
  return [Math.sin(angle) * 2.0, 0, Math.cos(angle) * 2.0]
})


function AgentMesh({ agent, seatIndex }) {
  const groupRef = useRef()
  const stationId = getStationIdForAction(agent.action)
  const base = STATION_COORDS[stationId] || STATION_COORDS.hq

  // Si está en HQ y tiene índice de silla, usar offset de silla
  let targetCoords = [...base]
  if (stationId === 'hq' && seatIndex !== undefined) {
    const slot = HQ_SLOTS[seatIndex % 8]
    targetCoords = [base[0] + slot[0], base[1], base[2] + slot[2]]
  }

  const COLOR_MAP = {
    running:   '#3b82f6',
    thinking:  '#d97706',
    completed: '#16a34a',
    error:     '#dc2626',
  }
  const color = COLOR_MAP[agent.status] || '#7c3aed'

  const statusFilter = useMissionStore(state => state.statusFilter)
  const isGhost = statusFilter !== 'all' && agent.status !== statusFilter
  const opacity = isGhost ? 0.12 : 1

  useFrame((_, delta) => {
    if (!groupRef.current) return
    const targetY = stationId === 'hq' ? -0.25 : 0  // sentado vs parado
    const target = new THREE.Vector3(targetCoords[0], targetY, targetCoords[2])
    groupRef.current.position.lerp(target, delta * 2)
  })

  return (
    <group ref={groupRef} position={[targetCoords[0], 0, targetCoords[2]]}>
      {/* Cabeza - cubo */}
      <mesh position={[0, 1.4, 0]} castShadow>
        <boxGeometry args={[0.6, 0.6, 0.6]} />
        <meshStandardMaterial color="#e2d9ce" roughness={0.9} metalness={0} transparent={isGhost} opacity={opacity} />
      </mesh>
      {/* Ojos */}
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
      {/* Brazo izquierdo */}
      <mesh position={[-0.5, 0.75, 0]} castShadow>
        <boxGeometry args={[0.25, 0.7, 0.35]} />
        <meshStandardMaterial color={color} roughness={0.8} metalness={0.1} transparent={isGhost} opacity={opacity} />
      </mesh>
      {/* Brazo derecho */}
      <mesh position={[0.5, 0.75, 0]} castShadow>
        <boxGeometry args={[0.25, 0.7, 0.35]} />
        <meshStandardMaterial color={color} roughness={0.8} metalness={0.1} transparent={isGhost} opacity={opacity} />
      </mesh>
      {/* Pierna izquierda */}
      <mesh position={[-0.2, 0.18, 0]} castShadow>
        <boxGeometry args={[0.28, 0.4, 0.35]} />
        <meshStandardMaterial color="#334155" roughness={0.9} transparent={isGhost} opacity={opacity} />
      </mesh>
      {/* Pierna derecha */}
      <mesh position={[0.2, 0.18, 0]} castShadow>
        <boxGeometry args={[0.28, 0.4, 0.35]} />
        <meshStandardMaterial color="#334155" roughness={0.9} transparent={isGhost} opacity={opacity} />
      </mesh>
      {/* Halo thinking */}
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
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(4px)',
            border: `1px solid ${color}88`,
            color: color,
            fontSize: '10px',
            padding: '2px 8px',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
            boxShadow: `0 0 8px ${color}44`,
            fontWeight: '700',
            fontFamily: 'monospace',
            letterSpacing: '0.05em',
          }}>
            {agent.agentName}
          </div>
        </Html>
      )}
    </group>
  )
}

export default function OfficeMap() {
  const agents = useMissionStore(state => state.agents)
  const statusFilter = useMissionStore(state => state.statusFilter)
  const setStatusFilter = useMissionStore(state => state.setStatusFilter)

  const FILTERS = [
    { key: 'all',       label: '⬡ All',       color: 'bg-gray-600' },
    { key: 'running',   label: '▶ Running',   color: 'bg-blue-600' },
    { key: 'thinking',  label: '◌ Thinking',  color: 'bg-yellow-500' },
    { key: 'completed', label: '✓ Completed', color: 'bg-green-600' },
    { key: 'error',     label: '✕ Error',     color: 'bg-red-600' },
    { key: 'idle',      label: '— Idle',      color: 'bg-gray-500' },
  ]

  return (
    <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 120px)' }}>
      <div style={{
        position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
        zIndex: 10, display: 'flex', gap: 8,
      }}>
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            style={{
              padding: '4px 14px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'monospace',
              border: statusFilter === f.key ? '2px solid white' : '2px solid transparent',
              cursor: 'pointer',
              opacity: statusFilter === f.key ? 1 : 0.6,
              background: statusFilter === f.key
                ? { all:'#4b5563',running:'#2563eb',thinking:'#d97706',completed:'#16a34a',error:'#dc2626',idle:'#6b7280' }[f.key]
                : 'rgba(30,30,40,0.7)',
              color: 'white',
              backdropFilter: 'blur(4px)',
              transition: 'all 0.15s',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div style={{ width: '100%', height: '100%', background: '#020617', borderRadius: '0.5rem', overflow: 'hidden' }}>
        <Canvas shadows gl={{ antialias: true }}>
          <color attach="background" args={['#020617']} />
          <OrthographicCamera makeDefault position={[15, 18, 15]} zoom={55} />
        
        <ambientLight intensity={0.5} color="#ffffff" />
        <directionalLight
          position={[10, 15, 10]}
          intensity={1.3}
          color="#ffffff"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={60}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />
        <directionalLight position={[-8, 6, -8]} intensity={0.3} color="#ffffff" />
        
        {/* Piso negro */}
        <mesh rotation={[-Math.PI/2, 0, 0]} receiveShadow position={[0, 0, 0]}>
          <planeGeometry args={[35, 35]} />
          <meshStandardMaterial color="#0f172a" roughness={0.9} metalness={0} />
        </mesh>

        {/* Pared izquierda */}
        <mesh position={[-15, 1.5, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.3, 3, 35]} />
          <meshStandardMaterial color="#1e293b" roughness={0.95} />
        </mesh>
        
        {/* Pared trasera */}
        <mesh position={[0, 1.5, -15]} receiveShadow castShadow>
          <boxGeometry args={[35, 3, 0.3]} />
          <meshStandardMaterial color="#1e293b" roughness={0.95} />
        </mesh>
        
        {/* Estaciones */}
        {Object.entries(STATION_COORDS).map(([id, pos]) => (
          <DeskStation key={id} id={id} position={pos} />
        ))}
        
        {/* Agentes */}
        {(() => {
          const safeAgents = (agents || [])
            .filter(agent => agent && (agent.agentName || agent.name))
            .map(agent => ({
              ...agent,
              agentName: agent.agentName || agent.name || 'Unknown',
              action: agent.action || 'idle',
              status: agent.status || 'running',
            }))

          // Asignar índice de silla a los agentes en HQ
          let hqSeatCounter = 0
          return safeAgents.map(agent => {
            const stationId = getStationIdForAction(agent.action)
            const seatIndex = stationId === 'hq' ? hqSeatCounter++ : undefined
            return (
              <AgentMesh
                key={agent.agentName}
                agent={agent}
                seatIndex={seatIndex}
              />
            )
          })
        })()}
        
        <OrbitControls enableRotate={false} enableZoom={false} enablePan={false} />
        </Canvas>
      </div>
    </div>
  );
}