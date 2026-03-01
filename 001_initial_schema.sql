-- ============================================================
-- MISSION CONTROL · Database Schema
-- Supabase (PostgreSQL) · Self-hosted
-- Author: Damián Cantón · Feb 2026
-- ============================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- Para búsqueda fuzzy en logs

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE agent_status AS ENUM (
  'running',
  'thinking',
  'completed',
  'error',
  'idle'
);

CREATE TYPE station_name AS ENUM (
  'hq',
  'dev',
  'search',
  'files',
  'memory',
  'messages',
  'browser',
  'agents',
  'wildcard'
);

-- ============================================================
-- 1. SESSIONS
-- Cada ejecución/sesión de OpenClaw
-- ============================================================

CREATE TABLE sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at      TIMESTAMPTZ,
  duration_ms   BIGINT GENERATED ALWAYS AS (
                  EXTRACT(EPOCH FROM (ended_at - started_at)) * 1000
                ) STORED,
  model_used    TEXT,                    -- ej: 'github-copilot/claude-sonnet-4.6'
  trigger       TEXT,                    -- 'telegram', 'cli', 'web', etc.
  metadata      JSONB DEFAULT '{}',      -- datos extra flexibles
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_started ON sessions (started_at DESC);

-- ============================================================
-- 2. AGENTS
-- Agentes únicos registrados (catálogo)
-- ============================================================

