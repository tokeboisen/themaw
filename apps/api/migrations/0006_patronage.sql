-- Patronage (Feature-023 Grant sponsor gifts, -024 Accept sponsor gifts).
create schema if not exists patronage;

create table if not exists patronage.gifts (
  id text primary key,
  character_id uuid not null,
  user_id uuid not null,
  house text not null,
  kind text not null check (kind in ('item', 'gold')),
  item jsonb,
  gold integer,
  granted_at timestamptz not null default now(),
  accepted_at timestamptz
);

create index if not exists gifts_waiting on patronage.gifts (character_id, granted_at) where accepted_at is null;
