-- Feature-036 v3: en Tithe åbnes i en Reach – The Old Mines eller The Broken City.
alter table lobby.tithes add column if not exists reach text not null default 'mines';
