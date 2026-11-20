-- Feature-044 Arrange an arena match: en arenakamp står i lobbyen som en Tithe med reach 'arena', et format og en
-- indsats, og hver spiller står på en side (1 eller 2).
alter table lobby.tithes add column if not exists format text;
alter table lobby.tithes add column if not exists stake integer not null default 0;
alter table lobby.members add column if not exists side smallint;
