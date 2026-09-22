import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface RouteContext {
	params: Promise<{ id: string }>;
}

// POST /api/feedback/:id/vote
//
// Toggles the authenticated user's like on a feedback note.
//
// Any authenticated user can like/unlike any feedback,
// including their own.
//
// Duplicate votes are prevented by the database
// UNIQUE(feedback_id, user_id) constraint.
export async function POST(_request: Request, { params }: RouteContext) {
	const { id } = await params;

	const supabase = await createClient();

	// ---------------------------------------------------------
	// Authenticate using Opexn's existing Supabase session.
	// ---------------------------------------------------------

	const { data: claimsData } = await supabase.auth.getClaims();

	const userId = claimsData?.claims?.sub;

	if (!userId) {
		return NextResponse.json(
			{
				error: "Sign in to like feedback.",
			},
			{ status: 401 },
		);
	}

	// ---------------------------------------------------------
	// Check whether this user has already liked the feedback.
	// ---------------------------------------------------------

	const { data: existingVote, error: lookupError } = await supabase
		.from("feedback_votes")
		.select("id")
		.eq("feedback_id", id)
		.eq("user_id", userId)
		.maybeSingle();

	if (lookupError) {
		console.error("[feedback:vote:lookup]", lookupError.message);

		return NextResponse.json(
			{
				error: "Could not update your like.",
			},
			{ status: 500 },
		);
	}

	// ---------------------------------------------------------
	// Existing vote → remove it (unlike)
	// ---------------------------------------------------------

	if (existingVote) {
		const { error: deleteError } = await supabase
			.from("feedback_votes")
			.delete()
			.eq("id", existingVote.id)
			.eq("user_id", userId);

		if (deleteError) {
			console.error("[feedback:vote:delete]", deleteError.message);

			return NextResponse.json(
				{
					error: "Could not update your like.",
				},
				{ status: 500 },
			);
		}
	} else {
		// -----------------------------------------------------
		// No existing vote → create it (like)
		// -----------------------------------------------------

		const { error: insertError } = await supabase
			.from("feedback_votes")
			.insert({
				feedback_id: id,
				user_id: userId,
			});

		if (insertError) {
			// 23505 = unique_violation.
			//
			// This can happen if two requests arrive at nearly
			// the same time. The database constraint prevents
			// duplicate likes.
			if (insertError.code !== "23505") {
				console.error("[feedback:vote:insert]", insertError.message);

				return NextResponse.json(
					{
						error: "Could not update your like.",
					},
					{ status: 500 },
				);
			}
		}
	}

	// ---------------------------------------------------------
	// Get updated like count.
	// ---------------------------------------------------------

	const { count, error: countError } = await supabase
		.from("feedback_votes")
		.select("*", {
			count: "exact",
			head: true,
		})
		.eq("feedback_id", id);

	if (countError) {
		console.error("[feedback:vote:count]", countError.message);

		return NextResponse.json(
			{
				error: "Could not update your like.",
			},
			{ status: 500 },
		);
	}

	return NextResponse.json({
		likesCount: count ?? 0,

		// If there was an existing vote, we removed it.
		// If there wasn't one, we added it.
		likedByMe: !existingVote,
	});
}
