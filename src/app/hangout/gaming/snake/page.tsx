import AuthGate from "@/components/auth/AuthGate";
import { SnakeGame } from "@/components/gaming/SnakeGame";

export default async function HangoutSnakePage() {
	return (
		<AuthGate>
			<main className="min-h-screen bg-slate-950">
				<SnakeGame />
			</main>
		</AuthGate>
	);
}
