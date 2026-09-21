"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

interface AuthGateProps {
	children: ReactNode;
}

export default function AuthGate({ children }: AuthGateProps) {
	const router = useRouter();

	const [checkingAuth, setCheckingAuth] = useState(true);
	const [authenticated, setAuthenticated] = useState(false);

	useEffect(() => {
		const supabase = createClient();

		let mounted = true;

		async function checkUser() {
			const {
				data: { user },
			} = await supabase.auth.getUser();

			if (!mounted) return;

			if (!user) {
				router.replace("/login");
				return;
			}

			setAuthenticated(true);
			setCheckingAuth(false);
		}

		checkUser();

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			if (!session) {
				router.replace("/login");
				return;
			}

			if (mounted) {
				setAuthenticated(true);
				setCheckingAuth(false);
			}
		});

		return () => {
			mounted = false;
			subscription.unsubscribe();
		};
	}, [router]);

	if (checkingAuth || !authenticated) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-black text-white">
				<div className="text-center">
					<div className="text-lg">Checking authentication...</div>
				</div>
			</div>
		);
	}

	return <>{children}</>;
}
