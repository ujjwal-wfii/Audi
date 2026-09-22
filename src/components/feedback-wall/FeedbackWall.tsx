"use client";

import { useCallback, useEffect, useState } from "react";

import { WallBackground } from "./WallBackground";
import { FeedbackNotesLayer } from "./FeedbackNotesLayer";
import { FeedbackForm } from "./FeedbackForm";
import { FeedbackDialog } from "./FeedbackDialog";
import {
	DEFAULT_MAX_MESSAGE_LENGTH,
	Feedback,
	FeedbackWallConfig,
} from "@/types/feedback";
import {
	createFeedback,
	deleteFeedback,
	FeedbackApiError,
	fetchFeedback,
	toggleVote,
	updateFeedback,
} from "@/lib/feedback/feedback.service";

export function FeedbackWall({
	wallImage,
	maxMessageLength = DEFAULT_MAX_MESSAGE_LENGTH,
	allowLikes = true,
}: FeedbackWallConfig) {
	const [notes, setNotes] = useState<Feedback[]>([]);
	const [loading, setLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);

	const [formOpen, setFormOpen] = useState(false);
	const [formSubmitting, setFormSubmitting] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
	const activeNote = notes.find((n) => n.id === activeNoteId) ?? null;

	const loadNotes = useCallback(async () => {
		setLoading(true);
		setLoadError(null);
		try {
			const data = await fetchFeedback();
			setNotes(data);
		} catch (err) {
			setLoadError(
				err instanceof FeedbackApiError
					? err.message
					: "Could not load the wall.",
			);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadNotes();
	}, [loadNotes]);

	async function handleCreate(message: string) {
		setFormSubmitting(true);
		setFormError(null);
		try {
			const created = await createFeedback({ message });
			setNotes((prev) => [...prev, created]);
			setFormOpen(false);
		} catch (err) {
			setFormError(
				err instanceof FeedbackApiError
					? err.message
					: "Could not post your feedback.",
			);
		} finally {
			setFormSubmitting(false);
		}
	}

	async function handleToggleLike(id: string) {
		const target = notes.find((n) => n.id === id);
		if (!target) return;

		// Optimistic update — reconciled with the server response below.
		const optimisticLiked = !target.likedByMe;
		const optimisticCount = target.likesCount + (optimisticLiked ? 1 : -1);
		setNotes((prev) =>
			prev.map((n) =>
				n.id === id
					? {
							...n,
							likedByMe: optimisticLiked,
							likesCount: optimisticCount,
						}
					: n,
			),
		);

		try {
			const result = await toggleVote(id);
			setNotes((prev) =>
				prev.map((n) =>
					n.id === id
						? {
								...n,
								likesCount: result.likesCount,
								likedByMe: result.likedByMe,
							}
						: n,
				),
			);
		} catch (err) {
			// Roll back on failure.
			setNotes((prev) =>
				prev.map((n) =>
					n.id === id
						? {
								...n,
								likedByMe: target.likedByMe,
								likesCount: target.likesCount,
							}
						: n,
				),
			);
			throw err;
		}
	}

	async function handleEditNote(id: string, message: string) {
		const updated = await updateFeedback(id, { message });
		setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)));
	}

	async function handleDeleteNote(id: string) {
		await deleteFeedback(id);
		setNotes((prev) => prev.filter((n) => n.id !== id));
	}

	return (
		<section className="mx-auto w-full max-w-6xl px-4">
			<div className="overflow-hidden rounded-2xl bg-white shadow-note-md">
				<div className="wall-scrollbar overflow-x-auto">
					<div className="min-w-[640px]">
						{loading ? (
							<div className="flex aspect-[16/9] w-full items-center justify-center text-slate-400">
								Loading wall…
							</div>
						) : loadError ? (
							<div className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-3 text-slate-500">
								<p>{loadError}</p>
								<button
									type="button"
									onClick={loadNotes}
									className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium transition hover:bg-stone-100"
								>
									Try again
								</button>
							</div>
						) : (
							<WallBackground wallImage={wallImage}>
								<FeedbackNotesLayer
									notes={notes}
									onOpenNote={(n) => setActiveNoteId(n.id)}
								/>
							</WallBackground>
						)}
					</div>
				</div>

				<div className="flex items-center justify-between gap-4 border-t border-stone-100 bg-stone-50 px-5 py-4">
					<p className="text-sm text-slate-500">
						{notes.length} {notes.length === 1 ? "note" : "notes"}{" "}
						on the wall
					</p>
					<button
						type="button"
						onClick={() => {
							setFormError(null);
							setFormOpen(true);
						}}
						className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
					>
						<span aria-hidden>+</span> Leave Feedback
					</button>
				</div>
			</div>

			{formOpen && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
					onClick={() => !formSubmitting && setFormOpen(false)}
				>
					<div
						onClick={(e: React.MouseEvent) => e.stopPropagation()}
						role="dialog"
						aria-modal="true"
						aria-label="Leave feedback"
						className="w-full max-w-md rounded-2xl bg-white p-6 shadow-note-lg"
					>
						<h2 className="font-display text-lg font-semibold text-slate-900">
							Leave feedback
						</h2>
						<div className="mt-4">
							<FeedbackForm
								maxLength={maxMessageLength}
								submitting={formSubmitting}
								error={formError}
								onSubmit={handleCreate}
								onCancel={() => setFormOpen(false)}
							/>
						</div>
					</div>
				</div>
			)}

			{activeNote && (
				<FeedbackDialog
					feedback={activeNote}
					maxLength={maxMessageLength}
					onClose={() => setActiveNoteId(null)}
					onToggleLike={
						allowLikes ? handleToggleLike : async () => {}
					}
					onEdit={handleEditNote}
					onDelete={handleDeleteNote}
				/>
			)}
		</section>
	);
}
