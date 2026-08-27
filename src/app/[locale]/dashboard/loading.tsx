import { Skeleton } from '@/components/ui/Skeleton';

export default function DashboardLoading() {
	return (
		<div className="space-y-8">
			<Skeleton className="h-9 w-56" />

			<div className="grid gap-4 sm:grid-cols-3">
				<Skeleton className="h-24 w-full" />
				<Skeleton className="h-24 w-full" />
				<Skeleton className="h-24 w-full" />
			</div>

			<Skeleton className="h-28 w-full" />
		</div>
	);
}
