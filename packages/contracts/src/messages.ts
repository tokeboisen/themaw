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
  /** Feature-038 */
  deleteConfirm: (name: string) => `Delete ${name}? Everything ${name} owns is lost. This cannot be undone.`,
} as const;

/** Et afvist command: beskeden og, hvis den hører til et felt, feltets navn (Feature-031: fejl under feltet). */
export interface Refusal {
  message: string;
  field?: string;
}
