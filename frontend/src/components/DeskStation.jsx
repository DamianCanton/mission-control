import { Html } from '@react-three/drei';

// ─── Metadatos de las 7 estaciones ───────────────────────────────────────────

const STATION_META = {
  hq:     { label: '⭐ HQ',       accent: '#fbbf24' },
  dev:    { label: '💻 Dev',      accent: '#3b82f6' },
  files:  { label: '📁 Files',    accent: '#f59e0b' },
  search: { label: '🔍 Search',   accent: '#10b981' },
  memory: { label: '🧠 Memory',   accent: '#8b5cf6' },
  comms:  { label: '📡 Comms',    accent: '#06b6d4' },
  agents: { label: '🤖 Agents',   accent: '#ec4899' },
};

// ─── Muebles compartidos ──────────────────────────────────────────────────────

function Rug({ w = 3.5, d = 2.8, color = '#7f1d1d' }) {
  return (
    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[w, d]} />
      <meshStandardMaterial color={color} roughness={1} />
    </mesh>
  );
}

function DeskSurface({ color = '#f1f5f9' }) {
  return (
    <>
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.15, 1.4]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      {[[-0.95, -0.55], [0.95, -0.55], [-0.95, 0.55], [0.95, 0.55]].map(([px, pz], i) => (
        <mesh key={i} position={[px, 0.25, pz]} castShadow>
          <boxGeometry args={[0.18, 0.5, 0.18]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.9} />
        </mesh>
      ))}
    </>
  );
}

function Monitor({ accent }) {
  return (
    <>
      <mesh position={[0, 1.0, -0.45]} castShadow>
        <boxGeometry args={[1.0, 0.7, 0.1]} />
        <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.5} />
      </mesh>
      <mesh position={[0, 1.02, -0.39]}>
        <boxGeometry args={[0.84, 0.54, 0.02]} />
        <meshStandardMaterial color={accent} roughness={0.9} emissive={accent} emissiveIntensity={0.15} />
      </mesh>
      <mesh position={[0, 0.65, -0.45]} castShadow>
        <boxGeometry args={[0.22, 0.08, 0.22]} />
        <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.64, 0.15]} castShadow>
        <boxGeometry args={[0.9, 0.04, 0.32]} />
        <meshStandardMaterial color="#1e293b" roughness={0.7} metalness={0.2} />
      </mesh>
    </>
  );
}

// ─── Estaciones específicas ───────────────────────────────────────────────────

// HQ — mesa de reunión redonda con 8 sillas
function HQDesk() {
  const slots = Array.from({ length: 8 }, (_, i) => {
    const angle = (i / 8) * Math.PI * 2;
    return [Math.sin(angle) * 2.0, Math.cos(angle) * 2.0];
  });
  return (
    <group>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[7, 7]} />
        <meshStandardMaterial color="#78350f" roughness={1} />
      </mesh>
      <mesh position={[0, 0.48, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.4, 1.4, 0.15, 16]} />
        <meshStandardMaterial color="#c8a96e" roughness={0.7} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.22, 0]} castShadow>
        <boxGeometry args={[0.3, 0.44, 0.3]} />
        <meshStandardMaterial color="#a08060" roughness={0.6} />
      </mesh>
      {/* Estrella decorativa en la mesa */}
      <mesh position={[0, 0.56, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 0.02, 6]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.3} emissive="#fbbf24" emissiveIntensity={0.3} />
      </mesh>
      {slots.map(([sx, sz], i) => {
        const angle = Math.atan2(sx, sz);
        return (
          <group key={i} position={[sx, 0, sz]} rotation={[0, angle + Math.PI, 0]}>
            <mesh position={[0, 0.38, 0]} castShadow>
              <boxGeometry args={[0.52, 0.08, 0.52]} />
              <meshStandardMaterial color="#1e293b" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.65, -0.23]} castShadow>
              <boxGeometry args={[0.5, 0.5, 0.08]} />
              <meshStandardMaterial color="#1e293b" roughness={0.9} />
            </mesh>
            {[[-0.2, -0.18], [0.2, -0.18], [-0.2, 0.18], [0.2, 0.18]].map(([px, pz], j) => (
              <mesh key={j} position={[px, 0.18, pz]} castShadow>
                <boxGeometry args={[0.06, 0.38, 0.06]} />
                <meshStandardMaterial color="#334155" roughness={0.8} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

// Dev — escritorio con server rack y pantallas dobles
function DevDesk({ accent }) {
  return (
    <group>
      <Rug color="#1e3a5f" />
      <DeskSurface color="#e2e8f0" />
      {/* Monitor dual */}
      <mesh position={[-0.55, 1.0, -0.45]} castShadow>
        <boxGeometry args={[0.88, 0.65, 0.08]} />
        <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.5} />
      </mesh>
      <mesh position={[-0.55, 1.01, -0.4]}>
        <boxGeometry args={[0.74, 0.5, 0.02]} />
        <meshStandardMaterial color={accent} roughness={0.9} emissive={accent} emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0.55, 1.0, -0.45]} castShadow>
        <boxGeometry args={[0.88, 0.65, 0.08]} />
        <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.5} />
      </mesh>
      <mesh position={[0.55, 1.01, -0.4]}>
        <boxGeometry args={[0.74, 0.5, 0.02]} />
        <meshStandardMaterial color="#1d4ed8" roughness={0.9} emissive="#1d4ed8" emissiveIntensity={0.1} />
      </mesh>
      {/* Teclado mecánico */}
      <mesh position={[0, 0.64, 0.18]}>
        <boxGeometry args={[1.1, 0.05, 0.38]} />
        <meshStandardMaterial color="#0f172a" roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Server rack */}
      <mesh position={[-1.9, 0.9, 0]} castShadow>
        <boxGeometry args={[0.5, 1.8, 0.65]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.6} />
      </mesh>
      {[0.6, 0.3, 0, -0.3, -0.6].map((y, i) => (
        <mesh key={i} position={[-1.66, 0.9 + y, 0.3]}>
          <boxGeometry args={[0.08, 0.06, 0.04]} />
          <meshStandardMaterial color={i % 2 === 0 ? '#22c55e' : '#3b82f6'} roughness={0.2} emissive={i % 2 === 0 ? '#22c55e' : '#3b82f6'} emissiveIntensity={0.5} />
        </mesh>
      ))}
    </group>
  );
}

