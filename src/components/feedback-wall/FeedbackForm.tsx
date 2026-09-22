"use client";

import { useState } from "react";

interface FeedbackFormProps {
	maxLength: number;
	submitting: boolean;
	error: string | null;
	onSubmit: (message: string) => void;
	onCancel: () => void;
}

export function FeedbackForm({
	maxLength,
	submitting,
	error,
	onSubmit,
	onCancel,
}: FeedbackFormProps) {
	const [message, setMessage] = useState("");

	function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const trimmed = message.trim();
		if (!trimmed || submitting) return;
		onSubmit(trimmed);
	}

	const remaining = maxLength - message.length;

	return (
		<form onSubmit={handleSubmit} className="space-y-3">
			<div>
				<label htmlFor="feedback-message" className="sr-only">
					Your feedback
				</label>
				<textarea
					id="feedback-message"
					value={message}
					onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
						setMessage(e.target.value.slice(0, maxLength))
					}
					placeholder="Share your feedback or request…"
					rows={4}
					autoFocus
					maxLength={maxLength}
					className="w-full resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
				/>
				<div
					className={`mt-1 text-right text-xs ${
						remaining < 20 ? "text-rose-500" : "text-slate-400"
					}`}
				>
					{remaining} characters left
				</div>
			</div>

			{error && (
				<p
					role="alert"
					className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600"
				>
					{error}
				</p>
			)}

			<div className="flex justify-end gap-2">
				<button
					type="button"
					onClick={onCancel}
					disabled={submitting}
					className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-stone-100 disabled:opacity-60"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={submitting || message.trim().length === 0}
					className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
				>
					{submitting ? "Posting…" : "Post feedback"}
				</button>
			</div>
		</form>
	);
}
