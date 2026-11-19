-- Platform: outbox til events og hukommelse om behandlede events (Plan-server-og-webapp.md, afsnit 6).
-- Hver bounded context får sit eget skema i de følgende faser.

create table if not exists platform.outbox (
  id uuid primary key,
  type text not null,
  payload jsonb not null,
  occurred_at timestamptz not null,
  published_at timestamptz
);

create index if not exists outbox_unpublished on platform.outbox (occurred_at) where published_at is null;

create table if not exists platform.processed_events (
  consumer text not null,
  event_id uuid not null,
  processed_at timestamptz not null default now(),
  primary key (consumer, event_id)
);
