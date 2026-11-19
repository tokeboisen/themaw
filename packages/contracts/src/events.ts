// Event-kataloget: hvordan hvert event, der krydser bounded contexts i Event Modellen, kommer fra udgiver til lytter.
// test/catalog.test.ts tjekker, at kataloget og modellernes stimuli (ProductOwner/) er de samme.

/** Konvolutten om et event på RabbitMQ. */
export interface EventEnvelope<T = unknown> {
  /** Unikt pr. event; lytterne bruger det til ikke at behandle samme event to gange. */
  id: string;
  /** Routing key, f.eks. "tithe.tithe-ended". */
  type: string;
  occurredAt: string;
  data: T;
}

export const EXCHANGE = 'maw.events';
export const DEAD_LETTER_EXCHANGE = 'maw.dead';
export const DEAD_LETTER_QUEUE = 'maw.dead';

/**
 * bus: RabbitMQ (mellem api og tithe-server, og mellem modulerne i api).
 * in-process: inde i tithe-server, hvor Tithen kører med en arbejdskopi af karakteren.
 * ui: en stimulus til et UI View er navigation i webappen.
 * carried: følger med et andet event (carriedBy).
 */
export type Transport = 'bus' | 'in-process' | 'ui' | 'carried';

export interface Route {
  /** Eventets navn i modellen. */
  event: string;
  /** Den bounded context, eventet kommer fra. */
  from: string;
  /** Den bounded context og feature, hvor eventet er stimulus. */
  to: string;
  feature: string;
  transport: Transport;
  carriedBy?: string;
}

export function kebab(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Routing key for et event: "<context>.<event>", f.eks. "characters.character-created". */
export function routingKey(context: string, event: string): string {
  return `${kebab(context)}.${kebab(event)}`;
}

/** Køen, en bounded context lytter på. */
export function queueFor(context: string): string {
  return `maw.${kebab(context)}`;
}

const r = (event: string, from: string, to: string, feature: string, transport: Transport, carriedBy?: string): Route =>
  carriedBy ? { event, from, to, feature, transport, carriedBy } : { event, from, to, feature, transport };

export const ROUTES: Route[] = [
  // Brugere og karakterer
  r('User logged in', 'Accounts', 'Characters', 'F026', 'ui'),
  r('User created', 'Accounts', 'Characters', 'F026', 'ui'),
  r('Character created', 'Characters', 'Gear', 'F005', 'bus'),
  r('Character created', 'Characters', 'Market', 'F018', 'bus'),
  r('Character created', 'Characters', 'Market', 'F021', 'bus'),
  r('Character deleted', 'Characters', 'Gear', 'F005', 'bus'),
  r('Character deleted', 'Characters', 'Market', 'F018', 'bus'),
  r('Character deleted', 'Characters', 'Market', 'F021', 'bus'),
  r('Character deleted', 'Characters', 'Patronage', 'F023', 'bus'),
  // The Rim
  r('Item bought', 'Market', 'Gear', 'F005', 'bus'),
  r('Item sold', 'Market', 'Gear', 'F005', 'bus'),
  r('Potion bought', 'Market', 'Gear', 'F005', 'bus'),
  r('Ration bought', 'Market', 'Gear', 'F005', 'bus'),
  r('Item gift accepted', 'Patronage', 'Gear', 'F005', 'bus'),
  r('Gold gift accepted', 'Patronage', 'Market', 'F018', 'bus'),
  r('Purse paid', 'Patronage', 'Market', 'F018', 'bus'),
  r('Found gear kept', 'Gear', 'Market', 'F018', 'bus'),
  // Lobby → Tithe
  r('Tithe launched', 'Lobby', 'Tithe', 'F010', 'bus'),
  // Tithe → resten, når en spillers del af Tithen slutter
  r('Tithe ended', 'Tithe', 'Gear', 'F009', 'bus'),
  r('Tithe ended', 'Tithe', 'Market', 'F021', 'bus'),
  r('Tithe ended', 'Tithe', 'Patronage', 'F022', 'bus'),
  r('Tithe ended', 'Tithe', 'Patronage', 'F023', 'bus'),
  r('Tithe ended', 'Tithe', 'Characters', 'F039', 'bus'),
  r('Player defeated', 'Tithe', 'Market', 'F018', 'bus'),
  r('Player defeated', 'Tithe', 'Characters', 'F039', 'bus'),
  // Renown sker mange gange i sekundet; summen følger med "Tithe ended" (Plan-server-og-webapp.md, afsnit 6).
  r('Renown earned', 'Spectacle', 'Patronage', 'F022', 'carried', 'Tithe ended'),
  r('Renown earned', 'Spectacle', 'Patronage', 'F023', 'carried', 'Tithe ended'),
  // Inde i tithe-server: kampen, showet og karakterens arbejdskopi
  r('Blow landed', 'Tithe', 'Characters', 'F002', 'in-process'),
  r('Blow landed', 'Tithe', 'Spectacle', 'F017', 'in-process'),
  r('Monster slain', 'Tithe', 'Characters', 'F002', 'in-process'),
  r('Monster slain', 'Tithe', 'Characters', 'F003', 'in-process'),
  r('Monster slain', 'Tithe', 'Spectacle', 'F017', 'in-process'),
  r('Rival defeated', 'Tithe', 'Characters', 'F002', 'in-process'),
  r('Rival defeated', 'Tithe', 'Characters', 'F003', 'in-process'),
  r('Rival defeated', 'Tithe', 'Spectacle', 'F017', 'in-process'),
  r('Player defeated', 'Tithe', 'Characters', 'F002', 'in-process'),
  r('Player defeated', 'Tithe', 'Characters', 'F003', 'in-process'),
  r('Player defeated', 'Tithe', 'Spectacle', 'F017', 'in-process'),
  r('Tithe started', 'Tithe', 'Spectacle', 'F017', 'in-process'),
  r('Depth reached', 'Tithe', 'Spectacle', 'F017', 'in-process'),
  r('Warden slain', 'Tithe', 'Spectacle', 'F017', 'in-process'),
  r('Beasts released', 'Spectacle', 'Tithe', 'F013', 'in-process'),
  r('Depth sealed', 'Spectacle', 'Tithe', 'F013', 'in-process'),
  r('Depth sealed', 'Spectacle', 'Tithe', 'F014', 'in-process'),
  r('Potion drunk', 'Gear', 'Tithe', 'F013', 'in-process'),
  r('Ration eaten', 'Gear', 'Tithe', 'F013', 'in-process'),
];

/** Events, der ikke står i modellen, men som driften har brug for. */
export const TECHNICAL_EVENTS = {
  /** Hvert 30. sekund: skills, Echo og Marks undervejs, så de aldrig går tabt (Feature-016). */
  playerProgress: 'tithe.player-progress',
  /** Bruges kun af testen af bussen. */
  ping: 'platform.ping',
} as const;

/** De routing keys, en bounded context skal lytte på (kun bus-ruter). */
export function bindingsFor(context: string): string[] {
  return [...new Set(ROUTES.filter((x) => x.transport === 'bus' && x.to === context).map((x) => routingKey(x.from, x.event)))];
}
