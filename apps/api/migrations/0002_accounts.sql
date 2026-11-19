-- Accounts (Feature-031 Create user, -032 Log in, -033 Log out): brugere og sessioner.
create schema if not exists accounts;

create table if not exists accounts.users (
  id uuid primary key,
  user_name text not null,
  -- Brugernavne er entydige uanset store og små bogstaver.
  user_name_key text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- En session pr. enhed; kun en hash af sessionens token gemmes.
create table if not exists accounts.sessions (
  token_hash text primary key,
  user_id uuid not null references accounts.users (id) on delete cascade,
  device text not null default '',
  signed_in_at timestamptz not null default now()
);

create index if not exists sessions_user on accounts.sessions (user_id);
