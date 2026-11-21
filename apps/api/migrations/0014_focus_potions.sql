-- Feature-008 v4 og Feature-005 v5: focus potions, der giver 40 % af max focus tilbage. Karakterer fra før har ingen.
alter table gear.inventories add column focus_potions integer not null default 0 check (focus_potions >= 0);
