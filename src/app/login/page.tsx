import { redirect } from "next/navigation";

import LoginForm from "@/components/auth/LoginForm";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage() {
	const supabase = await createClient();

	const { data } = await supabase.auth.getClaims();

	if (data?.claims) {
		redirect("/");
	}

	return <LoginForm />;
}
