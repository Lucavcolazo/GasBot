import { Skeleton } from "./Skeleton.tsx";

const CATEGORY_BAR_WIDTHS = [85, 60, 40];
const MONTH_BAR_HEIGHTS = [55, 80, 35, 65, 45, 90];

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-9 sm:w-36" />
      </div>

      <div className="grid grid-cols-1 gap-px border border-white/15 bg-white/15 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2 bg-black p-5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-24" />
          </div>
        ))}
      </div>

      <section className="panel">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-28" />
          </div>
          <Skeleton className="h-9 w-9 sm:w-32" />
        </div>
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="panel">
          <Skeleton className="mb-5 h-3 w-32" />
          <div className="flex h-64 flex-col justify-around">
            {CATEGORY_BAR_WIDTHS.map((w, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-3 w-16 shrink-0" />
                <Skeleton className="h-5" style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <Skeleton className="mb-5 h-3 w-28" />
          <div className="flex h-64 items-end gap-3">
            {MONTH_BAR_HEIGHTS.map((h, i) => (
              <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
            ))}
          </div>
        </section>
      </div>

      <section className="panel">
        <Skeleton className="mb-5 h-3 w-40" />
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-white/10 pb-4">
              <Skeleton className="h-3 w-10 shrink-0" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3 w-20 shrink-0" />
              <Skeleton className="h-3 w-16 shrink-0" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
