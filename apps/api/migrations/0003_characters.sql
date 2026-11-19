-- Characters (Feature-001 Create character, -026 Choose character, -038 Delete character, -004 Spend points).
-- Ingen fremmednøgle til accounts: bounded contexts kender kun hinandens ID'er.
create schema if not exists characters;

create table if not exists characters.characters (
  id uuid primary key,
  user_id uuid not null,
  name text not null,
  background text not null,
  mark integer not null,
  echo double precision not null,
  attributes jsonb not null,
  skills jsonb not null,
  attribute_points integer not null,
  skill_points integer not null,
  created_at timestamptz not null default now()
);

create index if not exists characters_user on characters.characters (user_id, created_at);

-- Roster (Feature-026 AGG-01): den karakter, brugeren spiller.
create table if not exists characters.rosters (
  user_id uuid primary key,
  active_character_id uuid
);
