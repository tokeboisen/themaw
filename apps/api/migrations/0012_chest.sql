-- Feature-043 Use the chest: hver karakter har en kiste på Mustering Square med plads til 12 ting. Tingene i kisten
-- ligger i gear.items med placeringen 'chest'; kun de udstyrede pladser er entydige.
alter table gear.items drop constraint if exists items_location_check;
alter table gear.items add constraint items_location_check
  check (location in ('pack', 'chest', 'melee', 'ranged', 'armour', 'ring1', 'ring2'));
drop index if exists gear.gear_items_equipped;
create unique index if not exists gear_items_equipped on gear.items (character_id, location) where location not in ('pack', 'chest');
