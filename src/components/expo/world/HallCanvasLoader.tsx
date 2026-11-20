"use client";

import dynamic from "next/dynamic";

const HallCanvas = dynamic(() => import("./HallCanvas"), {
	ssr: false,
	loading: () => (
		<main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
			<div className="text-center">
				<div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-slate-600 border-t-cyan-400" />
				<p className="text-sm text-slate-300">
					Loading OPEXN exhibition hall…
				</p>
			</div>
		</main>
	),
});

export default function HallCanvasLoader() {
	return <HallCanvas />;
}
