"use client";

import { Feedback } from "@/types/feedback";

interface FeedbackNoteProps {
	feedback: Feedback;
	onOpen: (feedback: Feedback) => void;
}

const TAPE_POSITION_CLASSES: Record<
	Feedback["visual"]["tapePosition"],
	string
> = {
	left: "left-3 -rotate-6",
	center: "left-1/2 -translate-x-1/2 rotate-1",
	right: "right-3 rotate-6",
};

/**
 * A single physical-looking sticky note.
 *
 * Consistent (never randomized): dimensions, font, text padding/alignment,
 * line spacing, structure.
 * Randomized (generated once, persisted): color, rotation, shadow
 * strength, tape position, wall position — all read from `feedback`,
 * never re-rolled here.
 */
export function FeedbackNote({ feedback, onOpen }: FeedbackNoteProps) {
	const { visual } = feedback;
	const shadowClass =
		visual.shadowStrength > 0.65
			? "shadow-note-lg"
			: visual.shadowStrength > 0.45
				? "shadow-note-md"
				: "shadow-note-sm";

	return (
		<button
			type="button"
			onClick={() => onOpen(feedback)}
			aria-label={`Feedback from ${feedback.userName ?? "a visitor"}: ${feedback.message}`}
			className={`group absolute w-[11%] min-w-[104px] max-w-[168px] aspect-square origin-center animate-pop-in cursor-pointer rounded-[2px] p-3 text-left transition-transform duration-150 ease-out hover:z-20 hover:scale-[1.06] focus-visible:z-20 focus-visible:scale-[1.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${shadowClass}`}
			style={
				{
					left: `${feedback.position.x * 100}%`,
					top: `${feedback.position.y * 100}%`,
					backgroundColor: visual.color,
					transform: `translate(-50%, -50%) rotate(${visual.rotation}deg)`,
					"--note-rotation": `${visual.rotation}deg`,
				} as React.CSSProperties
			}
		>
			<span className="note-paper-texture pointer-events-none absolute inset-0 rounded-[2px]" />

			{/* Tape */}
			<span
				className={`pointer-events-none absolute -top-2 h-5 w-10 border border-white/40 bg-white/60 shadow-sm ${TAPE_POSITION_CLASSES[visual.tapePosition]}`}
				style={{ backdropFilter: "blur(0.5px)" }}
				aria-hidden
			/>

			<span className="relative flex h-full w-full flex-col">
				<span className="line-clamp-4 flex-1 overflow-hidden font-handwriting text-[1.15rem] leading-[1.15] text-slate-800">
					{feedback.message}
				</span>
				<span className="mt-1 flex items-center justify-between text-[0.65rem] font-handwriting text-slate-700/80">
					<span className="flex items-center gap-1">
						<HeartIcon filled={feedback.likedByMe} />
						{feedback.likesCount}
					</span>
					{feedback.isOwner && <span className="italic">you</span>}
				</span>
			</span>
		</button>
	);
}

function HeartIcon({ filled }: { filled: boolean }) {
	return (
		<svg
			viewBox="0 0 24 24"
			className="h-3 w-3"
			fill={filled ? "currentColor" : "none"}
			stroke="currentColor"
			strokeWidth={2}
			aria-hidden
		>
			<path d="M12 21s-6.7-4.35-9.3-8.1C.7 10 1.4 6.4 4.6 5.1c2-.8 4 .1 5.4 2 .4.5.6.9 2 2.4 1.4-1.5 1.6-1.9 2-2.4 1.4-1.9 3.4-2.8 5.4-2 3.2 1.3 3.9 4.9 1.9 7.8C18.7 16.65 12 21 12 21z" />
		</svg>
	);
}
