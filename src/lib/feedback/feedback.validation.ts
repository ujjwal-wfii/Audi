import { DEFAULT_MAX_MESSAGE_LENGTH } from "@/types/feedback";

export interface ValidationResult {
	valid: boolean;
	error?: string;
	message?: string; // trimmed, cleaned message
}

/**
 * Server-side validation. This is the ONLY validation that matters for
 * security — client-side checks are a UX convenience, not a guarantee.
 */
export function validateFeedbackMessage(
	raw: unknown,
	maxLength: number = DEFAULT_MAX_MESSAGE_LENGTH,
): ValidationResult {
	if (typeof raw !== "string") {
		return { valid: false, error: "Feedback message must be text." };
	}

	const trimmed = raw.trim().replace(/\s+/g, " ");

	if (trimmed.length < 1) {
		return { valid: false, error: "Feedback can't be empty." };
	}

	if (trimmed.length > maxLength) {
		return {
			valid: false,
			error: `Feedback must be ${maxLength} characters or fewer.`,
		};
	}

	return { valid: true, message: trimmed };
}

export function validateUserName(raw: unknown): string | null {
	if (typeof raw !== "string") return null;
	const trimmed = raw.trim().replace(/\s+/g, " ").slice(0, 60);
	return trimmed.length > 0 ? trimmed : null;
}
