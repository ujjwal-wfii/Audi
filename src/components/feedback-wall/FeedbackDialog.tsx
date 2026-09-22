"use client";

import { useEffect, useRef, useState } from "react";

import { LikeButton } from "./LikeButton";
import { Feedback } from "@/types/feedback";

interface FeedbackDialogProps {
	feedback: Feedback;
	maxLength: number;
	onClose: () => void;
	onToggleLike: (id: string) => Promise<void>;
	onEdit: (id: string, message: string) => Promise<void>;
	onDelete: (id: string) => Promise<void>;
}

type Mode = "view" | "edit" | "confirm-delete";

export function FeedbackDialog({
	feedback,
	maxLength,
	onClose,
	onToggleLike,
	onEdit,
	onDelete,
}: FeedbackDialogProps) {
	const [mode, setMode] = useState<Mode>("view");
	const [draft, setDraft] = useState(feedback.message);
	const [busy, setBusy] = useState<"like" | "save" | "delete" | null>(null);
	const [error, setError] = useState<string | null>(null);
	const dialogRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		setDraft(feedback.message);
	}, [feedback.message]);

	useEffect(() => {
		function handleKey(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		document.addEventListener("keydown", handleKey);
		dialogRef.current?.focus();
		return () => document.removeEventListener("keydown", handleKey);
	}, [onClose]);

	async function handleLike() {
		setBusy("like");
		setError(null);
		try {
			await onToggleLike(feedback.id);
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Could not update your like.",
			);
		} finally {
			setBusy(null);
		}
	}

	async function handleSaveEdit(e: React.FormEvent) {
		e.preventDefault();
		const trimmed = draft.trim();
		if (!trimmed) return;
		setBusy("save");
		setError(null);
		try {
			await onEdit(feedback.id, trimmed);
			setMode("view");
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Could not save changes.",
			);
		} finally {
			setBusy(null);
		}
	}

	async function handleDelete() {
		setBusy("delete");
		setError(null);
		try {
			await onDelete(feedback.id);
			onClose();
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Could not delete feedback.",
			);
			setBusy(null);
		}
	}

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
			onClick={onClose}
		>
			<div
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby="feedback-dialog-title"
				tabIndex={-1}
				onClick={(e: React.MouseEvent) => e.stopPropagation()}
				className="w-full max-w-md rounded-2xl bg-white p-6 shadow-note-lg outline-none"
				style={{ borderTop: `6px solid ${feedback.visual.color}` }}
			>
				<div className="flex items-start justify-between gap-4">
					<h2
						id="feedback-dialog-title"
						className="font-display text-sm font-medium text-slate-400"
					>
						{feedback.userName ?? "Anonymous visitor"}
						{feedback.isOwner && (
							<span className="ml-1 text-slate-300">(you)</span>
						)}
					</h2>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close"
						className="rounded-full p-1 text-slate-400 transition hover:bg-stone-100 hover:text-slate-600"
					>
						<svg
							viewBox="0 0 24 24"
							className="h-5 w-5"
							fill="none"
							stroke="currentColor"
							strokeWidth={2}
						>
							<path
								d="M6 6l12 12M18 6L6 18"
								strokeLinecap="round"
							/>
						</svg>
					</button>
				</div>

				{mode === "edit" ? (
					<form onSubmit={handleSaveEdit} className="mt-3 space-y-3">
						<textarea
							value={draft}
							onChange={(
								e: React.ChangeEvent<HTMLTextAreaElement>,
							) => setDraft(e.target.value.slice(0, maxLength))}
							rows={4}
							autoFocus
							maxLength={maxLength}
							className="w-full resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
						/>
						<div className="flex justify-end gap-2">
							<button
								type="button"
								onClick={() => {
									setMode("view");
									setDraft(feedback.message);
									setError(null);
								}}
								disabled={busy === "save"}
								className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-stone-100 disabled:opacity-60"
							>
								Cancel
							</button>
							<button
								type="submit"
								disabled={
									busy === "save" || draft.trim().length === 0
								}
								className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
							>
								{busy === "save" ? "Saving…" : "Save"}
							</button>
						</div>
					</form>
				) : (
					<p className="mt-3 whitespace-pre-wrap font-handwriting text-xl leading-snug text-slate-800">
						{feedback.message}
					</p>
				)}

				{error && (
					<p
						role="alert"
						className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600"
					>
						{error}
					</p>
				)}

				{mode === "confirm-delete" && (
					<div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3">
						<p className="text-sm text-rose-700">
							Delete this feedback? This can&apos;t be undone.
						</p>
						<div className="mt-2 flex justify-end gap-2">
							<button
								type="button"
								onClick={() => setMode("view")}
								disabled={busy === "delete"}
								className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-white disabled:opacity-60"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={handleDelete}
								disabled={busy === "delete"}
								className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-60"
							>
								{busy === "delete" ? "Deleting…" : "Delete"}
							</button>
						</div>
					</div>
				)}

				{mode === "view" && (
					<div className="mt-5 flex items-center justify-between">
						<LikeButton
							likesCount={feedback.likesCount}
							likedByMe={feedback.likedByMe}
							disabled={busy === "like"}
							onToggle={handleLike}
						/>

						{feedback.isOwner && (
							<div className="flex gap-2">
								<button
									type="button"
									onClick={() => setMode("edit")}
									className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-stone-100"
								>
									Edit
								</button>
								<button
									type="button"
									onClick={() => setMode("confirm-delete")}
									className="rounded-lg border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
								>
									Delete
								</button>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
