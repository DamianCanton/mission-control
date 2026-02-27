import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, OrthographicCamera, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useMissionStore } from '../store/useMissionStore';

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

function StationMesh({ id, position }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[3, 3]} />
        <meshStandardMaterial color="#374151" />
      </mesh>
      <Html position={[0, 0.1, 0]} center>
        <div style={{ color: '#d1d5db', fontSize: '14px', fontWeight: 'bold', pointerEvents: 'none', whiteSpace: 'nowrap', userSelect: 'none' }}>
          {STATION_LABELS[id]}
        </div>
      </Html>
    </group>
  );
}

function AgentMesh({ agent }) {
  const meshRef = useRef();
  
  const targetId = getStationIdForAction(agent.action);
  const targetPos = STATION_COORDS[targetId] || STATION_COORDS.misc;
  
  // Posición inicial (si es necesario) pero la interpolaremos
  const targetVector = new THREE.Vector3(targetPos[0], 0.6, targetPos[2]);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.position.lerp(targetVector, delta * 3);
    }
  });

  let color = '#8b5cf6'; // default
  if (agent.status === 'running') color = '#3b82f6';
  else if (agent.status === 'thinking') color = '#eab308';
  else if (agent.status === 'completed') color = '#22c55e';
  else if (agent.status === 'error') color = '#ef4444';

  return (
    <group ref={meshRef} position={[targetPos[0], 0.6, targetPos[2]]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.8, 1.2, 0.8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Html position={[0, 0.8, 0]} center>
        <div style={{ background: 'rgba(0,0,0,0.7)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', whiteSpace: 'nowrap', pointerEvents: 'none', userSelect: 'none' }}>
          {agent.agentName}
        </div>
      </Html>
    </group>
  );
}

export default function OfficeMap() {
  const { agents } = useMissionStore();

  return (
    <div style={{ width: '100%', height: '500px', background: '#111827', borderRadius: '0.5rem', overflow: 'hidden' }}>
      <Canvas shadows>
        <OrthographicCamera makeDefault position={[20, 20, 20]} zoom={40} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
        
        {/* Piso */}
        <mesh position={[0, 0, 0]} rotation={[-Math.PI/2, 0, 0]} receiveShadow>
          <planeGeometry args={[30, 30]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
        
        {/* Estaciones: un plano elevado + texto por cada una */}
        {Object.entries(STATION_COORDS).map(([id, pos]) => (
          <StationMesh key={id} id={id} position={pos} />
        ))}
        
        {/* Agentes */}
        {agents && agents.map(agent => (
          <AgentMesh key={agent.agentName} agent={agent} />
        ))}
        
        <OrbitControls enableRotate={false} enablePan={true} />
      </Canvas>
    </div>
  );
}