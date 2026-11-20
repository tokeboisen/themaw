-- Feature-007 v3: en karakter bærer et nærkampsvåben, et afstandsvåben, rustning og to ringe på samme tid.
-- Det, der sad på "weapon", flyttes til "ranged", når det er en bue (våben med rækkevidde i balance.ts: short_bow og
-- hunting_bow), ellers til "melee". Ringen flyttes til "ring1".
alter table gear.items drop constraint if exists items_location_check;
update gear.items set location = case when data->>'baseId' in ('short_bow', 'hunting_bow') then 'ranged' else 'melee' end
  where location = 'weapon';
update gear.items set location = 'ring1' where location = 'ring';
alter table gear.items add constraint items_location_check
  check (location in ('pack', 'melee', 'ranged', 'armour', 'ring1', 'ring2'));
