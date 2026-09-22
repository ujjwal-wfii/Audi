import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

import { validateFeedbackMessage } from "@/lib/feedback/feedback.validation";

import {
	findPlacement,
	generateNoteVisual,
} from "@/lib/feedback/feedback-placement";

import {
	mapFeedbackRow,
	type FeedbackRow,
} from "@/lib/feedback/feedback.mapper";

import {
	DEFAULT_MAX_MESSAGE_LENGTH,
	type NotePosition,
} from "@/types/feedback";

export const dynamic = "force-dynamic";

// GET /api/feedback
// List every feedback note on the wall with the current
// user's like state.
export async function GET() {
	const supabase = await createClient();

	// Authenticate using Opexn's existing Supabase SSR session.
	const { data: claimsData } = await supabase.auth.getClaims();

	const userId = claimsData?.claims?.sub;

	if (!userId) {
		return NextResponse.json(
			{ error: "Sign in to view the wall." },
			{ status: 401 },
		);
	}

	// Get all feedback.
	const { data: rows, error } = await supabase
		.from("feedback_with_counts")
		.select("*")
		.order("created_at", { ascending: true });

	if (error) {
		console.error("[feedback:list]", error.message);

		return NextResponse.json(
			{ error: "Could not load feedback." },
			{ status: 500 },
		);
	}

	// Get feedback liked by the current authenticated user.
	const { data: myVotes, error: votesError } = await supabase
		.from("feedback_votes")
		.select("feedback_id")
		.eq("user_id", userId);

	if (votesError) {
		console.error("[feedback:list:votes]", votesError.message);

		return NextResponse.json(
			{ error: "Could not load feedback." },
			{ status: 500 },
		);
	}

	const likedIds = new Set<string>(
		(myVotes ?? []).map(
			(vote: { feedback_id: string }) => vote.feedback_id,
		),
	);

	const feedback = (rows as FeedbackRow[]).map((row) =>
		mapFeedbackRow(row, userId, likedIds),
	);

	return NextResponse.json({ feedback });
}

// POST /api/feedback
// Create a new feedback note.
//
// IMPORTANT:
// - user_id comes from the authenticated Supabase user.
// - user_name comes from the Opexn profiles table.
// - position/visual properties are generated server-side.
// - The request body cannot choose user_id or user_name.
export async function POST(request: Request) {
	const supabase = await createClient();

	// Authenticate using Opexn's existing Supabase SSR session.
	const { data: claimsData } = await supabase.auth.getClaims();

	const userId = claimsData?.claims?.sub;

	if (!userId) {
		return NextResponse.json(
			{ error: "Sign in to leave feedback." },
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

	// Validate feedback message.
	const validation = validateFeedbackMessage(
		body.message,
		DEFAULT_MAX_MESSAGE_LENGTH,
	);

	if (!validation.valid || !validation.message) {
		return NextResponse.json({ error: validation.error }, { status: 400 });
	}

	// ---------------------------------------------------------
	// Get the authenticated user's name from Opexn profiles.
	// ---------------------------------------------------------

	const { data: profile, error: profileError } = await supabase
		.from("profiles")
		.select("name")
		.eq("id", userId)
		.single();

	if (profileError || !profile) {
		console.error("[feedback:create:profile]", profileError?.message);

		return NextResponse.json(
			{ error: "Could not load your profile." },
			{ status: 500 },
		);
	}

	const userName = profile.name;

	// ---------------------------------------------------------
	// Find a suitable position for the new feedback note.
	// ---------------------------------------------------------

	const { data: existingRows, error: existingError } = await supabase
		.from("feedback")
		.select("position_x, position_y");

	if (existingError) {
		console.error("[feedback:create:existing]", existingError.message);

		return NextResponse.json(
			{ error: "Could not place feedback." },
			{ status: 500 },
		);
	}

	const existingPositions: NotePosition[] = (existingRows ?? []).map(
		(r: { position_x: number; position_y: number }) => ({
			x: r.position_x,
			y: r.position_y,
		}),
	);

	const position = findPlacement(existingPositions);

	// Generate note appearance on the server.
	const visual = generateNoteVisual();

	// ---------------------------------------------------------
	// Create feedback.
	// ---------------------------------------------------------

	const { data: inserted, error: insertError } = await supabase
		.from("feedback")
		.insert({
			// NEVER take this from the request body.
			user_id: userId,

			// Taken from the authenticated user's
			// Opexn profile.
			user_name: userName,

			message: validation.message,

			position_x: position.x,
			position_y: position.y,

			color: visual.color,
			rotation: visual.rotation,
			shadow_strength: visual.shadowStrength,
			tape_position: visual.tapePosition,
		})
		.select("*")
		.single();

	if (insertError || !inserted) {
		console.error("[feedback:create]", insertError?.message);

		return NextResponse.json(
			{ error: "Could not save your feedback." },
			{ status: 500 },
		);
	}

	// Newly-created feedback has zero likes.
	const feedback = mapFeedbackRow(
		{
			id: inserted.id,
			user_id: inserted.user_id,
			user_name: inserted.user_name,
			message: inserted.message,
			position_x: inserted.position_x,
			position_y: inserted.position_y,
			color: inserted.color,
			rotation: inserted.rotation,
			shadow_strength: inserted.shadow_strength,
			tape_position: inserted.tape_position,
			created_at: inserted.created_at,
			updated_at: inserted.updated_at,
			likes_count: 0,
		},
		userId,
		new Set(),
	);

	return NextResponse.json({ feedback }, { status: 201 });
}
