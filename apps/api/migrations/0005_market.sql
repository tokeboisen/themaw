-- Market (Feature-018 Keep the wallet, -019 Trade at the Forge, -020 Shop at the Apothecary, -021 Restock the Forge).
create schema if not exists market;

create table if not exists market.wallets (
  character_id uuid primary key,
  user_id uuid not null,
  gold integer not null check (gold >= 0)
);

-- Hver karakter har sin egen Forge (Feature-021 CMD-02).
create table if not exists market.forges (
  character_id uuid primary key,
  user_id uuid not null,
  stock jsonb not null
);

-- En ting kan kun sælges én gang, også hvis knappen trykkes to gange.
create table if not exists market.sold_items (
  item_id text primary key,
  character_id uuid not null,
  sold_at timestamptz not null default now()
);
