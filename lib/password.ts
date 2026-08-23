/** The only password rule Weship enforces. Stated up front rather than after a failed submit. */
export const MIN_PASSWORD_LENGTH = 6;

export const PASSWORD_HINT = `At least ${MIN_PASSWORD_LENGTH} characters.`;

export const passwordProblem = (password: string): string | undefined =>
  password.length >= MIN_PASSWORD_LENGTH
    ? undefined
    : `Your password needs at least ${MIN_PASSWORD_LENGTH} characters.`;
