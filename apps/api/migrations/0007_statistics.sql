-- Characters: statistikken (Feature-039 Keep player statistics, Feature-040 View player statistics).
create table if not exists characters.statistics (
  character_id uuid primary key,
  tithes integer not null default 0,
  champions integer not null default 0,
  falls integer not null default 0,
  left_tithes integer not null default 0,
  deepest integer not null default 0,
  monsters integer not null default 0,
  rivals integer not null default 0,
  player_kills integer not null default 0,
  killed_by_players integer not null default 0
);
