import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { nanoid } from "nanoid";

import { createAdminClient } from "@/lib/supabase/admin";

/*
 * How long a shared selfie stays retrievable. Change this one constant if
 * your event needs a different window — nothing else depends on the value.
 * Set to null to never expire (the retrieval route already treats a null
 * expires_at as "never expires").
 */
const EXPIRY_DAYS: number | null = 30;

export const runtime = "nodejs";

function getPublicOrigin(request: NextRequest): string {
	const configuredOrigin =
		process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;

	if (configuredOrigin) {
		return configuredOrigin.replace(/\/$/, "");
	}

	if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
		return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
	}

	const forwardedHost = request.headers.get("x-forwarded-host");
	const forwardedProtocol = request.headers.get("x-forwarded-proto");

	if (forwardedHost) {
		return `${forwardedProtocol ?? "https"}://${forwardedHost}`;
	}

	return new URL(request.url).origin;
}

export async function POST(request: NextRequest) {
	try {
		const formData = await request.formData();
		const file = formData.get("photo");

		if (!(file instanceof Blob)) {
			return NextResponse.json(
				{ error: "Missing 'photo' file." },
				{ status: 400 },
			);
		}

		if (file.size === 0) {
			return NextResponse.json(
				{ error: "Empty photo." },
				{ status: 400 },
			);
		}

		// 10 MB sanity cap — a 1200x1000 JPEG at quality 0.92 is well under 1MB,
		// so anything near this size signals something went wrong upstream.
		const MAX_BYTES = 10 * 1024 * 1024;
		if (file.size > MAX_BYTES) {
			return NextResponse.json(
				{ error: "Photo too large." },
				{ status: 413 },
			);
		}

		const id = nanoid(10); // short, URL-safe, becomes /selfie/<id>
		const supabaseAdmin = createAdminClient();

		const blob = await put(`selfies/${id}.jpg`, file, {
			access: "public",
			contentType: "image/jpeg",
			addRandomSuffix: false,
		});

		const expiresAt =
			EXPIRY_DAYS === null
				? null
				: new Date(
						Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000,
					).toISOString();

		const { error } = await supabaseAdmin.from("selfies").insert({
			id,
			image_url: blob.url,
			expires_at: expiresAt,
		});

		if (error) {
			console.error("Supabase insert failed:", error);
			return NextResponse.json(
				{ error: "Could not save photo record." },
				{ status: 500 },
			);
		}

		return NextResponse.json({
			id,
			url: blob.url,
			shareUrl: `${getPublicOrigin(request)}/selfie/${id}`,
			expiresAt,
		});
	} catch (err) {
		console.error("Selfie upload failed:", err);
		return NextResponse.json({ error: "Upload failed." }, { status: 500 });
	}
}
