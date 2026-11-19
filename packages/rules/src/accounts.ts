// Feature-031 Create user: brugernavn og password. Bruges af webappen (fejl under feltet) og af api'et.

/** 3–20 tegn: bogstaver, tal og tegn, uden mellemrum. */
const USER_NAME = /^[\p{L}\p{N}\p{P}\p{S}]{3,20}$/u;

export function isValidUserName(userName: string): boolean {
  return USER_NAME.test(userName ?? '');
}

/** Brugernavne er entydige uanset store og små bogstaver. */
export function userNameKey(userName: string): string {
  return userName.toLocaleLowerCase('en');
}

export const PASSWORD_MIN = 8;

export function isValidPassword(password: string): boolean {
  return [...(password ?? '')].length >= PASSWORD_MIN;
}
