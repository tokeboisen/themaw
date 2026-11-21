// Characters' forespørgsler til de andre moduler i api'et. Commands og events går over bussen; aflæsninger som denne
// er direkte, fordi modulerne kører i samme proces (planen, afsnit 5). Deles modulerne senere i services, skal Gear i
// stedet holde en kopi af det, den læser her.

import { normalizeSkills, type Character } from '@maw/rules';
import type { Client, Pool } from '../db.ts';

export interface CharacterCore {
  userId: string;
  name: string;
  background: string;
  mark: number;
  echo: number;
  attributes: Character['attributes'];
  skills: Character['skills'];
  attributePoints: number;
  skillPoints: number;
}

export async function characterCore(db: Pool | Client, characterId: string): Promise<CharacterCore | undefined> {
  const { rows } = await db.query<{
    user_id: string; name: string; background: string; mark: number; echo: number; attributes: Character['attributes'];
    skills: Character['skills']; attribute_points: number; skill_points: number;
  }>('select * from characters.characters where id = $1', [characterId]);
  const r = rows[0];
  if (!r) return undefined;
  normalizeSkills(r); // Feature-049: karakterer fra før talentet har det på niveau 0
  return {
    userId: r.user_id, name: r.name, background: r.background, mark: r.mark, echo: r.echo, attributes: r.attributes,
    skills: r.skills, attributePoints: r.attribute_points, skillPoints: r.skill_points,
  };
}
