export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-8">
        <div className="h-6 w-32 animate-pulse rounded bg-slate-800" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
            >
              <div className="mb-2 h-3 w-24 animate-pulse rounded bg-slate-800" />
              <div className="mb-2 h-4 w-40 animate-pulse rounded bg-slate-800" />
              <div className="h-3 w-28 animate-pulse rounded bg-slate-800" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
