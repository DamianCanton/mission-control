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
        <meshStandardMaterial color="#f5f0e8" />
      </mesh>
      {/* Patas x4 */}
      {[[-0.9,-0.5],[0.9,-0.5],[-0.9,0.5],[0.9,0.5]].map(([px,pz],i) => (
        <mesh key={i} position={[px, 0.15, pz]} castShadow>
          <boxGeometry args={[0.08, 0.5, 0.08]} />
          <meshStandardMaterial color="#d4c9b0" />
        </mesh>
      ))}
      {/* Monitor */}
      <mesh position={[0, 0.75, -0.3]} castShadow>
        <boxGeometry args={[0.9, 0.6, 0.05]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      {/* Pantalla del monitor (emisiva con color de la estación) */}
      <mesh position={[0, 0.75, -0.27]}>
        <boxGeometry args={[0.78, 0.48, 0.01]} />
        <meshStandardMaterial color={meta.color} emissive={meta.color} emissiveIntensity={0.3} />
      </mesh>
      {/* Pie del monitor */}
      <mesh position={[0, 0.47, -0.3]} castShadow>
        <boxGeometry args={[0.15, 0.06, 0.15]} />
        <meshStandardMaterial color="#374151" />
      </mesh>
      {/* Texto flotante */}
      <Html center position={[0, 1.6, 0]} style={{ pointerEvents: 'none' }}>
        <div className="bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap font-medium">
          {meta.label}
        </div>
      </Html>
    </group>
  )
}