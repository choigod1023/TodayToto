import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-10 px-4 py-10">
        <header className="flex items-center justify-between border-b border-slate-800 pb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            SportsToto 분석 대시보드
          </h1>
          <span className="text-sm text-slate-400">
            백엔드: NestJS · 프론트: Next + Tailwind
          </span>
        </header>

        <section className="grid gap-6 sm:grid-cols-2">
          <Link
            href="/games"
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 transition hover:border-sky-500 hover:bg-slate-900"
          >
            <h2 className="mb-2 text-lg font-semibold">주요 경기 보기</h2>
            <p className="text-sm text-slate-400">
              Named 인기 경기 API에서 오늘/내일 주요 경기를 불러와 리스트로
              확인합니다.
            </p>
          </Link>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
            <h2 className="mb-2 text-lg font-semibold">기능 개요</h2>
            <ul className="space-y-1 text-sm text-slate-400">
              <li>· 승/무/패 · 언더/오버 · 핸디캡 배당 통합 조회</li>
              <li>· 커뮤니티 분석글 + 경기 전력 데이터 수집</li>
              <li>· Gemini를 통한 단일 추천 픽 + 확률 제공</li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
