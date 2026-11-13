"use client";

import {
	interactionStore,
	useInteractionStore,
} from "@/lib/expo/stall-interactivity/interactionStore";
import { useEffect, useState, type CSSProperties } from "react";

/** Mock exhibitor data. Replace with a real fetch keyed by stall id later. */
const MOCK_COMPANIES = [
	"Northwind Labs",
	"Helio Robotics",
	"Cedar & Pine",
	"Quanta Health",
	"Brightwave Media",
	"Atlas Mobility",
];
function mockExhibitor(id: string, type: string) {
	const n = [...id].reduce((sum, c) => sum + c.charCodeAt(0), 0);
	return {
		company: MOCK_COMPANIES[n % MOCK_COMPANIES.length],
		tagline: `Visit us at stall ${id} (${type})`,
	};
}

const OPTIONS = [
	{ key: "details", label: "View details" },
	{ key: "video", label: "Watch video" },
	{ key: "chat", label: "Chat with exhibitor" },
	{ key: "meeting", label: "Book a meeting" },
	{ key: "brochure", label: "Download brochure" },
	{ key: "contact", label: "Share my contact" },
];

const card: CSSProperties = {
	position: "absolute",
	zIndex: 20,
	color: "#fff",
	background:
		"linear-gradient(145deg, rgba(20,29,52,0.97), rgba(8,15,31,0.95))",
	border: "1px solid rgba(148,163,184,0.24)",
	borderRadius: 20,
	fontFamily: "inherit",
	boxShadow: "0 24px 60px rgba(0,0,0,0.42)",
	backdropFilter: "blur(18px)",
};

/** Mount outside <Canvas>, inside the same relatively-positioned wrapper as the hall. */
export default function StallInteractionOverlay() {
	const stall = useInteractionStore((s) => s.activeStall);
	const open = useInteractionStore((s) => s.panelOpen);
	const [message, setMessage] = useState<string | null>(null);

	// E opens / closes the panel.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const t = e.target as HTMLElement | null;
			if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA"))
				return;
			if (e.key.toLowerCase() === "e") {
				const { panelOpen } = interactionStore.getState();
				panelOpen ? interactionStore.closePanel() : openPanel();
			}
			if (e.key === "Escape") interactionStore.closePanel();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	// reset the mock feedback line whenever the panel closes or the stall changes
	useEffect(() => setMessage(null), [open, stall?.id]);

	if (!stall) return null;
	const info = mockExhibitor(stall.id, stall.type);

	if (!open) {
		return (
			<button
				onClick={openPanel}
				style={{
					...card,
					left: "50%",
					bottom: 72,
					transform: "translateX(-50%)",
					padding: "10px 18px",
					cursor: "pointer",
					fontSize: 15,
				}}
			>
				<strong>{stall.id}</strong> · {info.company} — Press{" "}
				<kbd>E</kbd> or tap to interact
			</button>
		);
	}

	return (
		<div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
			<div className="relative w-full h-full">
				{/* LEFT ACTION BUTTONS */}
				<div
					className="absolute left-[3vw] xl:left-[5vw] top-1/2 -translate-y-1/2
      flex flex-col items-center gap-8 lg:gap-10"
				>
					{OPTIONS.slice(0, 3).map((o, i) => (
						<button
							key={o.key}
							onClick={() =>
								setMessage(`Mock: "${o.label}" for ${stall.id}`)
							}
							className={`
            pointer-events-auto
            w-28 h-28 lg:w-32 lg:h-32
            rounded-[28px]
            flex items-center justify-center
            text-center text-sm font-bold text-white
            px-3
            bg-gradient-to-br from-slate-800 to-slate-950
            border border-cyan-400/50
            shadow-[0_8px_30px_rgba(0,0,0,0.35)]
            hover:border-cyan-300
            hover:shadow-[0_0_30px_rgba(34,211,238,0.3)]
            hover:scale-105
            transition-all duration-300
            ${i === 0 ? "translate-x-10" : ""}
            ${i === 2 ? "translate-x-10" : ""}
          `}
						>
							{o.label}
						</button>
					))}
				</div>

				{/* COMPACT CENTER EXHIBITOR CARD */}
				<div
					className="
  absolute left-1/2 top-[44%]
  -translate-x-1/2 -translate-y-1/2
  pointer-events-auto

  w-[175px] lg:w-[190px]
  rounded-xl
  px-4 py-4

  text-center text-white
  bg-gradient-to-br from-slate-900/95 to-slate-950/95
  border border-cyan-400/40

  shadow-[0_0_20px_rgba(34,211,238,0.12)]
  backdrop-blur-lg
"
				>
					{/* Close */}
					<button
						onClick={() => interactionStore.closePanel()}
						aria-label="Close"
						className="
      absolute top-2 right-3
      text-base text-slate-400
      hover:text-white transition-colors
    "
					>
						×
					</button>
					{/* Company */}
					<h2 className="text-base font-extrabold mt-2 leading-tight">
						{info.company}
					</h2>

					<p className="text-[10px] text-slate-400 mt-1">
						{info.tagline}
					</p>

					{/* Compact Logo */}

					{/* Footer */}
					<p className="text-[9px] text-slate-400 mt-3">
						Press E to close
					</p>
				</div>

				{/* RIGHT ACTION BUTTONS */}
				<div
					className="absolute right-[3vw] xl:right-[5vw] top-1/2 -translate-y-1/2
      flex flex-col items-center gap-8 lg:gap-10"
				>
					{OPTIONS.slice(3, 6).map((o, i) => (
						<button
							key={o.key}
							onClick={() =>
								setMessage(`Mock: "${o.label}" for ${stall.id}`)
							}
							className={`
            pointer-events-auto
            w-28 h-28 lg:w-32 lg:h-32
            rounded-[28px]
            flex items-center justify-center
            text-center text-sm font-bold text-white
            px-3
            bg-gradient-to-br from-slate-800 to-slate-950
            border border-cyan-400/50
            shadow-[0_8px_30px_rgba(0,0,0,0.35)]
            hover:border-cyan-300
            hover:shadow-[0_0_30px_rgba(34,211,238,0.3)]
            hover:scale-105
            transition-all duration-300
            ${i === 0 ? "-translate-x-10" : ""}
            ${i === 2 ? "-translate-x-10" : ""}
          `}
						>
							{o.label}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}

function openPanel() {
	interactionStore.openPanel();
}
