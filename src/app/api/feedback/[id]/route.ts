import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

import { validateFeedbackMessage } from "@/lib/feedback/feedback.validation";

import {
	mapFeedbackRow,
	type FeedbackRow,
} from "@/lib/feedback/feedback.mapper";

import { DEFAULT_MAX_MESSAGE_LENGTH } from "@/types/feedback";

export const dynamic = "force-dynamic";

interface RouteContext {
	params: Promise<{ id: string }>;
}

// PATCH /api/feedback/:id
// Edit ONLY the feedback message.
//
// Ownership is enforced by:
// 1. The authenticated user's ID from Supabase claims.
// 2. .eq("user_id", userId) in the database query.
// 3. Supabase RLS.
//
// Position, color, rotation, shadow and tape properties
// are never accepted from the client.
export async function PATCH(request: Request, { params }: RouteContext) {
	const { id } = await params;

	const supabase = await createClient();

	// Get the authenticated Opexn user.
	const { data: claimsData } = await supabase.auth.getClaims();

	const userId = claimsData?.claims?.sub;

	if (!userId) {
		return NextResponse.json(
			{ error: "Sign in to edit feedback." },
			{ status: 401 },
		);
	}

	// Parse request body.
	const body = await request.json().catch(() => null);

	if (!body) {
		return NextResponse.json(
			{ error: "Invalid request body." },
			{ status: 400 },
		);
	}

	// Validate the new message.
	const validation = validateFeedbackMessage(
		body.message,
		DEFAULT_MAX_MESSAGE_LENGTH,
	);

	if (!validation.valid || !validation.message) {
		return NextResponse.json({ error: validation.error }, { status: 400 });
	}

	// Update only the message.
	//
	// user_id is taken from the authenticated session,
	// never from the request body.
	const { data: updated, error } = await supabase
		.from("feedback")
		.update({
			message: validation.message,
		})
		.eq("id", id)
		.eq("user_id", userId)
		.select("*")
		.maybeSingle();

	if (error) {
		console.error("[feedback:update]", error.message);

		return NextResponse.json(
			{ error: "Could not update feedback." },
			{ status: 500 },
		);
	}

	if (!updated) {
		// Don't reveal whether the feedback exists
		// when it belongs to another user.
		return NextResponse.json(
			{
				error: "You can only edit your own feedback.",
			},
			{ status: 403 },
		);
	}

	// Get total likes for this feedback.
	const { count, error: countError } = await supabase
		.from("feedback_votes")
		.select("*", {
			count: "exact",
			head: true,
		})
		.eq("feedback_id", id);

	if (countError) {
		console.error("[feedback:update:likes]", countError.message);

		return NextResponse.json(
			{ error: "Could not load feedback." },
			{ status: 500 },
		);
	}

	// Check whether the current user has liked this feedback.
	const { data: myVote, error: voteError } = await supabase
		.from("feedback_votes")
		.select("feedback_id")
		.eq("feedback_id", id)
		.eq("user_id", userId)
		.maybeSingle();

	if (voteError) {
		console.error("[feedback:update:vote]", voteError.message);

		return NextResponse.json(
			{ error: "Could not load feedback." },
			{ status: 500 },
		);
	}

	const row: FeedbackRow = {
		id: updated.id,
		user_id: updated.user_id,
		user_name: updated.user_name,
		message: updated.message,
		position_x: updated.position_x,
		position_y: updated.position_y,
		color: updated.color,
		rotation: updated.rotation,
		shadow_strength: updated.shadow_strength,
		tape_position: updated.tape_position,
		created_at: updated.created_at,
		updated_at: updated.updated_at,
		likes_count: count ?? 0,
	};

	const likedIds = myVote ? new Set([id]) : new Set<string>();

	const feedback = mapFeedbackRow(row, userId, likedIds);

	return NextResponse.json({ feedback });
}

// DELETE /api/feedback/:id
//
// Only the owner can delete their feedback.
// feedback_votes are expected to cascade-delete
// through the database foreign key.
export async function DELETE(_request: Request, { params }: RouteContext) {
	const { id } = await params;

	const supabase = await createClient();

	// Get the authenticated Opexn user.
	const { data: claimsData } = await supabase.auth.getClaims();

	const userId = claimsData?.claims?.sub;

	if (!userId) {
		return NextResponse.json(
			{ error: "Sign in to delete feedback." },
			{ status: 401 },
		);
	}

	// Delete only if this feedback belongs to
	// the authenticated user.
	const { data: deleted, error } = await supabase
		.from("feedback")
		.delete()
		.eq("id", id)
		.eq("user_id", userId)
		.select("id")
		.maybeSingle();

	if (error) {
		console.error("[feedback:delete]", error.message);

		return NextResponse.json(
			{ error: "Could not delete feedback." },
			{ status: 500 },
		);
	}

	if (!deleted) {
		return NextResponse.json(
			{
				error: "You can only delete your own feedback.",
			},
			{ status: 403 },
		);
	}

	return NextResponse.json({
		success: true,
	});
}
