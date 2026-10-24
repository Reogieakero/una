export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden>
      <div className="h-4 w-36 rounded-full bg-ink/10" />
      <div className="h-8 w-56 rounded-lg bg-ink/10" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg bg-ink/10" />
        ))}
      </div>
      <div className="h-72 rounded-lg bg-ink/10" />
    </div>
  );
}
