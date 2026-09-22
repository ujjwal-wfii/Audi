import {
	CreateFeedbackInput,
	Feedback,
	UpdateFeedbackInput,
} from "@/types/feedback";

export class FeedbackApiError extends Error {
	status: number;
	constructor(message: string, status: number) {
		super(message);
		this.status = status;
		this.name = "FeedbackApiError";
	}
}

async function handle<T>(res: Response): Promise<T> {
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new FeedbackApiError(
			body?.error ?? "Something went wrong. Please try again.",
			res.status,
		);
	}
	return res.json() as Promise<T>;
}

export async function fetchFeedback(): Promise<Feedback[]> {
	const res = await fetch("/api/feedback", { cache: "no-store" });
	const data = await handle<{ feedback: Feedback[] }>(res);
	return data.feedback;
}

export async function createFeedback(
	input: CreateFeedbackInput,
): Promise<Feedback> {
	const res = await fetch("/api/feedback", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	const data = await handle<{ feedback: Feedback }>(res);
	return data.feedback;
}

export async function updateFeedback(
	id: string,
	input: UpdateFeedbackInput,
): Promise<Feedback> {
	const res = await fetch(`/api/feedback/${id}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(input),
	});
	const data = await handle<{ feedback: Feedback }>(res);
	return data.feedback;
}

export async function deleteFeedback(id: string): Promise<void> {
	const res = await fetch(`/api/feedback/${id}`, { method: "DELETE" });
	await handle<{ success: true }>(res);
}

export async function toggleVote(
	id: string,
): Promise<{ likesCount: number; likedByMe: boolean }> {
	const res = await fetch(`/api/feedback/${id}/vote`, { method: "POST" });
	return handle<{ likesCount: number; likedByMe: boolean }>(res);
}
