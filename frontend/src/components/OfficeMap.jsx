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
  const meshRef = useRef()
  const targetPos = STATION_COORDS[getStationIdForAction(agent.action)] || STATION_COORDS.hq

  const COLOR_MAP = {
    running:   '#3b82f6',
    thinking:  '#eab308',
    completed: '#22c55e',
    error:     '#ef4444',
  }
  const color = COLOR_MAP[agent.status] || '#8b5cf6'

  useFrame((_, delta) => {
    if (!meshRef.current) return
    const target = new THREE.Vector3(...targetPos).add(new THREE.Vector3(0, 0, 0))
    meshRef.current.position.lerp(target, delta * 2)
  })

  return (
    <group ref={meshRef} position={[...targetPos]}>
      {/* Cuerpo - cilindro */}
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.28, 0.7, 6]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Cabeza - esfera */}
      <mesh position={[0, 1.25, 0]} castShadow>
        <sphereGeometry args={[0.25, 8, 6]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Ojos */}
      <mesh position={[-0.09, 1.28, 0.22]}>
        <sphereGeometry args={[0.05, 5, 4]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1} />
      </mesh>
      <mesh position={[0.09, 1.28, 0.22]}>
        <sphereGeometry args={[0.05, 5, 4]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1} />
      </mesh>
      {/* Halo si está "thinking" */}
      {agent.status === 'thinking' && (
        <mesh position={[0, 1.65, 0]} rotation={[Math.PI/2, 0, 0]}>
          <torusGeometry args={[0.3, 0.04, 8, 20]} />
          <meshStandardMaterial color="#fde68a" emissive="#fde68a" emissiveIntensity={1} />
        </mesh>
      )}
      {/* Nombre flotante */}
      <Html position={[0, 1.9, 0]} center style={{ fontSize: '10px', color: '#1f2937', background: 'rgba(255,255,255,0.85)', padding: '1px 5px', borderRadius: '4px', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
        {agent.agentName}
      </Html>
    </group>
  )
}

export default function OfficeMap() {
  const { agents } = useMissionStore();

  return (
    <div style={{ width: '100%', height: '500px', background: '#111827', borderRadius: '0.5rem', overflow: 'hidden' }}>
      <Canvas shadows>
        <color attach="background" args={['#111827']} />
        <OrthographicCamera makeDefault position={[20, 20, 20]} zoom={40} />
        <ambientLight intensity={0.6} color="#fff8e7" />
        <directionalLight position={[10, 15, 10]} intensity={1.2} castShadow shadow-mapSize={[2048,2048]} color="#fffacd" />
        <directionalLight position={[-5, 8, -10]} intensity={0.4} color="#c8e6ff" />
        
        {/* Piso */}
        <gridHelper args={[30, 30, '#4b5563', '#374151']} position={[0, 0, 0]} />
        
        {/* Estaciones */}
        {Object.entries(STATION_COORDS).map(([id, pos]) => (
          <DeskStation key={id} id={id} position={pos} />
        ))}
        
        {/* Agentes */}
        {agents && agents.map(agent => (
          <AgentMesh key={agent.agentName} agent={agent} />
        ))}
        
        <OrbitControls enableRotate={false} enableZoom={false} enablePan={false} />
      </Canvas>
    </div>
  );
}