import { Html } from '@react-three/drei'

const STATION_META = {
  hq:        { label: '⭐ HQ',      accent: '#fbbf24' },
  dev:       { label: '💻 Dev',     accent: '#3b82f6' },
  search:    { label: '🔍 Search',  accent: '#10b981' },
  files:     { label: '📁 Files',   accent: '#f59e0b' },
  memory:    { label: '🧠 Memory',  accent: '#8b5cf6' },
  comms:     { label: '💬 Comms',   accent: '#06b6d4' },
  browser:   { label: '🌐 Browser', accent: '#3b82f6' },
  subagents: { label: '🤖 Agents',  accent: '#ec4899' },
  misc:      { label: '🔧 Misc',    accent: '#6b7280' },
}

// Mesa voxel genérica
function VoxelDesk({ accentColor }) {
  return (
    <group>
      {/* Alfombra */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI/2, 0, 0]} receiveShadow>
        <planeGeometry args={[3.5, 2.8]} />
        <meshStandardMaterial color="#7f1d1d" roughness={1} />
      </mesh>
      {/* Superficie mesa - bloque grueso */}
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.15, 1.4]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.9} metalness={0} />
      </mesh>
      {/* Patas - 4 bloques gruesos */}
      {[[-0.95, -0.55], [0.95, -0.55], [-0.95, 0.55], [0.95, 0.55]].map(([px, pz], i) => (
        <mesh key={i} position={[px, 0.25, pz]} castShadow>
          <boxGeometry args={[0.18, 0.5, 0.18]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.9} />
        </mesh>
      ))}
      {/* Monitor - bloque oscuro */}
      <mesh position={[0, 1.0, -0.45]} castShadow>
        <boxGeometry args={[1.0, 0.7, 0.1]} />
        <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.5} />
      </mesh>
      {/* Pantalla - bloque de color acento */}
      <mesh position={[0, 1.02, -0.39]}>
        <boxGeometry args={[0.84, 0.54, 0.02]} />
        <meshStandardMaterial color={accentColor} roughness={0.95} />
      </mesh>
      {/* Pie monitor - bloque pequeño */}
      <mesh position={[0, 0.65, -0.45]} castShadow>
        <boxGeometry args={[0.22, 0.08, 0.22]} />
        <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.4} />
      </mesh>
      {/* Teclado - bloque plano */}
      <mesh position={[0, 0.64, 0.15]} castShadow>
        <boxGeometry args={[0.9, 0.04, 0.32]} />
        <meshStandardMaterial color="#1e293b" roughness={0.7} metalness={0.2} />
      </mesh>
      {/* Maceta - bloque verde */}
      <mesh position={[-0.9, 0.68, 0.15]} castShadow>
        <boxGeometry args={[0.18, 0.22, 0.18]} />
        <meshStandardMaterial color="#15803d" roughness={0.9} />
      </mesh>
      {/* Planta encima */}
      <mesh position={[-0.9, 0.85, 0.15]}>
        <boxGeometry args={[0.22, 0.18, 0.22]} />
        <meshStandardMaterial color="#16a34a" roughness={1} />
      </mesh>
    </group>
  )
}

// Mesa HQ redonda → convertida a mesa cuadrada grande con sillas bloque
function VoxelHQDesk() {
  const chairPositions = [
    [0, -2.2, 0], [0, 2.2, 0], [-2.2, 0, 0], [2.2, 0, 0]
  ]
  return (
    <group>
      {/* Alfombra roja más grande para HQ */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI/2, 0, 0]} receiveShadow>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial color="#7f1d1d" roughness={1} />
      </mesh>
      {/* Mesa central cuadrada grande */}
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.0, 0.2, 3.0]} />
        <meshStandardMaterial color="#c8a96e" roughness={0.7} metalness={0.1} />
      </mesh>
      {/* Pata central bloque */}
      <mesh position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[0.4, 0.5, 0.4]} />
        <meshStandardMaterial color="#a08060" roughness={0.6} />
      </mesh>
      {/* Sillas bloque */}
      {chairPositions.map(([cx, cy, cz], i) => (
        <group key={i} position={[cx, 0, cz]}>
          <mesh position={[0, 0.44, 0]} castShadow>
            <boxGeometry args={[0.6, 0.1, 0.6]} />
            <meshStandardMaterial color="#334155" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.74, cx === 0 ? (cz > 0 ? -0.27 : 0.27) : 0]} castShadow>
            <boxGeometry args={[0.6, 0.6, 0.1]} />
            <meshStandardMaterial color="#334155" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// Estación DEV con server racks voxel
function VoxelDevDesk({ accentColor }) {
  return (
    <group>
      <VoxelDesk accentColor={accentColor} />
      {/* Server rack - bloque alto */}
      <mesh position={[-1.9, 0.9, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.55, 1.8, 0.7]} />
        <meshStandardMaterial color="#0f172a" roughness={0.2} metalness={0.8} />
      </mesh>
      {/* Luces rack - bloques pequeños */}
      {[0.5, 0.2, -0.1, -0.4, -0.7].map((y, i) => (
        <mesh key={i} position={[-1.64, 0.9 + y, 0.32]}>
          <boxGeometry args={[0.08, 0.06, 0.04]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? '#22c55e' : '#3b82f6'}
            roughness={0.3}
          />
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
      {id === 'hq'
        ? <VoxelHQDesk />
        : id === 'dev'
        ? <VoxelDevDesk accentColor={meta.accent} />
        : <VoxelDesk accentColor={meta.accent} />
      }
      <Html center position={[0, -0.3, 1.8]} style={{ pointerEvents: 'none' }}>
        <div style={{
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(6px)',
          border: `1px solid ${meta.accent}55`,
          color: meta.accent,
          fontSize: '11px',
          padding: '3px 10px',
          borderRadius: '4px',
          whiteSpace: 'nowrap',
          boxShadow: `0 0 10px ${meta.accent}33`,
          fontFamily: 'monospace',
          fontWeight: '700',
          letterSpacing: '0.05em',
        }}>
          {meta.label}
        </div>
      </Html>
    </group>
  )
}