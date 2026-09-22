/**
 * Core Feedback Wall data model.
 *
 * IMPORTANT: `position`, `color`, `rotation`, `shadowStrength`, and
 * `tapePosition` are generated ONCE at creation time on the server and
 * persisted. They must never be regenerated on render/edit — that is
 * what keeps a note visually "pinned" to the same spot forever.
 */

export type TapePosition = "left" | "center" | "right";

export interface NoteVisual {
	color: string;
	rotation: number; // degrees, e.g. -4..4
	shadowStrength: number; // 0..1, subtle variation only
	tapePosition: TapePosition;
}

export interface NotePosition {
	/** Normalized 0..1 coordinate, relative to the wall image's rendered box. */
	x: number;
	/** Normalized 0..1 coordinate, relative to the wall image's rendered box. */
	y: number;
}

export interface Feedback {
	id: string;
	userId: string;
	userName: string | null;

	message: string;

	createdAt: string;
	updatedAt: string | null;

	likesCount: number;
	/** Whether the CURRENT viewer has liked this note. Derived server-side per-request. */
	likedByMe: boolean;
	/** Whether the CURRENT viewer owns this note. Derived server-side per-request. */
	isOwner: boolean;

	position: NotePosition;
	visual: NoteVisual;
}

/** Shape accepted from the client when creating feedback. Nothing privileged lives here. */
export interface CreateFeedbackInput {
	message: string;
	userName?: string | null;
}

/** Shape accepted from the client when editing feedback. Only the message can change. */
export interface UpdateFeedbackInput {
	message: string;
}

export interface FeedbackWallConfig {
	/** Public path or URL to the wall background image. */
	wallImage: string;
	maxMessageLength?: number;
	allowLikes?: boolean;
}

export const NOTE_COLORS = [
	"#F9E85B", // yellow
	"#FFD966", // gold
	"#F7A6C4", // pink
	"#8FD3E8", // blue
	"#C9A6E8", // lavender
	"#FFB562", // orange
] as const;

export const WALL_BOUNDS = {
	minX: 0.06,
	maxX: 0.94,
	minY: 0.14,
	maxY: 0.9,
} as const;

/** Note footprint as a fraction of the wall's rendered width, used for collision + clamping. */
export const NOTE_FOOTPRINT = {
	width: 0.11,
	height: 0.16,
} as const;

export const DEFAULT_MAX_MESSAGE_LENGTH = 240;
