import { Skeleton } from '@/components/ui/Skeleton';

export default function OrdersLoading() {
	return (
		<div>
			<Skeleton className="h-9 w-48" />

			<div className="mt-6 space-y-2">
				{Array.from({ length: 4 }).map((_, i) => (
					<Skeleton key={i} className="h-14 w-full" />
				))}
			</div>
		</div>
	);
}
