import AuthGate from "@/components/auth/AuthGate";
import { FeedbackWall } from "@/components/feedback-wall/FeedbackWall";

export default async function HomePage() {
	return (
		<AuthGate>
			<main className="min-h-screen bg-stone-100 py-8">
				<FeedbackWall
					wallImage="/wall.png"
					maxMessageLength={240}
					allowLikes
				/>
			</main>
		</AuthGate>
	);
}
