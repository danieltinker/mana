-- LOCAL SIMULATOR STACK ONLY. Never a migration, never on a Supabase project.
-- What a Supabase project has BEFORE any migration of ours runs, reduced to what Mana's clean schema touches:
-- the API roles, the auth / storage / extensions schemas, the storage tables, the default privileges and the
-- realtime publication. Run as the superuser "postgres". GoTrue creates the tables of the auth schema itself
-- (its own migrations); after-auth.sql then sets the JWT helpers.
-- Adapted from apps/studio/test/stack/bootstrap.sql (the old schema's stack) and supabase/tests/harness/auth-stub.sql.

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role authenticator login noinherit password 'local';
grant anon, authenticated, service_role to authenticator;
create role supabase_auth_admin login noinherit createrole password 'local';
create role supabase_storage_admin nologin noinherit;

create schema extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema public, extensions to anon, authenticated, service_role;
alter database postgres set search_path = public, extensions;

-- Supabase's default privileges: everything new in public is open to the API roles (Mana's access migration opts out)
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- GoTrue migrates this schema itself, as supabase_auth_admin
create schema auth authorization supabase_auth_admin;
grant usage on schema auth to anon, authenticated, service_role, postgres;
alter role supabase_auth_admin set search_path = auth;
grant create on database postgres to supabase_auth_admin;

-- Storage: the two tables (and helpers) the access migration's buckets and policies need. No storage service runs
-- locally yet (see sim/README.md); the tables exist so the migrations apply exactly as on a project.
create schema storage authorization supabase_storage_admin;
grant usage on schema storage to anon, authenticated, service_role, postgres;
create table storage.buckets (
  id text primary key,
  name text not null unique,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  public boolean default false,
  avif_autodetection boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  owner_id text
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz default now(),
  metadata jsonb,
  path_tokens text[] generated always as (string_to_array(name, '/')) stored,
  version text,
  owner_id text,
  user_metadata jsonb
);
create unique index bucketid_objname on storage.objects (bucket_id, name);
alter table storage.buckets owner to supabase_storage_admin;
alter table storage.objects owner to supabase_storage_admin;
alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;
grant all on storage.buckets, storage.objects to anon, authenticated, service_role, postgres;

create function storage.foldername(name text) returns text[] language plpgsql immutable as $$
declare parts text[];
begin
  select string_to_array(name, '/') into parts;
  return parts[1:array_length(parts, 1) - 1];
end $$;
create function storage.filename(name text) returns text language plpgsql immutable as $$
declare parts text[];
begin
  select string_to_array(name, '/') into parts;
  return parts[array_length(parts, 1)];
end $$;
grant execute on function storage.foldername(text), storage.filename(text) to anon, authenticated, service_role;

-- Supabase's realtime publication exists on every project (the access migration adds the rollups to it)
create publication supabase_realtime;
