// Hvilke Tithes kører i tithe-server, og hvilke spillere er stadig i dem. Lobbyen spørger, når den skal vide, om et navn
// er optaget (Feature-036: "open or running") og om en spiller stadig er i en Tithe (planen, afsnit 5). Det er en
// aflæsning, ikke et event: tithe-server kender svaret, og forsvinder en Tithe ved en genstart, er spillerne fri igen.

export interface RunningTithe {
  id: string;
  name: string;
  /** Spillerne, hvis del af Tithen ikke er slut endnu. */
  players: string[];
}

export interface TitheRegistry {
  /** null, når tithe-server ikke svarer; så rydder lobbyen intet op. */
  running(): Promise<RunningTithe[] | null>;
}

export function httpRegistry(baseUrl: string): TitheRegistry {
  return {
    async running() {
      try {
        const response = await fetch(`${baseUrl}/internal/tithes`, { signal: AbortSignal.timeout(1500) });
        if (!response.ok) return null;
        return ((await response.json()) as { tithes: RunningTithe[] }).tithes;
      } catch {
        return null;
      }
    },
  };
}

let current: TitheRegistry = httpRegistry(process.env.TITHE_SERVER_URL ?? 'http://tithe-server:3001');

/** buildApp sætter registret; testene giver et, de selv styrer. */
export function useRegistry(registry: TitheRegistry): void {
  current = registry;
}

export function registry(): TitheRegistry {
  return current;
}
