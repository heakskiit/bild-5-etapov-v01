/**
 * Who may read a customer's game-account login on a booster job (FIX-JOB-017).
 *
 * Kept pure so the whole gate is unit-tested; the route only feeds it rows.
 * The rule set is deliberately narrow:
 *  - only a modder or an admin, never the customer view or a ghost;
 *  - a modder only on a job assigned to them, an admin on any job;
 *  - only while the job is in_progress. Before that nobody is working on it,
 *    after completion the trigger from 0001 has already wiped the secret.
 */

export type CredentialRevealInput = {
  role: string | null | undefined;
  userId: string;
  assignedModderId: string | null | undefined;
  status: string | null | undefined;
};

export type CredentialRevealDenial = 'forbidden' | 'not_in_progress';

export function credentialRevealDenial(input: CredentialRevealInput): CredentialRevealDenial | null {
  if (input.role !== 'admin' && input.role !== 'modder') return 'forbidden';
  if (input.role === 'modder' && (!input.assignedModderId || input.assignedModderId !== input.userId)) {
    return 'forbidden';
  }
  if (input.status !== 'in_progress') return 'not_in_progress';
  return null;
}

export type CredentialRow = {
  login_ciphertext: string | null;
  password_ciphertext: string | null;
  note_ciphertext: string | null;
  nullified_at: string | null;
};

/** What the stored row can still give the booster. */
export function credentialRowState(row: CredentialRow | null | undefined): 'missing' | 'wiped' | 'available' {
  if (!row) return 'missing';
  if (row.nullified_at || !row.login_ciphertext || !row.password_ciphertext) return 'wiped';
  return 'available';
}