CREATE TABLE agents (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL UNIQUE,     -- nombre del agente (del log)
  display_name  TEXT,                     -- nombre para mostrar en UI
  color         TEXT DEFAULT '#3B82F6',   -- color en el dashboard
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_events  BIGINT DEFAULT 0,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agents_name ON agents (name);

-- ============================================================
-- 3. AGENT_EVENTS
-- Cada línea de log parseada — el corazón del sistema
-- ============================================================

CREATE TABLE agent_events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id    UUID REFERENCES sessions(id) ON DELETE CASCADE,  -- nullable: MVP no gestiona sesiones aun
  agent_id      UUID REFERENCES agents(id) ON DELETE CASCADE,
  agent_name    TEXT NOT NULL,            -- redundante para queries rápidos
  action        TEXT NOT NULL,            -- acción del log
  status        agent_status NOT NULL DEFAULT 'running',
  station       station_name,            -- estación asignada
  occurred_at   TIMESTAMPTZ NOT NULL,    -- timestamp original del log
  duration_ms   INTEGER,                 -- duración de la acción (si aplica)
  metadata      JSONB DEFAULT '{}',      -- metadata extra del log
  raw_log       TEXT,                    -- línea original del log (para replay)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para queries frecuentes
CREATE INDEX idx_events_session    ON agent_events (session_id, occurred_at);
CREATE INDEX idx_events_agent      ON agent_events (agent_id, occurred_at DESC);
CREATE INDEX idx_events_status     ON agent_events (status);
CREATE INDEX idx_events_station    ON agent_events (station);
CREATE INDEX idx_events_timestamp  ON agent_events (occurred_at DESC);
CREATE INDEX idx_events_action     ON agent_events USING gin (action gin_trgm_ops);
CREATE INDEX idx_events_metadata   ON agent_events USING gin (metadata);

-- ============================================================
-- 4. TASKS
-- Tareas ejecutadas por agentes (agrupación de events)
-- ============================================================

CREATE TABLE tasks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id    UUID REFERENCES sessions(id) ON DELETE CASCADE,  -- nullable: MVP no gestiona sesiones aun
  agent_id      UUID REFERENCES agents(id) ON DELETE CASCADE,
  title         TEXT,                     -- descripción corta de la tarea
  status        agent_status NOT NULL DEFAULT 'running',
  station       station_name,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at      TIMESTAMPTZ,
  duration_ms   BIGINT GENERATED ALWAYS AS (
                  EXTRACT(EPOCH FROM (ended_at - started_at)) * 1000
                ) STORED,
  event_count   INTEGER DEFAULT 0,       -- cantidad de events en esta task
  result        JSONB DEFAULT '{}',      -- resultado/output de la tarea
  error_message TEXT,                    -- si falló, el mensaje de error
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_session  ON tasks (session_id, started_at);
CREATE INDEX idx_tasks_agent    ON tasks (agent_id, started_at DESC);
CREATE INDEX idx_tasks_status   ON tasks (status);

-- ============================================================
-- 5. AGENT_METRICS (Materialized View)
-- Métricas pre-calculadas por agente — se refresca periódicamente
-- ============================================================

CREATE MATERIALIZED VIEW agent_metrics AS
SELECT
  a.id                                    AS agent_id,
  a.name                                  AS agent_name,
  COUNT(e.id)                             AS total_events,
  COUNT(DISTINCT e.session_id)            AS total_sessions,
  COUNT(CASE WHEN e.status = 'completed' THEN 1 END) AS completed_count,
  COUNT(CASE WHEN e.status = 'error' THEN 1 END)     AS error_count,
  ROUND(
    COUNT(CASE WHEN e.status = 'error' THEN 1 END)::NUMERIC /
    NULLIF(COUNT(e.id), 0) * 100, 2
  )                                       AS error_rate_pct,
  AVG(e.duration_ms)::INTEGER             AS avg_duration_ms,
  MAX(e.occurred_at)                        AS last_active_at,
  MODE() WITHIN GROUP (ORDER BY e.station) AS most_used_station
FROM agents a
LEFT JOIN agent_events e ON e.agent_id = a.id
GROUP BY a.id, a.name;

CREATE UNIQUE INDEX idx_agent_metrics_id ON agent_metrics (agent_id);

-- ============================================================
-- 6. SESSION_METRICS (Materialized View)
-- Resumen por sesión para analytics rápidos
-- ============================================================

CREATE MATERIALIZED VIEW session_metrics AS
SELECT
  s.id                                    AS session_id,
  s.started_at,
  s.ended_at,
  s.duration_ms,
  s.model_used,
  COUNT(DISTINCT e.agent_id)              AS unique_agents,
  COUNT(e.id)                             AS total_events,
  COUNT(DISTINCT t.id)                    AS total_tasks,
  COUNT(CASE WHEN e.status = 'completed' THEN 1 END) AS completed_events,
  COUNT(CASE WHEN e.status = 'error' THEN 1 END)     AS error_events
FROM sessions s
LEFT JOIN agent_events e ON e.session_id = s.id
LEFT JOIN tasks t ON t.session_id = s.id
GROUP BY s.id;

CREATE UNIQUE INDEX idx_session_metrics_id ON session_metrics (session_id);

-- ============================================================
-- 7. FUNCIONES ÚTILES
-- ============================================================

-- Registrar un evento y auto-crear el agente si no existe
-- session_id es OPCIONAL en el MVP (backend no gestiona sesiones aun)
CREATE OR REPLACE FUNCTION insert_agent_event(
  p_agent_name  TEXT,
  p_action      TEXT,
  p_status      agent_status,
  p_session_id  UUID DEFAULT NULL,
  p_station     station_name DEFAULT NULL,
  p_occurred_at TIMESTAMPTZ DEFAULT NOW(),
  p_duration_ms INTEGER DEFAULT NULL,
  p_metadata    JSONB DEFAULT '{}',
  p_raw_log     TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_agent_id UUID;
  v_event_id UUID;
BEGIN
  -- Upsert del agente
  INSERT INTO agents (name, last_seen_at)
  VALUES (p_agent_name, p_occurred_at)
  ON CONFLICT (name)
  DO UPDATE SET
    last_seen_at = GREATEST(agents.last_seen_at, p_occurred_at),
    total_events = agents.total_events + 1
  RETURNING id INTO v_agent_id;

  -- Insertar evento
  INSERT INTO agent_events (
    session_id, agent_id, agent_name, action, status,
    station, occurred_at, duration_ms, metadata, raw_log
  ) VALUES (
    p_session_id, v_agent_id, p_agent_name, p_action, p_status,
    p_station, p_occurred_at, p_duration_ms, p_metadata, p_raw_log
  ) RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- Refrescar las materialized views (para cron o llamada manual)
CREATE OR REPLACE FUNCTION refresh_metrics()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY agent_metrics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY session_metrics;
END;
$$ LANGUAGE plpgsql;

-- Obtener timeline de una sesión (para replay)
CREATE OR REPLACE FUNCTION get_session_timeline(p_session_id UUID)
RETURNS TABLE (
  event_id    UUID,
  agent_name  TEXT,
  action      TEXT,
  status      agent_status,
  station     station_name,
  occurred_at TIMESTAMPTZ,
  duration_ms INTEGER,
  metadata    JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id, e.agent_name, e.action, e.status,
    e.station, e.occurred_at, e.duration_ms, e.metadata
  FROM agent_events e
  WHERE e.session_id = p_session_id
  ORDER BY e.occurred_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Stats de las últimas N horas
CREATE OR REPLACE FUNCTION get_stats_last_hours(p_hours INTEGER DEFAULT 24)
RETURNS TABLE (
  total_events    BIGINT,
  total_sessions  BIGINT,
  unique_agents   BIGINT,
  error_count     BIGINT,
  avg_duration_ms NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(e.id),
    COUNT(DISTINCT e.session_id),
    COUNT(DISTINCT e.agent_id),
    COUNT(CASE WHEN e.status = 'error' THEN 1 END),
    ROUND(AVG(e.duration_ms)::NUMERIC, 2)
  FROM agent_events e
  WHERE e.occurred_at >= NOW() - (p_hours || ' hours')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 8. ROW LEVEL SECURITY
-- Preparado para cuando agregues auth de Supabase
-- ============================================================

ALTER TABLE sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks        ENABLE ROW LEVEL SECURITY;

-- Política abierta (single-user, tu server)
-- Cuando agregues multi-user, cambiás estas policies
CREATE POLICY "allow_all" ON sessions     FOR ALL USING (true);
CREATE POLICY "allow_all" ON agents       FOR ALL USING (true);
CREATE POLICY "allow_all" ON agent_events FOR ALL USING (true);
CREATE POLICY "allow_all" ON tasks        FOR ALL USING (true);

-- ============================================================
-- 9. REALTIME
-- Habilitar para que Supabase pushee cambios al frontend
-- ============================================================

-- Guarda para ALTER PUBLICATION (puede no existir si es cloud o DB nueva)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE agent_events;
    ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
    ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'supabase_realtime publication no disponible: %', SQLERRM;
END;
$$;
