import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const secretKey = process.env.SUPABASE_SECRET_KEY;

	if (!supabaseUrl || !secretKey) {
		throw new Error(
			"Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY env vars.",
		);
	}

	return createClient(supabaseUrl, secretKey, {
		auth: {
			persistSession: false,
			autoRefreshToken: false,
		},
	});
}

export interface SelfieRow {
	id: string;
	image_url: string;
	created_at: string;
	expires_at: string | null;
}
