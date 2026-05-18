/** Loading placeholder for the room-explorer date sections. */

export function Skeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i}>
          <div className="h-5 w-40 animate-pulse rounded bg-base-800" />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="aspect-[4/3] animate-pulse rounded-md bg-base-800/60" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
