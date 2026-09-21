"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
	const router = useRouter();

	const [loading, setLoading] = useState(false);

	async function handleLogout() {
		setLoading(true);

		const supabase = createClient();

		const { error } = await supabase.auth.signOut();

		if (error) {
			console.error("Logout failed:", error.message);
			setLoading(false);
			return;
		}

		router.replace("/login");
		router.refresh();
	}

	return (
		<button
			type="button"
			onClick={handleLogout}
			disabled={loading}
			className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black shadow transition hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
		>
			{loading ? "Logging out..." : "Logout"}
		</button>
	);
}
