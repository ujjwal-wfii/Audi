import { notFound } from "next/navigation";

import { createAdminClient, type SelfieRow } from "@/lib/supabase/admin";

interface PageProps {
	params: Promise<{ id: string }>;
}

async function getSelfie(id: string): Promise<SelfieRow | null> {
	const supabaseAdmin = createAdminClient();

	const { data, error } = await supabaseAdmin
		.from("selfies")
		.select("id, image_url, created_at, expires_at")
		.eq("id", id)
		.maybeSingle();

	if (error) {
		console.error("Failed to fetch selfie:", error);
		return null;
	}

	return data;
}

function isExpired(row: SelfieRow): boolean {
	if (!row.expires_at) return false; // null = never expires
	return new Date(row.expires_at).getTime() < Date.now();
}

export default async function SelfiePage({ params }: PageProps) {
	const { id } = await params;
	const selfie = await getSelfie(id);

	if (!selfie) {
		notFound();
	}

	if (isExpired(selfie)) {
		return (
			<main className="flex min-h-[100svh] flex-col items-center justify-center gap-3 bg-[#f1eeea] px-6 text-center">
				<h1 className="text-xl font-bold text-slate-800">
					This selfie has expired
				</h1>
				<p className="text-sm text-slate-500">
					Shared photos are only kept for a limited time after the
					event.
				</p>
			</main>
		);
	}

	return (
		<main className="flex min-h-[100svh] flex-col items-center justify-center gap-6 bg-[#f1eeea] px-4 py-10">
			<div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img
					src={selfie.image_url}
					alt="Your OPEXN selfie"
					className="w-full"
				/>
			</div>

			<a
				href={selfie.image_url}
				download={`opexn-selfie-${selfie.id}.jpg`}
				className="rounded-full bg-[#123b78] px-8 py-3 text-sm font-bold tracking-wide text-white shadow-lg transition hover:scale-105 active:scale-95"
			>
				DOWNLOAD
			</a>
		</main>
	);
}
