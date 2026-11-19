-- Feature-034 VIEW-01 Other players: "the players signed in on the server". En session tæller som logget ind, når den
-- er brugt inden for de sidste par minutter (webappen spørger hvert andet sekund), eller når spilleren er i en lobby
-- eller en Tithe.
alter table accounts.sessions add column if not exists last_seen_at timestamptz not null default now();
create index if not exists sessions_last_seen on accounts.sessions (last_seen_at);
