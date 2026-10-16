import AuthGate from "@/components/auth/AuthGate";
import { TicTacToeGame } from "@/components/gaming/TicTacToeGame";

export default async function HangoutTicTacToePage() {
	return (
		<AuthGate>
			<main className="min-h-screen bg-slate-950">
				<TicTacToeGame />
			</main>
		</AuthGate>
	);
}
