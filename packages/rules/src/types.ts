// Spillets begreber som typer. Navnene følger Event Modellen i ProductOwner/.

export type Attribute = 'strength' | 'dexterity' | 'stamina' | 'constitution' | 'intelligence';
/** Feature-001: de fire skills, der placeres ved oprettelsen. */
export type CreationSkill = 'blades' | 'heavy' | 'bows' | 'echo';
/** Feature-001 og -049: de fire skills og baggrundens talent, der kun vokser ved brug og med point. */
export type SkillId = CreationSkill | 'talent' | 'reveal';
/** Feature-049: baggrundenes talents. */
export type TalentId = 'hide' | 'berserk' | 'haste' | 'healing';
export type Slot = 'weapon' | 'armour' | 'ring' | 'amulet';
export type Rarity = 'common' | 'magic' | 'rare';
export type AffixStat =
  | Attribute | 'damagePct' | 'maxHp' | 'armour' | 'skill' | 'echoGain'
  // Feature-007: amuletter – + til én skill, og de sjældne amuletters kræfter.
  | 'skillBonus' | 'haste' | 'speed' | 'lifeRegen' | 'staminaRegen';

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
  /** Feature-007: kravet ved item level 1 – våbnets skill og attributten (våben og rustning); intet er 0. */
  reqSkill?: number;
  reqAttribute?: number;
  // Rustning
  armour?: number;
  /** Feature-007: tingens vægt. */
  weight?: number;
}

export interface AffixDef {
  label: string;
  prefix: string;
  suffix: string;
  min: number;
  max: number;
  perLevel: number;
  slots: Slot[];
  /** Højeste værdi (haste og speed: 50 %). */
  cap?: number;
  /** Feature-007: kun på sjældne ting (amuletternes kræfter). */
  rareOnly?: boolean;
}

export interface Background {
  id: string;
  name: string;
  text: string;
  strengths: string[];
  weaknesses: string[];
  /** Pointene, baggrunden foreslår (Feature-001). */
  suggestion: Allocation;
  /** Minimum og maksimum ved oprettelsen (Feature-001). */
  limits: {
    attributes: Record<Attribute, Range>;
    skills: Record<CreationSkill, Range>;
  };
  /** Startvåbnet (et ItemBase-ID). */
  weapon: string;
  /** Feature-049: baggrundens talent. */
  talent: TalentId;
}

export interface Range {
  min: number;
  max: number;
}

/** Fordelingen af point på egenskaber og skills, når en karakter oprettes. */
export interface Allocation {
  attributes: Record<Attribute, number>;
  skills: Record<CreationSkill, number>;
}

export interface Affix {
  stat: AffixStat;
  value: number;
  /** Feature-007: skill'en, en amulets + til en skill gælder. */
  skill?: SkillId;
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
  /** Feature-050: false for en magisk ting, der er fundet i en Tithe og endnu ikke identificeret. */
  identified?: boolean;
}

export interface SkillState {
  level: number;
  xp: number;
}

/** Feature-007: en karakter bærer et nærkampsvåben, et afstandsvåben, rustning og to ringe på samme tid. */
export type EquipSlot = 'melee' | 'ranged' | 'armour' | 'ring1' | 'ring2' | 'amulet';

export interface Equipment {
  melee: Item | null;
  ranged: Item | null;
  armour: Item | null;
  ring1: Item | null;
  ring2: Item | null;
  /** Feature-007: amuletten (mangler i udstyr fra før amuletter). */
  amulet?: Item | null;
}

/** Det våben, Attack bruger (Feature-028). */
export type WeaponSlot = 'melee' | 'ranged';

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
  /** Feature-008: focus potions, der giver 40 % af max focus tilbage. */
  focusPotions: number;
  rations: number;
  equipment: Equipment;
  inventory: Item[];
  tithes: number;
  championships: number;
}