// Files — escritorio con archiveros y estante
function FilesDesk({ accent }) {
  return (
    <group>
      <Rug color="#44403c" />
      <DeskSurface color="#fef3c7" />
      <Monitor accent={accent} />
      {/* Archivero lateral */}
      <mesh position={[1.85, 0.6, 0]} castShadow>
        <boxGeometry args={[0.5, 1.2, 0.8]} />
        <meshStandardMaterial color="#d6d3d1" roughness={0.8} />
      </mesh>
      {/* Cajones */}
      {[0.3, 0, -0.3].map((y, i) => (
        <mesh key={i} position={[1.85, 0.6 + y, 0.38]}>
          <boxGeometry args={[0.44, 0.22, 0.04]} />
          <meshStandardMaterial color="#a8a29e" roughness={0.6} />
        </mesh>
      ))}
      {/* Manija cajón */}
      {[0.3, 0, -0.3].map((y, i) => (
        <mesh key={i} position={[1.85, 0.6 + y, 0.42]}>
          <boxGeometry args={[0.12, 0.04, 0.04]} />
          <meshStandardMaterial color="#78716c" roughness={0.4} metalness={0.5} />
        </mesh>
      ))}
      {/* Carpetas en la mesa */}
      {[[-0.6, 0.2], [-0.4, 0.2], [-0.2, 0.2]].map(([px, pz], i) => (
        <mesh key={i} position={[px, 0.66, pz]} castShadow>
          <boxGeometry args={[0.14, 0.18, 0.02]} />
          <meshStandardMaterial color={['#ef4444','#f59e0b','#22c55e'][i]} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// Search — escritorio minimalista con pantalla grande
function SearchDesk({ accent }) {
  return (
    <group>
      <Rug color="#064e3b" />
      <DeskSurface color="#f0fdf4" />
      {/* Monitor grande curvo */}
      <mesh position={[0, 1.05, -0.42]} castShadow>
        <boxGeometry args={[1.6, 0.75, 0.08]} />
        <meshStandardMaterial color="#0f172a" roughness={0.2} metalness={0.6} />
      </mesh>
      <mesh position={[0, 1.06, -0.36]}>
        <boxGeometry args={[1.44, 0.6, 0.02]} />
        <meshStandardMaterial color={accent} roughness={0.9} emissive={accent} emissiveIntensity={0.25} />
      </mesh>
      {/* Lupas decorativas */}
      <mesh position={[-0.85, 0.68, 0.25]} castShadow>
        <cylinderGeometry args={[0.14, 0.14, 0.05, 12]} />
        <meshStandardMaterial color="#10b981" roughness={0.3} metalness={0.4} />
      </mesh>
      {/* Teclado */}
      <mesh position={[0, 0.63, 0.18]}>
        <boxGeometry args={[0.9, 0.04, 0.32]} />
        <meshStandardMaterial color="#1e293b" roughness={0.7} />
      </mesh>
    </group>
  );
}

// Memory — escritorio oscuro con esferas "neuronas"
function MemoryDesk({ accent }) {
  return (
    <group>
      <Rug color="#2e1065" />
      <DeskSurface color="#1e1b4b" />
      <Monitor accent={accent} />
      {/* Esferas-neurona flotantes */}
      {[[-0.7, 0.95, 0.3], [0.7, 1.1, 0.2], [0, 1.3, -0.1]].map(([px, py, pz], i) => (
        <mesh key={i} position={[px, py, pz]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshStandardMaterial color={accent} roughness={0.2} emissive={accent} emissiveIntensity={0.6} />
        </mesh>
      ))}
      {/* Conexiones entre esferas */}
      <mesh position={[0, 1.1, 0.25]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.04, 0.7, 0.04]} />
        <meshStandardMaterial color={accent} roughness={0.4} emissive={accent} emissiveIntensity={0.3} />
      </mesh>
      {/* Libros */}
      {[-0.85, -0.65, -0.45].map((px, i) => (
        <mesh key={i} position={[px, 0.72, 0.2]}>
          <boxGeometry args={[0.12, 0.28, 0.18]} />
          <meshStandardMaterial color={['#7c3aed','#6d28d9','#5b21b6'][i]} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

// Comms — escritorio con antena y pantallas de mensajería
function CommsDesk({ accent }) {
  return (
    <group>
      <Rug color="#0c4a6e" />
      <DeskSurface color="#e0f2fe" />
      <Monitor accent={accent} />
      {/* Antena */}
      <mesh position={[0.9, 1.4, -0.4]} castShadow>
        <boxGeometry args={[0.06, 0.8, 0.06]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.7} />
      </mesh>
      {/* Brazos antena */}
      {[0.3, 0].map((y, i) => (
        <mesh key={i} position={[0.9, 1.6 + y, -0.4]} rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.04, 0.4, 0.04]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.7} />
        </mesh>
      ))}
      {/* Lucecita antena */}
      <mesh position={[0.9, 1.82, -0.4]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.8} />
      </mesh>
      {/* Teléfono */}
      <mesh position={[-0.8, 0.67, 0.25]} castShadow>
        <boxGeometry args={[0.2, 0.08, 0.38]} />
        <meshStandardMaterial color="#1e293b" roughness={0.6} metalness={0.3} />
      </mesh>
    </group>
  );
}

// Agents — mesa redonda pequeña con múltiples pantallas
function AgentsDesk({ accent }) {
  return (
    <group>
      <Rug w={4} d={4} color="#4a044e" />
      {/* Mesa redonda */}
      <mesh position={[0, 0.48, 0]} castShadow>
        <cylinderGeometry args={[1.2, 1.2, 0.15, 12]} />
        <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[0.25, 0.44, 0.25]} />
        <meshStandardMaterial color="#0f172a" roughness={0.5} />
      </mesh>
      {/* 3 pantallas distribuidas en la mesa */}
      {[0, 1, 2].map(i => {
        const angle = (i / 3) * Math.PI * 2;
        const px = Math.sin(angle) * 0.7;
        const pz = Math.cos(angle) * 0.7;
        return (
          <group key={i} position={[px, 0.56, pz]} rotation={[0, -angle, 0]}>
            <mesh position={[0, 0.38, 0]}>
              <boxGeometry args={[0.55, 0.38, 0.05]} />
              <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.5} />
            </mesh>
            <mesh position={[0, 0.38, 0.03]}>
              <boxGeometry args={[0.46, 0.3, 0.02]} />
              <meshStandardMaterial color={accent} roughness={0.9} emissive={accent} emissiveIntensity={0.2} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ─── DeskStation (selector principal) ────────────────────────────────────────

export function DeskStation({ id, position }) {
  const meta = STATION_META[id] || STATION_META.hq;
  const [x, y, z] = position;

  const desk = (() => {
    switch (id) {
      case 'hq':     return <HQDesk />;
      case 'dev':    return <DevDesk    accent={meta.accent} />;
      case 'files':  return <FilesDesk  accent={meta.accent} />;
      case 'search': return <SearchDesk accent={meta.accent} />;
      case 'memory': return <MemoryDesk accent={meta.accent} />;
      case 'comms':  return <CommsDesk  accent={meta.accent} />;
      case 'agents': return <AgentsDesk accent={meta.accent} />;
      default:       return <DevDesk    accent="#7c3aed" />;
    }
  })();

  return (
    <group position={[x, y, z]}>
      {desk}
      <Html center position={[0, -0.3, 1.9]} style={{ pointerEvents: 'none' }}>
        <div style={{
          background:     'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(6px)',
          border:         `1px solid ${meta.accent}66`,
          color:          meta.accent,
          fontSize:       '11px',
          padding:        '3px 10px',
          borderRadius:   '4px',
          whiteSpace:     'nowrap',
          boxShadow:      `0 0 12px ${meta.accent}44`,
          fontFamily:     'monospace',
          fontWeight:     '700',
          letterSpacing:  '0.05em',
        }}>
          {meta.label}
        </div>
      </Html>
    </group>
  );
}
