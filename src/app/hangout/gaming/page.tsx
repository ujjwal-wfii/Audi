import AuthGate from "@/components/auth/AuthGate";
import { GamingZone } from "@/components/gaming/GamingZone";
import { FootballIntro } from "@/components/gaming/FootballIntro";

export default async function HangoutGamingPage() {
	return (
		<AuthGate>
			<main className="h-screen overflow-hidden bg-slate-950">
				<GamingZone />
				<FootballIntro />
			</main>
		</AuthGate>
	);
}