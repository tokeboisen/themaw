-- Gear (Feature-005 Stock the inventory, -007 Manage equipment, -027 Assign hotbar keys).
create schema if not exists gear;

create table if not exists gear.inventories (
  character_id uuid primary key,
  user_id uuid not null,
  potions integer not null check (potions >= 0),
  rations integer not null check (rations >= 0),
  hotbar jsonb not null default '{}'
);

-- Hver ting ligger i pakken eller på én af de tre pladser.
create table if not exists gear.items (
  id text primary key,
  character_id uuid not null references gear.inventories (character_id) on delete cascade,
  location text not null check (location in ('pack', 'weapon', 'armour', 'ring')),
  data jsonb not null,
  added_at timestamptz not null default now()
);

create index if not exists gear_items_character on gear.items (character_id, added_at);
create unique index if not exists gear_items_equipped on gear.items (character_id, location) where location <> 'pack';
