// Webappens beslutninger uden DOM, så de kan testes i Node.

import { MESSAGES } from '@maw/contracts';

export type Screen = 'signin' | 'characters' | 'create' | 'rim';

/** Feature-026: efter sign-in vises Characters; en bruger uden karakterer går direkte til Create character. */
export function screenAfterSignIn(characterCount: number): Screen {
  return characterCount === 0 ? 'create' : 'characters';
}

/** Når siden genindlæses, mens brugeren er logget ind: tilbage i the Rim med den karakter, der spilles. */
export function screenOnReload(characterCount: number, activeCharacterId: string | null): Screen {
  if (characterCount === 0) return 'create';
  return activeCharacterId ? 'rim' : 'characters';
}

/** Feature-038 VIEW-01: teksten i bekræftelsen. */
export function deleteConfirmation(name: string): string {
  return MESSAGES.deleteConfirm(name);
}

/** Feature-004 VIEW-01: "A + button stands by each attribute and skill while there are points left." */
export function showPlus(points: number): boolean {
  return points > 0;
}
