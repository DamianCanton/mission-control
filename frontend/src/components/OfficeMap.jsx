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

function AgentMesh({ agent }) {
  const groupRef = useRef()
  const stationId = getStationIdForAction(agent.action)
  const targetCoords = STATION_COORDS[stationId] || STATION_COORDS.hq

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
    const target = new THREE.Vector3(targetCoords[0], 0, targetCoords[2])
    groupRef.current.position.lerp(target, delta * 2)
  })

  return (
    <group ref={groupRef} position={[targetCoords[0], 0, targetCoords[2]]}>
      {/* Cuerpo cilindro */}
      <mesh position={[0, 0.65, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.25, 0.7, 7]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.1} transparent={isGhost} opacity={opacity} />
      </mesh>
      {/* Cabeza esfera */}
      <mesh position={[0, 1.2, 0]} castShadow>
        <sphereGeometry args={[0.22, 8, 7]} />
        <meshStandardMaterial color="#e2d9ce" roughness={0.8} metalness={0} transparent={isGhost} opacity={opacity} />
      </mesh>
      {/* Ojos */}
      <mesh position={[-0.08, 1.23, 0.19]}>
        <sphereGeometry args={[0.04, 5, 4]} />
        <meshStandardMaterial color={color} roughness={0.3} transparent={isGhost} opacity={opacity} />
      </mesh>
      <mesh position={[0.08, 1.23, 0.19]}>
        <sphereGeometry args={[0.04, 5, 4]} />
        <meshStandardMaterial color={color} roughness={0.3} transparent={isGhost} opacity={opacity} />
      </mesh>
      {/* Halo si thinking */}
      {agent.status === 'thinking' && (
        <mesh position={[0, 1.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.28, 0.03, 8, 20]} />
          <meshStandardMaterial color="#fbbf24" roughness={0.4} transparent={isGhost} opacity={opacity} />
        </mesh>
      )}
      {/* Label */}
      {!isGhost && (
        <Html position={[0, 2.5, 0]} center style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(255, 252, 248, 0.8)',
            backdropFilter: 'blur(4px)',
            border: `1px solid ${color}55`,
            color: '#111',
            fontSize: '10px',
            padding: '2px 8px',
            borderRadius: '12px',
            whiteSpace: 'nowrap',
            boxShadow: '0 1px 6px rgba(0,0,0,0.2)',
            fontWeight: '600',
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
      <div style={{ width: '100%', height: '100%', background: '#f0ede8', borderRadius: '0.5rem', overflow: 'hidden' }}>
        <Canvas shadows gl={{ antialias: true }}>
          <color attach="background" args={['#f0ede8']} />
          <OrthographicCamera makeDefault position={[15, 18, 15]} zoom={55} />
        
        <ambientLight intensity={0.45} color="#fff8f0" />
        <directionalLight
          position={[10, 15, 10]}
          intensity={1.3}
          color="#fffaf0"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={60}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />
        <directionalLight position={[-8, 6, -8]} intensity={0.3} color="#ddeeff" />
        
        {/* Piso nuevo */}
        <mesh rotation={[-Math.PI/2, 0, 0]} receiveShadow position={[0, 0, 0]}>
          <planeGeometry args={[35, 35]} />
          <meshStandardMaterial color="#d9d0c0" roughness={0.9} metalness={0} />
        </mesh>

        {/* Pared trasera izq */}
        <mesh position={[-15, 1.5, 0]} receiveShadow castShadow>
          <boxGeometry args={[0.3, 3, 35]} />
          <meshStandardMaterial color="#e8e0d0" roughness={0.95} />
        </mesh>
        
        {/* Pared trasera */}
        <mesh position={[0, 1.5, -15]} receiveShadow castShadow>
          <boxGeometry args={[35, 3, 0.3]} />
          <meshStandardMaterial color="#e8e0d0" roughness={0.95} />
        </mesh>
        
        {/* Estaciones */}
        {Object.entries(STATION_COORDS).map(([id, pos]) => (
          <DeskStation key={id} id={id} position={pos} />
        ))}
        
        {/* Agentes */}
        {agents && agents
          .filter(agent => agent && (agent.agentName || agent.name))
          .map(agent => (
            <AgentMesh key={agent.agentName || agent.name} agent={{
              ...agent,
              agentName: agent.agentName || agent.name || 'Unknown',
              action: agent.action || 'idle',
              status: agent.status || 'running',
            }} />
          ))
        }
        
        <OrbitControls enableRotate={false} enableZoom={false} enablePan={false} />
        </Canvas>
      </div>
    </div>
  );
}