-- ============================================================
-- Mission Control — Security Advisor fixes
-- Aplicar en Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Function Search Path Mutable
--    Fix: agregar SET search_path = '' a cada función
-- ─────────────────────────────────────────────────────────────

-- insert_agent_event
ALTER FUNCTION public.insert_agent_event
  SET search_path = '';

-- refresh_metrics
ALTER FUNCTION public.refresh_metrics
  SET search_path = '';

-- get_session_timeline
ALTER FUNCTION public.get_session_timeline
  SET search_path = '';

-- get_stats_last_hours
ALTER FUNCTION public.get_stats_last_hours
  SET search_path = '';


-- ─────────────────────────────────────────────────────────────
-- 2. Extension in Public (pg_trgm)
--    Fix: mover la extensión al schema extensions
--    Nota: en Supabase Free no siempre se puede mover,
--    pero sí se puede recrear en el schema correcto.
-- ─────────────────────────────────────────────────────────────

-- Primero verificar si existe el schema extensions
CREATE SCHEMA IF NOT EXISTS extensions;

-- Mover pg_trgm fuera de public
DROP EXTENSION IF EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_trgm
  SCHEMA extensions;


-- ─────────────────────────────────────────────────────────────
-- 3. Materialized View in API
--    Fix: mover session_metrics y agent_metrics fuera de public
--    Las movemos a un schema interno no expuesto por PostgREST
-- ─────────────────────────────────────────────────────────────

CREATE SCHEMA IF NOT EXISTS internal;

-- Recrear session_metrics en internal
-- (ajustar la query si difiere de la original)
CREATE MATERIALIZED VIEW internal.session_metrics AS
  SELECT * FROM public.session_metrics;

CREATE MATERIALIZED VIEW internal.agent_metrics AS
  SELECT * FROM public.agent_metrics;

-- Eliminar las originales de public
DROP MATERIALIZED VIEW IF EXISTS public.session_metrics;
DROP MATERIALIZED VIEW IF EXISTS public.agent_metrics;


-- ─────────────────────────────────────────────────────────────
-- 4. RLS Policy Always True
--    Fix: reemplazar USING (true) por condiciones reales.
--    Dado que el backend usa service_role (bypasa RLS),
--    y el frontend usa anon_key solo para lectura,
--    la política correcta es: lectura libre, escritura bloqueada
--    para anon/authenticated. Service_role siempre bypasa.
-- ─────────────────────────────────────────────────────────────

-- agent_events
DROP POLICY IF EXISTS "Allow all" ON public.agent_events;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.agent_events;

CREATE POLICY "anon_read_agent_events"
  ON public.agent_events
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Solo service_role puede insertar/actualizar/borrar
-- (el backend ya usa service_role, no necesita policy explícita)


-- agents
DROP POLICY IF EXISTS "Allow all" ON public.agents;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.agents;

CREATE POLICY "anon_read_agents"
  ON public.agents
  FOR SELECT
  TO anon, authenticated
  USING (true);


-- sessions
DROP POLICY IF EXISTS "Allow all" ON public.sessions;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.sessions;

CREATE POLICY "anon_read_sessions"
  ON public.sessions
  FOR SELECT
  TO anon, authenticated
  USING (true);


-- tasks
DROP POLICY IF EXISTS "Allow all" ON public.tasks;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.tasks;

CREATE POLICY "anon_read_tasks"
  ON public.tasks
  FOR SELECT
  TO anon, authenticated
  USING (true);
