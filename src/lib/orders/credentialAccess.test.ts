import { describe, expect, it } from 'vitest';
import { credentialRevealDenial, credentialRowState } from './credentialAccess';

const base = { role: 'modder', userId: 'u1', assignedModderId: 'u1', status: 'in_progress' };

describe('credentialRevealDenial (FIX-JOB-017)', () => {
	it('lets the assigned modder read an in-progress job', () => {
		expect(credentialRevealDenial(base)).toBeNull();
	});

	it('refuses a modder on someone else\'s job', () => {
		expect(credentialRevealDenial({ ...base, assignedModderId: 'u2' })).toBe('forbidden');
	});

	it('refuses a modder on an unclaimed job', () => {
		expect(credentialRevealDenial({ ...base, assignedModderId: null })).toBe('forbidden');
	});

	it('lets an admin read any in-progress job, assigned or not', () => {
		expect(credentialRevealDenial({ ...base, role: 'admin', assignedModderId: 'u2' })).toBeNull();
		expect(credentialRevealDenial({ ...base, role: 'admin', assignedModderId: null })).toBeNull();
	});

	it.each(['ghost', '', null, undefined, 'ADMIN'])('refuses role %s', (role) => {
		expect(credentialRevealDenial({ ...base, role })).toBe('forbidden');
	});

	it.each(['awaiting_payment', 'action_required', 'completed', null])('refuses status %s', (status) => {
		expect(credentialRevealDenial({ ...base, status })).toBe('not_in_progress');
		expect(credentialRevealDenial({ ...base, role: 'admin', status })).toBe('not_in_progress');
	});

	it('checks ownership before status, so a stranger learns nothing about the job', () => {
		expect(credentialRevealDenial({ ...base, assignedModderId: 'u2', status: 'completed' })).toBe('forbidden');
	});
});

describe('credentialRowState (FIX-JOB-017)', () => {
	const row = { login_ciphertext: 'v1.a', password_ciphertext: 'v1.b', note_ciphertext: null, nullified_at: null };

	it('reports a row that was never submitted', () => {
		expect(credentialRowState(null)).toBe('missing');
		expect(credentialRowState(undefined)).toBe('missing');
	});

	it('reports a row wiped on completion', () => {
		expect(credentialRowState({ ...row, login_ciphertext: null, password_ciphertext: null, nullified_at: '2026-10-04T05:20:00Z' })).toBe('wiped');
	});

	it('treats a half-empty row as wiped rather than decrypting null', () => {
		expect(credentialRowState({ ...row, password_ciphertext: null })).toBe('wiped');
	});

	it('reports a usable row, the 2FA note being optional', () => {
		expect(credentialRowState(row)).toBe('available');
	});
});
