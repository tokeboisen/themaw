// UI-tekster, som featurene citerer. Webappen viser dem, og api'et svarer med dem, når en command afvises.

export const MESSAGES = {
  /** Feature-031 */
  userNameInvalid: 'Use 3–20 letters, digits or symbols, without spaces.',
  userNameTaken: 'This user name is taken.',
  passwordShort: 'The password must be at least 8 characters.',
  /** Feature-032 */
  wrongLogin: 'Wrong user name or password.',
  /** Feature-001 */
  placeAllPoints: 'Place all your points first.',
  /** Feature-007, -019, -024 */
  inventoryFull: 'Your inventory is full.',
  /** Feature-019, -020 */
  notEnoughGold: 'Not enough gold.',
  /** Feature-020 */
  cannotCarryMore: 'You cannot carry more.',
  /** Feature-036 */
  titheNameTaken: 'A Tithe with this name already exists.',
  /** Feature-025 */
  titheFull: 'The Tithe is full.',
  /** Feature-029 VIEW-01 */
  leaveConfirm: 'Leave the Tithe? You lose what you found, and it counts as a fall.',
  /** Feature-038, -026 og planen, afsnit 5: karakteren kan ikke ændres i Rim, mens den er i en lobby eller en Tithe. */
  inLobbyOrTithe: 'Not while you are in a lobby or a Tithe.',
  /** Feature-038 */
  deleteConfirm: (name: string) => `Delete ${name}? Everything ${name} owns is lost. This cannot be undone.`,
} as const;

/** Et afvist command: beskeden og, hvis den hører til et felt, feltets navn (Feature-031: fejl under feltet). */
export interface Refusal {
  message: string;
  field?: string;
}
