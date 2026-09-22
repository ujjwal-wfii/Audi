import { Feedback, TapePosition } from "@/types/feedback";

/** Shape returned by the `feedback_with_counts` view. */
export interface FeedbackRow {
	id: string;
	user_id: string;
	user_name: string | null;
	message: string;
	position_x: number;
	position_y: number;
	color: string;
	rotation: number;
	shadow_strength: number;
	tape_position: TapePosition;
	created_at: string;
	updated_at: string | null;
	likes_count: number;
}

/**
 * Maps a raw DB row to the public API shape, deriving `isOwner` /
 * `likedByMe` for the CURRENT viewer only. These are per-request/per-user
 * values and must never be persisted on the row itself.
 */
export function mapFeedbackRow(
	row: FeedbackRow,
	currentUserId: string,
	likedFeedbackIds: ReadonlySet<string>,
): Feedback {
	return {
		id: row.id,
		userId: row.user_id,
		userName: row.user_name,
		message: row.message,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		likesCount: row.likes_count,
		likedByMe: likedFeedbackIds.has(row.id),
		isOwner: row.user_id === currentUserId,
		position: { x: row.position_x, y: row.position_y },
		visual: {
			color: row.color,
			rotation: row.rotation,
			shadowStrength: row.shadow_strength,
			tapePosition: row.tape_position,
		},
	};
}
