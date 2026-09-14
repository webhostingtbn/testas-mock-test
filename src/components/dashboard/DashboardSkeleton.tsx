import { KniShell } from "@/components/KniPrimitives";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface DashboardSkeletonProps {
  className?: string;
}

/**
 * Mirrors the shape of `DashboardView` so the real content can
 * progressively replace it without a layout pop:
 * left = hero banner + score-trend chart, right = proficiency radar.
 */
export function DashboardSkeleton({ className }: DashboardSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading dashboard"
      aria-busy="true"
      className={cn("mx-auto w-full animate-pulse", className)}
    >
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        {/* Left column */}
        <section className="flex min-w-0 flex-col gap-6">
          {/* Hero banner */}
          <div className="grid overflow-hidden rounded-[26px] bg-kni-soft sm:min-h-[250px] sm:grid-cols-[minmax(0,1fr)_250px]">
            <div className="relative z-10 p-6 sm:p-8 lg:p-10">
              <Skeleton className="h-9 w-3/4 rounded-xl bg-slate-200" />
              <Skeleton className="mt-3 h-4 w-full max-w-lg bg-slate-200/80" />
              <Skeleton className="mt-2 h-4 w-2/3 max-w-md bg-slate-200/60" />
              <div className="mt-6 flex flex-wrap gap-2">
                <Skeleton className="h-7 w-28 rounded-full bg-white" />
                <Skeleton className="h-7 w-24 rounded-full bg-white" />
              </div>
            </div>
            <div className="relative hidden min-h-44 overflow-hidden sm:block sm:min-h-full">
              <div className="absolute -bottom-20 right-0 size-64 rounded-full bg-orange-100/90" />
              <Skeleton className="absolute bottom-7 right-14 size-32 rounded-[34px]" />
            </div>
          </div>

          {/* Score trend card */}
          <div className="rounded-[18px] border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-2 h-6 w-44" />
              </div>
              <Skeleton className="h-8 w-40 rounded-xl" />
            </div>
            {/* Chart placeholder: axis lines + dots */}
            <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
              <div className="flex h-44 items-end justify-between gap-3 px-2">
                {[38, 55, 45, 68, 60, 78, 72].map((height, index) => (
                  <div
                    key={index}
                    aria-hidden="true"
                    className="w-full rounded-full bg-slate-200/70"
                    style={{ height: `${height * 1.8}px` }}
                  />
                ))}
              </div>
              <div className="mt-3 flex justify-between px-1">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          </div>
        </section>

        {/* Right column: radar card */}
        <aside className="flex min-w-0 flex-col gap-6">
          <div className="flex h-full flex-col rounded-[18px] border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Skeleton className="h-3 w-28" />
                <Skeleton className="mt-2 h-6 w-36" />
              </div>
              <Skeleton className="size-11 rounded-full" />
            </div>
            {/* Radar placeholder */}
            <div className="mt-5 grid aspect-[4/3] w-full place-items-center">
              <Skeleton className="size-44 rounded-full bg-slate-200/60" />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-4">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="flex flex-col gap-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-14" />
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
      <span className="sr-only">Loading dashboard content…</span>
    </div>
  );
}

/**
 * Full shell used while the dashboard session/profile is loading.
 * The sidebar + header render immediately (no data needed), only the
 * main content area shows the skeleton — no more full-screen spinner pop.
 */
export function DashboardLoadingShell() {
  return (
    <KniShell activeView="dashboard">
      <DashboardSkeleton />
    </KniShell>
  );
}
