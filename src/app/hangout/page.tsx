export default function HangoutPage() {
	return (
		<main className="flex flex-col items-center justify-center gap-8 py-16">
			<h1 className="text-center text-4xl font-bold text-slate-900">
				Welcome to the Hangout!
			</h1>
			<p className="max-w-xl text-center text-lg text-slate-700">
				Join us for a fun and interactive experience! Explore our Selfie
				Booth to capture your best moments, or head over to the Feedback
				Wall to share your thoughts and ideas. We can't wait to see you
				there!
			</p>
			<div className="flex flex-col items-center gap-4">
				<a
					href="/hangout/selfie-booth"
					className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
				>
					Go to Selfie Booth
				</a>
			</div>
		</main>
	);
}
