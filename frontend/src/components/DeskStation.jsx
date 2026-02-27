import { Html } from '@react-three/drei'

const STATION_META = {
  hq:        { label: '⭐ HQ',      color: '#fbbf24' },
  dev:       { label: '💻 Dev',     color: '#6366f1' },
  search:    { label: '🔍 Search',  color: '#0ea5e9' },
  files:     { label: '📁 Files',   color: '#f59e0b' },
  memory:    { label: '🧠 Memory',  color: '#8b5cf6' },
  comms:     { label: '💬 Comms',   color: '#10b981' },
  browser:   { label: '🌐 Browser', color: '#3b82f6' },
  subagents: { label: '🤖 Agents',  color: '#ec4899' },
  misc:      { label: '🔧 Misc',    color: '#6b7280' },
}

export function DeskStation({ id, position }) {
  const meta = STATION_META[id] || STATION_META.misc
  const [x, y, z] = position

  return (
    <group position={[x, y, z]}>
      {/* Mesa - superficie */}
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.1, 1.4]} />
        <meshStandardMaterial roughness={0.3} metalness={0.7} color="#2d3748" />
      </mesh>
      {/* Patas x4 */}
      {[[-0.9,-0.5],[0.9,-0.5],[-0.9,0.5],[0.9,0.5]].map(([px,pz],i) => (
        <mesh key={i} position={[px, 0.15, pz]} castShadow>
          <boxGeometry args={[0.08, 0.5, 0.08]} />
          <meshStandardMaterial color="#1a202c" metalness={0.9} roughness={0.1} />
        </mesh>
      ))}
      {/* Monitor */}
      <mesh position={[0, 0.75, -0.3]} castShadow>
        <boxGeometry args={[0.9, 0.6, 0.05]} />
        <meshStandardMaterial color="#0d1117" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Pantalla del monitor (emisiva con color de la estación) */}
      <mesh position={[0, 0.75, -0.27]}>
        <boxGeometry args={[0.78, 0.48, 0.01]} />
        <meshStandardMaterial color={meta.color} emissive={meta.color} emissiveIntensity={3} />
      </mesh>
      {/* Pie del monitor */}
      <mesh position={[0, 0.47, -0.3]} castShadow>
        <boxGeometry args={[0.15, 0.06, 0.15]} />
        <meshStandardMaterial metalness={0.9} roughness={0.1} color="#1a202c" />
      </mesh>
      {/* Texto flotante */}
      <Html center position={[0, 1.8, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{
          background: 'rgba(17, 24, 39, 0.7)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(99, 102, 241, 0.4)',
          color: 'white',
          fontSize: '11px',
          padding: '4px 10px',
          borderRadius: '8px',
          whiteSpace: 'nowrap',
          boxShadow: '0 0 15px rgba(99,102,241,0.3), 0 0 30px rgba(0,0,0,0.5)',
          fontFamily: 'monospace',
          letterSpacing: '0.05em',
        }}>
          {meta.label}
        </div>
      </Html>
    </group>
  )
}