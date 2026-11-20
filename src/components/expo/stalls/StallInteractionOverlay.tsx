
"use client";

import {
	interactionStore,
	useInteractionStore,
} from "@/lib/expo/stall-interactivity/interactionStore";

import {
	Info,
	PlayCircle,
	MessageCircle,
	CalendarDays,
	FileDown,
	Contact,
} from "lucide-react";

import { useEffect, useState } from "react";

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
	{ key: "details", label: "View details", icon: Info },
	{ key: "video", label: "Watch video", icon: PlayCircle },
	{ key: "chat", label: "Chat with exhibitor", icon: MessageCircle },
	{ key: "meeting", label: "Book a meeting", icon: CalendarDays },
	{ key: "brochure", label: "Download brochure", icon: FileDown },
	{ key: "contact", label: "Share my contact", icon: Contact },
];

type ActionOption = (typeof OPTIONS)[number];

/**
 * Circular liquid-glass action button.
 * Mounted outside the Three.js Canvas.
 */
function GlassActionButton({
	option,
	onClick,
	offset = "",
}: {
	option: ActionOption;
	onClick: () => void;
	offset?: string;
}) {
	const Icon = option.icon;

	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={option.label}
			className={`glass-control group ${offset}`}
		>
			{/* Main optical glass material */}
			<span className="glass-surface" />

			{/* Inner reflective glass edge */}
			<span className="glass-reflection" />

			{/* Moving light reflection */}
			<span className="glass-light" />

			{/* Additional subtle inner highlight */}
			<span className="glass-inner-glow" />

			{/* Icon */}
			<Icon
				size={25}
				strokeWidth={1.55}
				className="
					glass-icon
					relative z-10
					text-black
					drop-shadow-[0_1px_5px_rgba(255,255,255,0.35)]
				"
			/>

			{/* Label */}
			<span className="
				relative z-10
				text-[9px] lg:text-xs
				font-medium tracking-wide
				text-black
				text-center leading-tight
				px-1
				drop-shadow-[0_1px_5px_rgba(0,0,0,0.8)]
			">
				{option.label}
			</span>
		</button>
	);
}

