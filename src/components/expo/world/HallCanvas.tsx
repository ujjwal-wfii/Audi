"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import HallScene from "./HallScene";
import Link from "next/link";
import { useStallMediaStore } from "../stalls/stallMediaStore";

export default function HallCanvas({ focusStallId }: { focusStallId?: string }) {
    const mediaByStall = useStallMediaStore((state) => state.mediaByStall);
	return (
		<main className="relative h-[100dvh] min-h-[520px] w-full overflow-hidden bg-slate-950">
			<div className="pointer-events-none absolute left-4 top-4 z-10 max-w-[calc(100%-12rem)] rounded-xl border border-white/15 bg-slate-950/80 px-4 py-3 text-white shadow-lg backdrop-blur">
				<p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
					OPEXN · Greybox
				</p>
				<h1 className="mt-1 text-lg font-bold sm:text-xl">
					Exhibition Hall
				</h1>
				<p className="mt-1 text-xs text-slate-300">
					60 m × 65 m · 43 stalls · click to look around
				</p>
			</div>

			<div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-xs text-slate-300">
				Click the hall to capture the mouse · WASD / arrows to walk ·
				Shift to run · Esc to release
			</div>

			<div className="absolute right-4 top-4 z-10 flex flex-col items-end gap-2">
                <Link href={focusStallId ? `/expo/stall-editor?stall=${encodeURIComponent(focusStallId)}` : "/expo/stall-editor"}
                    className="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg hover:bg-cyan-200">
                    {focusStallId ? "Back to edit" : "Edit a stall"}
                </Link>
                {focusStallId && <p className="rounded-lg bg-slate-950/80 px-3 py-2 text-sm text-white">Viewing stall {focusStallId}</p>}
            </div>
            <Canvas
				camera={{
					position: [43, 38, 48],
					fov: 48,
					near: 0.1,
					far: 250,
				}}
				dpr={[1, 1.5]}
				gl={{ antialias: true, powerPreference: "high-performance" }}
				shadows={false}
			>
				<Suspense fallback={null}>
					<HallScene mediaByStall={mediaByStall} focusStallId={focusStallId} />
				</Suspense>
			</Canvas>
		</main>
	);
}
