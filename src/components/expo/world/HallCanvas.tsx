"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useState } from "react";
import HallScene from "./HallScene";
import StallInteractionOverlay from "../stalls/StallInteractionOverlay";

type ControlKey = "arrowup" | "arrowdown" | "a" | "d";

function MobileControl({
	label,
	icon,
	keyName,
}: {
	label: string;
	icon: string;
	keyName: ControlKey;
}) {
	const setPressed = (pressed: boolean) => {
		window.dispatchEvent(
			new CustomEvent("hall-mobile-control", {
				detail: { key: keyName, pressed },
			}),
		);
	};

	return (
		<button
			type="button"
			aria-label={label}
			className="pointer-events-auto flex h-14 w-14 touch-none select-none items-center justify-center rounded-2xl border border-white/25 bg-slate-950/75 text-2xl text-white shadow-lg backdrop-blur transition active:scale-95 active:bg-cyan-700/80 sm:h-16 sm:w-16"
			onPointerDown={(event) => {
				event.preventDefault();
				setPressed(true);
			}}
			onPointerUp={() => setPressed(false)}
			onPointerCancel={() => setPressed(false)}
			onPointerLeave={() => setPressed(false)}
		>
			<span aria-hidden="true">{icon}</span>
		</button>
	);
}

export default function HallCanvas() {
	const [isPortrait, setIsPortrait] = useState(false);

	useEffect(() => {
		const media = window.matchMedia("(orientation: portrait)");
		const updateOrientation = () => setIsPortrait(media.matches);
		updateOrientation();
		media.addEventListener("change", updateOrientation);
		return () => media.removeEventListener("change", updateOrientation);
	}, []);

	const requestLandscape = async () => {
		try {
			if (document.documentElement.requestFullscreen) {
				await document.documentElement.requestFullscreen();
			}
			const orientation = screen.orientation as ScreenOrientation & {
				lock?: (orientation: "landscape") => Promise<void>;
			};
			await orientation.lock?.("landscape");
		} catch {
			// Browsers only allow orientation locking after a user gesture.
			setIsPortrait(window.matchMedia("(orientation: portrait)").matches);
		}
	};

	return (
		<main className="relative h-[100dvh] min-h-[420px] w-full overflow-hidden bg-slate-950">
			<div className="pointer-events-none absolute left-3 top-3 z-10 max-w-[calc(100%-1.5rem)] rounded-xl border border-white/15 bg-slate-950/80 px-3 py-2 text-white shadow-lg backdrop-blur sm:left-4 sm:top-4 sm:px-4 sm:py-3">
				<p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
					OPEXN · Greybox
				</p>
				<h1 className="mt-1 text-lg font-bold sm:text-xl">
					Exhibition Hall
				</h1>
				<p className="mt-1 text-xs text-slate-300">
					60 m × 65 m · 43 stalls · double-click and drag to look
				</p>
			</div>

			<div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[calc(100%-1.5rem)] rounded-lg border border-white/10 bg-slate-950/80 px-3 py-2 text-xs text-slate-300 sm:bottom-4 sm:left-4">
				<span className="hidden lg:inline">
					Double-click to enable look mode, then drag · WASD / arrows
					to walk · Shift to run
				</span>
				<span className="lg:hidden">
					Drag to look · use the arrows to walk
				</span>
			</div>

			<div className="pointer-events-none absolute bottom-3 right-3 z-10 grid grid-cols-3 gap-2 sm:bottom-5 sm:right-5 lg:hidden">
				<span />
				<MobileControl
					label="Move forward"
					icon="↑"
					keyName="arrowup"
				/>
				<span />
				<MobileControl label="Move left" icon="←" keyName="a" />
				<MobileControl
					label="Move backward"
					icon="↓"
					keyName="arrowdown"
				/>
				<MobileControl label="Move right" icon="→" keyName="d" />
			</div>

			{isPortrait && (
				<div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/95 p-6 text-center text-white">
					<div className="max-w-sm rounded-2xl border border-cyan-300/30 bg-slate-900 p-6 shadow-2xl">
						<div className="mb-3 text-4xl" aria-hidden="true">
							↔
						</div>
						<h2 className="text-xl font-bold">
							Rotate your device
						</h2>
						<p className="mt-2 text-sm text-slate-300">
							This hall is designed for landscape mode. Rotate
							your device for the best view and controls.
						</p>
						<button
							type="button"
							className="mt-5 rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950"
							onClick={requestLandscape}
						>
							Switch to landscape
						</button>
					</div>
				</div>
			)}
			<StallInteractionOverlay />

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
				style={{ touchAction: "none" }}
			>
				<Suspense fallback={null}>
					<HallScene />
				</Suspense>
			</Canvas>
		</main>
	);
}
