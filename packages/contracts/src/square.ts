// Beskederne over WebSocket på Mustering Square (Feature-042): browseren sender retningen, serveren sender spillerne på
// pladsen 20 gange i sekundet.

export type SquareClientMessage = { t: 'input'; moveX: number; moveY: number };

export interface SquarePlayerView {
  id: string;
  name: string;
  character: string | null;
  x: number;
  y: number;
  facing: [number, number];
  you: boolean;
}

export type SquareServerMessage = { t: 'square'; players: SquarePlayerView[] } | { t: 'gone'; reason: string };
