'use client';

import Link from 'next/link';
export default function GlobalError() {
  return (
    <html>
      <body className="min-h-screen bg-slate-950 text-slate-50">
        <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-6 py-8 shadow-lg shadow-black/30">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              500 - Server Error
            </p>
            <h1 className="mt-2 text-2xl font-bold">서버 정비 중...</h1>
            <p className="mt-2 text-sm text-slate-300">
              잠시 후 다시 시도해주세요. 문제가 지속되면 관리자에게 문의해
              주세요.
            </p>
          </div>
          <Link
            href="/"
            className="text-sm text-sky-300 underline-offset-4 hover:underline"
          >
            홈으로 돌아가기
          </Link>
        </div>
      </body>
    </html>
  );
}
