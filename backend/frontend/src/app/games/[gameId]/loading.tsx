export default function GameDetailLoading() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-4 py-8">
        <header className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="space-y-2">
            <div className="h-6 w-48 animate-pulse rounded bg-slate-800" />
            <div className="h-4 w-32 animate-pulse rounded bg-slate-800" />
          </div>
          <div className="h-4 w-16 animate-pulse rounded bg-slate-800" />
        </header>

        <section className="grid gap-6 lg:grid-cols-[2fr,1.3fr]">
          {/* 좌측: 배당/전력 로딩 */}
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="mb-4 h-5 w-24 animate-pulse rounded bg-slate-800" />
              <div className="space-y-3">
                <div className="h-16 w-full animate-pulse rounded bg-slate-800" />
                <div className="h-16 w-full animate-pulse rounded bg-slate-800" />
                <div className="h-16 w-full animate-pulse rounded bg-slate-800" />
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="mb-4 h-5 w-32 animate-pulse rounded bg-slate-800" />
              <div className="space-y-2">
                <div className="h-12 w-full animate-pulse rounded bg-slate-800" />
                <div className="h-12 w-full animate-pulse rounded bg-slate-800" />
                <div className="h-12 w-full animate-pulse rounded bg-slate-800" />
              </div>
            </div>
          </div>

          {/* 우측: Gemini 분석 로딩 */}
          <div className="space-y-4">
            <div className="rounded-xl border border-sky-700 bg-slate-900/80 p-4">
              <div className="mb-3 h-5 w-32 animate-pulse rounded bg-slate-800" />
              <div className="space-y-2">
                <div className="h-8 w-full animate-pulse rounded bg-slate-800" />
                <div className="h-16 w-full animate-pulse rounded bg-slate-800" />
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="mb-3 h-5 w-24 animate-pulse rounded bg-slate-800" />
              <div className="space-y-2">
                <div className="h-20 w-full animate-pulse rounded bg-slate-800" />
                <div className="h-20 w-full animate-pulse rounded bg-slate-800" />
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 py-8">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
              <span className="text-sm text-slate-400">
                Gemini 분석 중...
              </span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}


