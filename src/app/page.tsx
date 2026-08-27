'use client';

import dynamic from 'next/dynamic';

const AuditoriumCanvas = dynamic(
  () => import('@/components/AuditoriumCanvas').then((mod) => mod.AuditoriumCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="w-screen h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-sky-400 border-t-transparent rounded-full animate-spin mb-4" />
        <div className="text-lg font-bold tracking-wide">Reaching the Auditorium</div>
        <div className="text-xs text-slate-400 mt-1">on your way</div>
      </div>
    ),
  }
);

export default function Home() {
  return (
    <main className="w-screen h-screen overflow-hidden bg-black">
      <AuditoriumCanvas />
    </main>
  );
}
