import AuthGate from "@/components/auth/AuthGate";
import { SudokuGame } from "@/components/gaming/SudokuGame";

export default async function HangoutSudokuPage() {
	return (
		<AuthGate>
			<main className="min-h-screen bg-slate-950">
				<SudokuGame />
			</main>
		</AuthGate>
	);
}
