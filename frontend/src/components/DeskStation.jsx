import { Html } from '@react-three/drei'

const STATION_META = {
  hq:        { label: '⭐ HQ',      color: '#92400e', accent: '#fbbf24' },
  dev:       { label: '💻 Dev',     color: '#1e3a5f', accent: '#3b82f6' },
  search:    { label: '🔍 Search',  color: '#1a3a2a', accent: '#10b981' },
  files:     { label: '📁 Files',   color: '#3a2a1a', accent: '#f59e0b' },
  memory:    { label: '🧠 Memory',  color: '#2a1a3a', accent: '#8b5cf6' },
  comms:     { label: '💬 Comms',   color: '#1a3a3a', accent: '#06b6d4' },
  browser:   { label: '🌐 Browser', color: '#1a2a3a', accent: '#3b82f6' },
  subagents: { label: '🤖 Agents',  color: '#3a1a2a', accent: '#ec4899' },
  misc:      { label: '🔧 Misc',    color: '#2a2a2a', accent: '#6b7280' },
}

// Mesa genérica con patas y archivador lateral
function GenericDesk({ accentColor }) {
  return (
    <group>
      {/* Alfombra */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI/2, 0, 0]} receiveShadow>
        <planeGeometry args={[3.5, 2.8]} />
        <meshStandardMaterial color="#d1d5db" roughness={1} />
      </mesh>
      {/* Superficie de mesa */}
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.08, 1.5]} />
        <meshStandardMaterial color="#e8dcc8" roughness={0.8} metalness={0.05} />
      </mesh>
      {/* Patas x4 */}
      {[[-1.0, -0.6], [1.0, -0.6], [-1.0, 0.6], [1.0, 0.6]].map(([px, pz], i) => (
        <mesh key={i} position={[px, 0.2, pz]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 0.45, 6]} />
          <meshStandardMaterial color="#b0a090" roughness={0.7} />
        </mesh>
      ))}
      {/* Monitor */}
      <mesh position={[0, 0.85, -0.45]} castShadow>
        <boxGeometry args={[1.0, 0.65, 0.05]} />
        <meshStandardMaterial color="#2d3748" roughness={0.3} metalness={0.6} />
      </mesh>
      {/* Pantalla (color acento de la estación) */}
      <mesh position={[0, 0.85, -0.42]}>
        <boxGeometry args={[0.88, 0.53, 0.01]} />
        <meshStandardMaterial color={accentColor} roughness={0.9} metalness={0} />
      </mesh>
      {/* Pie monitor */}
      <mesh position={[0, 0.52, -0.45]} castShadow>
        <boxGeometry args={[0.18, 0.08, 0.18]} />
        <meshStandardMaterial color="#374151" roughness={0.4} metalness={0.5} />
      </mesh>
      {/* Teclado */}
      <mesh position={[0, 0.5, 0.2]} castShadow>
        <boxGeometry args={[0.9, 0.025, 0.35]} />
        <meshStandardMaterial color="#1f2937" roughness={0.6} metalness={0.2} />
      </mesh>
      {/* Maceta */}
      <mesh position={[-0.9, 0.55, 0.2]} castShadow>
        <cylinderGeometry args={[0.08, 0.06, 0.15, 6]} />
        <meshStandardMaterial color="#15803d" roughness={0.9} />
      </mesh>
      {/* Tallo */}
      <mesh position={[-0.9, 0.7, 0.2]}>
        <sphereGeometry args={[0.1, 5, 4]} />
        <meshStandardMaterial color="#16a34a" roughness={1} />
      </mesh>
      {/* Archivador lateral */}
      <mesh position={[1.4, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.4, 0.8, 0.6]} />
        <meshStandardMaterial color="#c8bfb0" roughness={0.9} />
      </mesh>
    </group>
  )
}

// Mesa HQ redonda con sillas
function HQDesk() {
  const chairAngles = [0, 72, 144, 216, 288].map(d => d * Math.PI / 180)
  return (
    <group>
      {/* Alfombra */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI/2, 0, 0]} receiveShadow>
        <planeGeometry args={[3.5, 2.8]} />
        <meshStandardMaterial color="#d1d5db" roughness={1} />
      </mesh>
      {/* Mesa redonda */}
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.4, 1.4, 0.08, 12]} />
        <meshStandardMaterial color="#c8a96e" roughness={0.7} metalness={0.1} />
      </mesh>
      {/* Pata central */}
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.18, 0.45, 8]} />
        <meshStandardMaterial color="#a08060" roughness={0.6} />
      </mesh>
      {/* Sillas alrededor */}
      {chairAngles.map((angle, i) => (
        <group key={i} position={[Math.sin(angle) * 2, 0, Math.cos(angle) * 2]} rotation={[0, -angle, 0]}>
          {/* Asiento */}
          <mesh position={[0, 0.42, 0]} castShadow>
            <boxGeometry args={[0.55, 0.07, 0.55]} />
            <meshStandardMaterial color="#4a5568" roughness={0.9} />
          </mesh>
          {/* Respaldo */}
          <mesh position={[0, 0.72, -0.24]} castShadow>
            <boxGeometry args={[0.5, 0.55, 0.06]} />
            <meshStandardMaterial color="#4a5568" roughness={0.9} />
          </mesh>
          {/* Patas */}
          {[[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]].map(([px, pz], j) => (
            <mesh key={j} position={[px, 0.2, pz]} castShadow>
              <cylinderGeometry args={[0.025, 0.025, 0.42, 5]} />
              <meshStandardMaterial color="#718096" roughness={0.5} metalness={0.3} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

// Estación DEV con server racks
function DevDesk({ accentColor }) {
  return (
    <group>
      <GenericDesk accentColor={accentColor} />
      {/* Server rack izquierdo */}
      <mesh position={[-1.8, 0.9, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 1.8, 0.8]} />
        <meshStandardMaterial color="#1a202c" roughness={0.2} metalness={0.8} />
      </mesh>
      {/* Luces del rack */}
      {[0.5, 0.2, -0.1, -0.4].map((y, i) => (
        <mesh key={i} position={[-1.55, 0.9 + y, 0.35]}>
          <boxGeometry args={[0.06, 0.04, 0.02]} />
          <meshStandardMaterial color={i % 2 === 0 ? '#22c55e' : '#3b82f6'} roughness={0.5} />
        </mesh>
      ))}
    </group>
  )
}

export function DeskStation({ id, position }) {
  const meta = STATION_META[id] || STATION_META.misc
  const [x, y, z] = position

  return (
    <group position={[x, y, z]}>
      {id === 'hq' ? <HQDesk /> : id === 'dev' ? <DevDesk accentColor={meta.accent} /> : <GenericDesk accentColor={meta.accent} />}
      <Html center position={[0, -0.3, 1.8]} style={{ pointerEvents: 'none' }}>
        <div style={{
          background: 'rgba(255, 252, 248, 0.75)',
          backdropFilter: 'blur(6px)',
          border: '1px solid rgba(255,255,255,0.5)',
          color: '#1a1a1a',
          fontSize: '11px',
          padding: '3px 10px',
          borderRadius: '20px',
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          fontWeight: '500',
        }}>
          {meta.label}
        </div>
      </Html>
    </group>
  )
}