import AuthGate from "@/components/auth/AuthGate";
import { Leaderboard } from "@/components/gaming/LeaderBoard";

export default function HangoutLeaderboardPage() {
	return (
		<AuthGate>
			<main className="min-h-screen bg-slate-950">
				<Leaderboard />
			</main>
		</AuthGate>
	);
}
