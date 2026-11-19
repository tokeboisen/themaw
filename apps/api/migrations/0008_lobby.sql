-- Lobby (Feature-036 Open a Tithe, -025 Join a Tithe, -037 Launch the Tithe).
-- En Tithe står her, fra den åbnes, til den ikke længere kører i tithe-server. Navnet er entydigt blandt dem.
create schema if not exists lobby;

create table if not exists lobby.tithes (
  id uuid primary key,
  name text not null,
  name_key text not null,
  opener_user_id uuid not null,
  status text not null check (status in ('open', 'launched')),
  created_at timestamptz not null default now(),
  launched_at timestamptz
);

create unique index if not exists lobby_tithes_name on lobby.tithes (name_key);

-- En spiller er i én lobby ad gangen (Feature-025).
create table if not exists lobby.members (
  user_id uuid primary key,
  tithe_id uuid not null references lobby.tithes (id) on delete cascade,
  user_name text not null,
  character_id uuid not null,
  character_name text not null,
  mark integer not null,
  ticket text,
  joined_at timestamptz not null default now()
);

create index if not exists lobby_members_tithe on lobby.members (tithe_id, joined_at);