/** Mount outside <Canvas>, inside the same relatively-positioned wrapper as the hall. */
export default function StallInteractionOverlay() {
	const stall = useInteractionStore((s) => s.activeStall);
	const open = useInteractionStore((s) => s.panelOpen);

	const [message, setMessage] = useState<{
		text: string;
		stallId: string;
	} | null>(null);
	const [actionsVisible, setActionsVisible] = useState(true);

	// E opens / closes the interaction panel.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const t = e.target as HTMLElement | null;

			if (
				t &&
				(
					t.tagName === "INPUT" ||
					t.tagName === "TEXTAREA" ||
					t.isContentEditable
				)
			) {
				return;
			}

			if (e.key.toLowerCase() === "e") {
				const { panelOpen } = interactionStore.getState();

				if (panelOpen) {
					setMessage(null);
					interactionStore.closePanel();
				} else {
					setMessage(null);
					setActionsVisible(true);
					openPanel();
				}
			}

			if (e.key === "Escape") {
				setMessage(null);
				interactionStore.closePanel();
			}
		};

		window.addEventListener("keydown", onKey);

		return () => window.removeEventListener("keydown", onKey);
	}, []);

	if (!stall) return null;

	const info = mockExhibitor(stall.id, stall.type);

	// Closed interaction prompt.
	if (!open) {
		return (
			<button
				onClick={() => {
					setMessage(null);
					setActionsVisible(true);
					openPanel();
				}}
				className="
					absolute z-20
					left-1/2 -translate-x-1/2
					bottom-[calc(9rem+env(safe-area-inset-bottom))]
					lg:bottom-[72px]

					px-[18px] py-[10px]

					rounded-2xl
					border border-white/20

					bg-slate-950/50
					backdrop-blur-2xl

					text-white text-[15px]
					shadow-[0_8px_30px_rgba(0,0,0,0.25)]

					hover:border-cyan-200/50
					hover:bg-slate-900/65
					transition-all duration-300
				"
			>
				<strong>{stall.id}</strong> · {info.company} —{" "}
				<span className="lg:hidden">Tap to interact</span>
				<span className="hidden lg:inline">
					Press <kbd>E</kbd> or tap to interact
				</span>
			</button>
		);
	}

	const handleAction = (label: string) => {
		setMessage({
			text: `Mock: "${label}" for ${stall.id}`,
			stallId: stall.id,
		});
	};

	return (
		<>
			<style jsx global>{`
				/* ========================================
				   OPEXN - LIQUID GLASS ACTION CONTROLS
				======================================== */

				.glass-control {
					position: relative;
					isolation: isolate;
					overflow: hidden;

					width: 138px;
					height: 58px;

					border-radius: 10px 0 0 10px;
					display: flex;
					flex-direction: row;
					align-items: center;
					justify-content: center;
					gap: 8px;
					padding: 0 18px 0 12px;

					color: #0f172a;
					cursor: pointer;
					user-select: none;
					clip-path: polygon(
						0 0,
						100% 0,
						calc(100% - 14px) 50%,
						100% 100%,
						0 100%
					);

					background: rgba(255, 255, 255, 0.62);

					border: 1px solid rgba(255, 255, 255, 0.27);

					backdrop-filter: blur(18px) saturate(175%);
					-webkit-backdrop-filter: blur(18px) saturate(175%);

					box-shadow:
						0 8px 30px rgba(0, 0, 0, 0.18),
						inset 0 1px 2px rgba(255, 255, 255, 0.38),
						inset 0 -2px 5px rgba(255, 255, 255, 0.06);

					transition:
						transform 350ms cubic-bezier(0.2, 0.8, 0.2, 1),
						border-color 300ms ease,
						box-shadow 300ms ease,
						background 300ms ease;
				}

				.glass-center-card {
					position: relative;
					isolation: isolate;
					overflow: hidden;
					background: rgba(255, 255, 255, 0.68);
					border: 1px solid rgba(255, 255, 255, 0.7);
					color: #0f172a;
					box-shadow:
						0 8px 30px rgba(0, 0, 0, 0.18),
						inset 0 1px 2px rgba(255, 255, 255, 0.5);
					backdrop-filter: blur(18px) saturate(175%);
					-webkit-backdrop-filter: blur(18px) saturate(175%);
					clip-path: polygon(
						0 0,
						100% 0,
						calc(100% - 14px) 50%,
						100% 100%,
						0 100%
					);
					cursor: pointer;
				}

				.glass-center-card:hover {
					background: rgba(255, 255, 255, 0.82);
					box-shadow:
						0 12px 35px rgba(0, 0, 0, 0.22),
						0 0 22px rgba(103, 232, 249, 0.12),
						inset 0 1px 3px rgba(255, 255, 255, 0.6);
				}

				@media (min-width: 1024px) {
					.glass-control {
						width: 190px;
						height: 76px;
						gap: 12px;
					}
				}

				@media (min-width: 1280px) {
					.glass-control {
						width: 220px;
						height: 84px;
					}
				}

				/* Layered optical glass surface */
				.glass-surface {
					position: absolute;
					inset: 0;
					z-index: 0;

					border-radius: inherit;

					background:
						radial-gradient(
							circle at 28% 15%,
							rgba(255, 255, 255, 0.28),
							transparent 42%
						),
						radial-gradient(
							circle at 80% 90%,
							rgba(56, 189, 248, 0.13),
							transparent 48%
						),
						linear-gradient(
							145deg,
							rgba(255, 255, 255, 0.32),
							rgba(255, 255, 255, 0.08) 55%,
							rgba(125, 211, 252, 0.16)
						);

					pointer-events: none;
				}

				/* Reflective glass edge */
				.glass-reflection {
					position: absolute;
					inset: 1px;
					z-index: 1;

					border-radius: inherit;

					border: 1px solid rgba(255, 255, 255, 0.16);

					background:
						linear-gradient(
							135deg,
							rgba(255, 255, 255, 0.20),
							transparent 25%,
							transparent 75%,
							rgba(255, 255, 255, 0.08)
						);

					pointer-events: none;
				}

				/* Moving reflective highlight */
				.glass-light {
					position: absolute;
					top: -45%;
					left: -70%;

					width: 65%;
					height: 190%;

					z-index: 2;

					transform: rotate(32deg);

					background: linear-gradient(
						90deg,
						transparent,
						rgba(255, 255, 255, 0.20),
						rgba(255, 255, 255, 0.06),
						transparent
					);

					filter: blur(5px);
					opacity: 0;

					transition:
						left 650ms cubic-bezier(0.2, 0.7, 0.3, 1),
						opacity 300ms ease;

					pointer-events: none;
				}

				/* Inner glass glow */
				.glass-inner-glow {
					position: absolute;
					inset: 0;
					z-index: 1;

					border-radius: inherit;

					background: radial-gradient(
						circle at 50% 0%,
						rgba(255, 255, 255, 0.16),
						transparent 65%
					);

					opacity: 0.65;
					transition: opacity 300ms ease;

					pointer-events: none;
				}

				/* Hover: glass catches light */
				.glass-control:hover {
					transform: translateY(-3px) scale(1.025);

					border-color: rgba(255, 255, 255, 0.52);

					background: rgba(255, 255, 255, 0.78);

					box-shadow:
						0 12px 35px rgba(0, 0, 0, 0.22),
						0 0 22px rgba(103, 232, 249, 0.12),
						inset 0 1px 3px rgba(255, 255, 255, 0.48),
						inset 0 -2px 8px rgba(255, 255, 255, 0.08);
				}

				.glass-control:hover .glass-light {
					left: 115%;
					opacity: 1;
				}

				.glass-control:hover .glass-inner-glow {
					opacity: 1;
				}

				.glass-control:hover .glass-icon {
					color: #000;
					filter: drop-shadow(
						0 0 9px rgba(255, 255, 255, 0.8)
					);
				}

				/* Gel-like press */
				.glass-control:active {
					transform: scale(0.91, 0.95);

					transition:
						transform 100ms cubic-bezier(0.3, 0, 0.7, 1);

					background: rgba(255, 255, 255, 0.9);

					box-shadow:
						0 2px 12px rgba(0, 0, 0, 0.2),
						inset 0 2px 8px rgba(255, 255, 255, 0.24);
				}

				.glass-control:focus-visible {
					outline: 2px solid rgba(103, 232, 249, 0.8);
					outline-offset: 4px;
				}

				@media (prefers-reduced-motion: reduce) {
					.glass-control,
					.glass-light,
					.glass-inner-glow {
						transition: none;
					}
				}

				@media (orientation: portrait) {
					.stall-action-controls {
						display: none;
					}
				}
			`}</style>

			<div className="
				fixed inset-0 z-[100]
				flex items-center justify-center
				pointer-events-none
			">
				<div className="relative w-full h-full">

					{/* LEFT ACTION BUTTONS */}
					<div className="
						stall-action-controls
						absolute left-[3vw] top-[12%]
						xl:left-[5vw]
						lg:top-1/2 lg:-translate-y-1/2

						flex flex-col items-center
						gap-2 lg:gap-8 xl:gap-10
					">
						{actionsVisible &&
							OPTIONS.slice(0, 3).map((option, i) => (
							<GlassActionButton
								key={option.key}
								option={option}
								onClick={() => handleAction(option.label)}
								offset={
									i === 0 || i === 2
										? "translate-x-10"
										: ""
								}
							/>
							))}
					</div>

					{/* CENTER EXHIBITOR CARD */}
					<div
						className="
						glass-center-card
						absolute left-1/2 top-[44%]
						-translate-x-1/2 -translate-y-1/2

						pointer-events-auto

						w-[175px] lg:w-[190px]
						rounded-xl px-4 py-4

						text-center
					"
						onClick={() => setActionsVisible((visible) => !visible)}
						role="button"
						tabIndex={0}
						onKeyDown={(event) => {
							if (event.key === "Enter" || event.key === " ") {
								event.preventDefault();
								setActionsVisible((visible) => !visible);
							}
						}}
					>
						{/* Close */}
						<button
							onClick={(event) => {
								event.stopPropagation();
								setMessage(null);
								setActionsVisible(false);
								interactionStore.closePanel();
							}}
							aria-label="Close"
							className="
								absolute top-2 right-3
								text-base text-slate-800
								hover:text-black
								transition-colors
							"
						>
							×
						</button>

						{/* Company */}
						<h2 className="
							text-base font-extrabold text-slate-950
							mt-2 leading-tight
						">
							{info.company}
						</h2>

						<p className="mt-1 text-[10px] text-slate-700">
							{info.tagline}
						</p>
						{message?.stallId === stall.id && (
							<p className="mt-3 text-[10px] text-cyan-800">
								{message.text}
							</p>
						)}

						{/* Footer */}
						<p className="mt-3 text-[9px] text-slate-700">
							<span className="lg:hidden">
								Tap × to close
							</span>

							<span className="hidden lg:inline">
								Press E to close
							</span>
						</p>
					</div>

					{/* RIGHT ACTION BUTTONS */}
					<div className="
						stall-action-controls
						absolute right-[3vw] top-[12%]
						xl:right-[5vw]
						lg:top-1/2 lg:-translate-y-1/2

						flex flex-col items-center
						gap-2 lg:gap-8 xl:gap-10
					">
						{actionsVisible &&
							OPTIONS.slice(3, 6).map((option, i) => (
							<GlassActionButton
								key={option.key}
								option={option}
								onClick={() => handleAction(option.label)}
								offset={
									i === 0 || i === 2
										? "-translate-x-10"
										: ""
								}
							/>
							))}
					</div>

					{/* ACTION FEEDBACK */}
					{message && (
						<div
							role="status"
							className="
								absolute bottom-[8%] left-1/2
								-translate-x-1/2

								pointer-events-auto

								px-5 py-3 rounded-xl

								bg-slate-950/55
								border border-white/20

								backdrop-blur-2xl

								text-sm text-cyan-100

								shadow-[0_8px_30px_rgba(0,0,0,0.3)]
							">
								{message.text}
							</div>
						)}
				</div>
			</div>
		</>
	);
}

function openPanel() {
	interactionStore.openPanel();
}

