'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChipGroup, type ChipOption } from '@/components/ui/Chip';
import { dig, type Dict } from '@/lib/i18n/pick';

type Role = 'ghost' | 'modder' | 'admin';

interface ProfileRow {
	id: string;
	email: string | null;
	role: Role;
	created_at: string;
}

const ROLE_OPTIONS: ChipOption<Role>[] = [
	{ value: 'ghost', label: 'Ghost' },
	{ value: 'modder', label: 'Modder' },
	{ value: 'admin', label: 'Admin' },
];

export function AdminRoleTable({ profiles, messages }: { profiles: ProfileRow[]; messages: Dict }) {
	const t = useMemo(() => (key: string, vars?: Record<string, string | number>) => dig(messages, key, vars), [messages]);
	const router = useRouter();
	const [pending, setPending] = useState<string | null>(null);
	const [errorId, setErrorId] = useState<string | null>(null);

	const setRole = async (userId: string, role: Role) => {
		setPending(userId);
		setErrorId(null);
		try {
			const res = await fetch('/api/dashboard/admin/role', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ userId, role }),
			});
			if (!res.ok) {
				setErrorId(userId);
				return;
			}
			router.refresh();
		} catch {
			setErrorId(userId);
		} finally {
			setPending(null);
		}
	};

	if (profiles.length === 0) {
		return <p className="text-sm text-ink-soft">{t('admin.rolesEmpty')}</p>;
	}

	return (
		<div className="space-y-2">
			{profiles.map((profile) => (
				<div key={profile.id} className="glass-panel flex flex-wrap items-center justify-between gap-3 p-4">
					<div>
						<p className="text-sm text-ink">{profile.email ?? profile.id}</p>
						<p className="font-mono text-xs text-white/40">{profile.id}</p>
					</div>
					<div className="flex items-center gap-2">
						<ChipGroup
							label={t('admin.roleFor', { user: profile.email ?? profile.id })}
							options={ROLE_OPTIONS}
							value={profile.role}
							onChange={(role) => setRole(profile.id, role)}
						/>
						{pending === profile.id && <span className="text-xs text-white/40">{t('common.saving')}</span>}
						{errorId === profile.id && <span className="text-xs text-pink-400">{t('admin.roleError')}</span>}
					</div>
				</div>
			))}
		</div>
	);
}
