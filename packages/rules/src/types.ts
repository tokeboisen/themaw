// Spillets begreber som typer. Navnene følger Event Modellen i ProductOwner/.

export type Attribute = 'strength' | 'dexterity' | 'stamina' | 'constitution' | 'intelligence';
export type SkillId = 'blades' | 'heavy' | 'bows' | 'echo';
export type Slot = 'weapon' | 'armour' | 'ring';
export type Rarity = 'common' | 'magic' | 'rare';
export type AffixStat = Attribute | 'damagePct' | 'maxHp' | 'armour' | 'skill' | 'echoGain';

export interface ItemBase {
  name: string;
  slot: Slot;
  price: number;
  minLevel?: number;
  // Våben
  skill?: SkillId;
  min?: number;
  max?: number;
  reach?: number;
  range?: number;
  cooldown?: number;
  stamina?: number;
  arc?: number;
  // Rustning
  armour?: number;
}

export interface AffixDef {
  label: string;
  prefix: string;
  suffix: string;
  min: number;
  max: number;
  perLevel: number;
  slots: Slot[];
}

export interface Background {
  id: string;
  name: string;
  text: string;
  attributes: Partial<Record<Attribute, number>>;
  skills: Partial<Record<SkillId, number>>;
  weapon: string;
}

export interface Affix {
  stat: AffixStat;
  value: number;
}

export interface Item {
  id: string;
  baseId: string;
  slot: Slot;
  ilvl: number;
  rarity: Rarity;
  affixes: Affix[];
  name: string;
  value: number;
  skill?: SkillId;
  min?: number;
  max?: number;
  armour?: number;
  /** ID'et på den Tithe, hvor tingen blev fundet, indtil Tithen er afgjort (Feature-009). */
  found?: string;
}

export interface SkillState {
  level: number;
  xp: number;
}

export interface Equipment {
  weapon: Item | null;
  armour: Item | null;
  ring: Item | null;
}

export interface Character {
  name: string;
  background: string;
  level: number;
  echo: number;
  attributes: Record<Attribute, number>;
  skills: Record<SkillId, SkillState>;
  attributePoints: number;
  skillPoints: number;
  gold: number;
  potions: number;
  rations: number;
  equipment: Equipment;
  inventory: Item[];
  tithes: number;
  championships: number;
}
