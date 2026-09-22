"use client";

import { memo } from "react";

import { FeedbackNote } from "./FeedbackNote";
import { Feedback } from "@/types/feedback";

interface FeedbackNotesLayerProps {
	notes: Feedback[];
	onOpenNote: (feedback: Feedback) => void;
}

function FeedbackNotesLayerImpl({
	notes,
	onOpenNote,
}: FeedbackNotesLayerProps) {
	return (
		<div className="pointer-events-none absolute inset-0">
			<div className="pointer-events-auto relative h-full w-full">
				{notes.map((note) => (
					<FeedbackNote
						key={note.id}
						feedback={note}
						onOpen={onOpenNote}
					/>
				))}
			</div>
		</div>
	);
}

// Memoized so unrelated wall re-renders (e.g. dialog open/close state)
// don't re-render every note.
export const FeedbackNotesLayer = memo(FeedbackNotesLayerImpl);
