export type PasswordFlow = 'invite' | 'recovery';

export function passwordFlow(value: string | null): PasswordFlow | null {
  return value === 'invite' || value === 'recovery' ? value : null;
}

// Exact stable origins only. Temporary previews must not initiate real email.
export function passwordRecoveryRedirect(origin: string): string {
  if (origin === 'https://beta.roadshowdriver.com') {
    return 'https://beta.roadshowdriver.com/update-password';
  }
  if (origin === 'https://roadshowdriver.com' || origin === 'https://www.roadshowdriver.com') {
    return 'https://www.roadshowdriver.com/update-password';
  }
  throw new Error('Password recovery is available only on the stable Roadshow Driver site.');
}
