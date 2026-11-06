import { Skeleton } from "@/components/ui/skeleton";

export function TaskContentSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8" aria-busy="true">
      <Skeleton className="h-10 w-3/4 rounded-lg" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
      <div className="space-y-4 pt-8">
        <div className="h-px bg-border" />
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function TaskSidebarSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true">
      <div className="space-y-4">
        <Skeleton className="h-3 w-1/3" />
        <div className="space-y-4">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-2 w-1/4" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
      <hr className="border-border" />
      <div className="space-y-4">
        <Skeleton className="h-3 w-1/3" />
        <div className="space-y-3">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-2 w-1/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
