-- ============================================================================
-- 001_extensions.sql
-- Extensiones necesarias para Rodilla en Supabase
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- pgcrypto: gen_random_uuid(), digest(), crypt()
-- uuid-ossp: uuid_generate_v4() (por compatibilidad)