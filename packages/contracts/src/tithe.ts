// Beskederne over WebSocket mellem webappen og tithe-server under en Tithe (planen, afsnit 8).
// Browseren sender spillerens handlinger; serveren sender et snapshot 20 gange i sekundet med det, spilleren kan se.

import type {
  Equipment, Hotbar, HotbarKey, Item, OutcomeKind, SheetAction, SkillState, TitheSummary, Character,
} from '@maw/rules';

export type ClientMessage =
  | { t: 'input'; moveX: number; moveY: number; attack: boolean }
  | { t: 'act'; act: 'dodge' | 'potion' | 'ration' | 'interact' }
  | { t: 'act'; act: 'hotkey'; key: HotbarKey }
  | { t: 'sheet'; action: SheetAction }
  | { t: 'leave' };

/** Et monster, en rival eller en anden spiller inden for synsradius. */
export interface SnapshotEntity {
  id: string;
  kind: 'monster' | 'rival' | 'player';
  type?: string;
  name: string;
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  flash: boolean;
  color?: string;
  /** En rival, der er fjendtlig mod spilleren. */
  hostile?: boolean;
  warden?: boolean;
  /** Et angreb på vej: rækkevidden eller sigtet (Feature-011 VIEW-01). */
  windup?: { reach?: number; aimX?: number; aimY?: number };
}

export interface YouView {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  focus: number;
  maxFocus: number;
  hunger: number;
  facing: [number, number];
  dodge: number;
  dodgeDir: [number, number];
  swing: number;
  swingDir: [number, number];
  swingArc: number;
  swingReach: number;
  flash: boolean;
  drawing: boolean;
  mark: number;
  echo: number;
  echoNext: number;
  points: number;
  potions: number;
  rations: number;
  /** Tasten med våbnet i hånden (Feature-028 VIEW-01). */
  weaponKey: HotbarKey | null;
  hotbar: Hotbar;
  starving: boolean;
}

export interface CandidateView {
  name: string;
  depth: number;
  status: 'in' | 'fallen' | 'champion' | 'left';
  player: boolean;
  you: boolean;
}

export interface Snapshot {
  t: 'snap';
  time: number;
  depth: number;
  depths: number;
  mapW: number;
  mapH: number;
  /** Kortet for dybden begynder forfra (ny dybde eller genforbindelse). */
  reset: boolean;
  /** Nyopdagede felter som par: indeks, felttype. */
  tiles: number[];
  you: YouView;
  ents: SnapshotEntity[];
  proj: { x: number; y: number; vx: number; vy: number; kind: string }[];
  loot: { id: string; x: number; y: number; kind: string; rarity?: string }[];
  caches: { x: number; y: number; opened: boolean }[];
  gate: { x: number; y: number; open: boolean } | null;
  seal: { left: number; sealed: boolean } | null;
  renown: number;
  goldFound: number;
  candidates: CandidateView[];
  interact: 'descend' | 'gate' | null;
  fx: { type: string; x?: number; y?: number; text?: string; color?: string; size?: number; amount?: number; kind?: string }[];
  msgs: { who: string; text: string }[];
}

/** Karakterskærmen under en Tithe (Feature-004, -007, -027): sendes, når den ændrer sig. */
export interface SheetMessage {
  t: 'sheet';
  character: {
    id: string;
    name: string;
    background: string;
    mark: number;
    echo: number;
    attributes: Character['attributes'];
    skills: Record<string, SkillState>;
    attributePoints: number;
    skillPoints: number;
  };
  inventory: { equipment: Equipment; pack: Item[]; potions: number; rations: number; hotbar: Hotbar; capacity: number };
  /** ID'erne på de ting, der er fundet i denne Tithe: "Found this Tithe – lost if you fall" (Feature-007 VIEW-01). */
  found: string[];
}

/** Feature-016 VIEW-01 Tithe results. */
export interface EndedMessage {
  t: 'ended';
  kind: OutcomeKind;
  summary: TitheSummary;
}

export type ServerMessage =
  | { t: 'welcome'; name: string; you: string }
  | Snapshot
  | SheetMessage
  | EndedMessage
  | { t: 'refused'; message: string }
  | { t: 'gone'; reason: string };
