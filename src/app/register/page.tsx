import { redirect } from "next/navigation";

import RegisterForm from "@/components/auth/RegisterForm";
import { createClient } from "@/lib/supabase/server";

export default async function RegisterPage() {
	const supabase = await createClient();

	const { data } = await supabase.auth.getClaims();

	if (data?.claims) {
		redirect("/");
	}

	return <RegisterForm />;
}
