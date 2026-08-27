import { Skeleton } from '@/components/ui/Skeleton';

export default function ProductLoading() {
	return (
		<article className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr] lg:gap-10">
			<aside className="space-y-4">
				<Skeleton className="aspect-[4/3] w-full" />
				<Skeleton className="h-32 w-full" />
				<Skeleton className="h-40 w-full" />
			</aside>

			<section className="space-y-5">
				<div className="space-y-2">
					<Skeleton className="h-8 w-2/3" />
					<Skeleton className="h-4 w-full max-w-md" />
				</div>
				<div className="glass-panel space-y-5 p-6">
					<Skeleton className="h-11 w-full" />
					<Skeleton className="h-24 w-full" />
					<Skeleton className="h-16 w-full" />
				</div>
			</section>
		</article>
	);
}
