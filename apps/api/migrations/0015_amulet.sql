-- Feature-007 v10: en amulet-plads.
alter table gear.items drop constraint if exists items_location_check;
alter table gear.items add constraint items_location_check
  check (location in ('pack', 'chest', 'melee', 'ranged', 'armour', 'ring1', 'ring2', 'amulet'));
