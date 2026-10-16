import Link from "next/link";
import type { ComponentType, ReactNode } from "react";

import { createClient } from "@/lib/supabase/server";

/* ---------------------------------------------------------------------- */
/* Zones: the only place you need to edit to change routes or copy         */
/* ---------------------------------------------------------------------- */

interface Zone {
	id: string;
	title: string;
	description: string;
	href: string; // adjust to your real routes
	cta: string;
	tint: string; // pastel panel behind the icon
	iconColor: string;
	Icon: ComponentType<{ className?: string }>;
	comingSoon?: boolean; // set true for a zone whose page isn't built yet
}

function Svg({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={1.75}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			className={className}
		>
			{children}
		</svg>
	);
}

function CameraIcon({ className }: { className?: string }) {
	return (
		<Svg className={className}>
			<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
			<circle cx="12" cy="13" r="3" />
		</Svg>
	);
}

function MessageIcon({ className }: { className?: string }) {
	return (
		<Svg className={className}>
			<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
			<path d="M13 8H7" />
			<path d="M17 12H7" />
		</Svg>
	);
}

function GamepadIcon({ className }: { className?: string }) {
	return (
		<Svg className={className}>
			<line x1="6" x2="10" y1="11" y2="11" />
			<line x1="8" x2="8" y1="9" y2="13" />
			<line x1="15" x2="15.01" y1="12" y2="12" />
			<line x1="18" x2="18.01" y1="10" y2="10" />
			<path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" />
		</Svg>
	);
}

function ArrowIcon({ className }: { className?: string }) {
	return (
		<Svg className={className}>
			<path d="M5 12h14M13 6l6 6-6 6" />
		</Svg>
	);
}

const ZONES: Zone[] = [
	{
		id: "selfie-booth",
		title: "Selfie Booth",
		description:
			"Step inside the 3D booth, strike a pose and take your selfie home.",
		href: "/hangout/selfie-booth",
		cta: "Open Selfie Booth",
		tint: "from-violet-100 via-indigo-50 to-sky-100",
		iconColor: "text-violet-600",
		Icon: CameraIcon,
	},
	{
		id: "feedback-wall",
		title: "Feedback Wall",
		description:
			"Share your thoughts and ideas, and read what everyone else has to say.",
		href: "/hangout/feedback",
		cta: "Open Feedback Wall",
		tint: "from-amber-100 via-orange-50 to-rose-100",
		iconColor: "text-orange-600",
		Icon: MessageIcon,
	},
	{
		id: "gaming-zone",
		title: "Gaming Zone",
		description:
			"Take a break with quick games and a bit of friendly competition.",
		href: "/hangout/gaming-zone",
		cta: "Enter Gaming Zone",
		tint: "from-emerald-100 via-teal-50 to-cyan-100",
		iconColor: "text-emerald-600",
		Icon: GamepadIcon,
	},
	{
		id: "social-area",
		title: "Social Area",
		description:
			"Connect with others, share experiences, and build relationships.",
		href: "/hangout/social-area",
		cta: "Visit Social Area",
		tint: "from-pink-100 via-rose-50 to-pink-100",
		iconColor: "text-pink-600",
		Icon: ArrowIcon,
		comingSoon: true,
	},
];

/* ---------------------------------------------------------------------- */
/* Profile (from the Supabase session, read on the server)                 */
/* ---------------------------------------------------------------------- */

interface Profile {
	name: string;
	firstName: string;
	email: string;
	initials: string;
}

async function getProfile(): Promise<Profile | null> {
	const supabase = await createClient();
	const { data } = await supabase.auth.getClaims();
	const claims = data?.claims as Record<string, unknown> | undefined;

	if (!claims) return null;

	const meta = (claims.user_metadata ?? {}) as Record<string, unknown>;
	const email = typeof claims.email === "string" ? claims.email : "";

	const metaName =
		(typeof meta.full_name === "string" && meta.full_name) ||
		(typeof meta.name === "string" && meta.name) ||
		"";

	const name = metaName || email.split("@")[0] || "Guest";
	const words = name.trim().split(/\s+/);
	const initials = words
		.slice(0, 2)
		.map((word) => word[0]?.toUpperCase() ?? "")
		.join("");

	return {
		name,
		firstName: words[0] ?? name,
		email,
		initials: initials || "?",
	};
}

/* ---------------------------------------------------------------------- */
/* Header                                                                  */
/* ---------------------------------------------------------------------- */

function HangoutHeader({ profile }: { profile: Profile | null }) {
	return (
		<header className="sticky top-0 z-20 border-b border-white/70 bg-white/80 backdrop-blur">
			<div className="flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-6">
				<div className="flex items-center gap-4">
					{/* Swap this text for your logo image (next/image) when you have the asset */}
					<Link
						href="/"
						aria-label="OPEXN home"
						className="rounded-md bg-gradient-to-r from-blue-700 to-indigo-500 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
					>
						OPEXN
					</Link>
				</div>

				{profile ? (
					<div className="flex min-w-0 items-center gap-2.5 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-4 shadow-sm">
						<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-xs font-bold text-white">
							{profile.initials}
						</span>

						<span className="hidden min-w-0 flex-col leading-tight sm:flex">
							<span className="truncate text-sm font-semibold text-slate-900">
								{profile.name}
							</span>
							{/* {profile.email && (
								<span className="max-w-[12rem] truncate text-xs text-slate-500">
									{profile.email}
								</span>
							)} */}
						</span>
					</div>
				) : (
					<Link
						href="/login"
						className="rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-300"
					>
						Sign in
					</Link>
				)}
			</div>
		</header>
	);
}

/* ---------------------------------------------------------------------- */
/* Zone card                                                               */
/* ---------------------------------------------------------------------- */

function ZoneCard({ zone }: { zone: Zone }) {
	const { Icon } = zone;

	return (
		<li className="flex">
			<article
				className={`group relative flex w-full flex-col overflow-hidden rounded-3xl border border-white bg-white shadow-[0_10px_30px_-14px_rgba(79,70,229,0.3)] ring-1 ring-slate-900/5 transition duration-200 ${
					zone.comingSoon
						? ""
						: "motion-safe:hover:-translate-y-1 hover:shadow-[0_20px_44px_-16px_rgba(79,70,229,0.45)]"
				}`}
			>
				<div
					className={`relative flex h-40 items-center justify-center overflow-hidden bg-gradient-to-br ${zone.tint}`}
				>
					<span
						aria-hidden="true"
						className="absolute -left-6 -top-6 h-28 w-28 rounded-full bg-white/50"
					/>
					<span
						aria-hidden="true"
						className="absolute -bottom-10 -right-4 h-32 w-32 rounded-full bg-white/40"
					/>

					<span
						className={`relative flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-lg transition duration-200 motion-safe:group-hover:scale-105 ${zone.iconColor}`}
					>
						<Icon className="h-10 w-10" />
					</span>
				</div>

				<div className="flex flex-1 flex-col gap-2 p-5">
					<h2 className="text-lg font-semibold text-slate-900">
						{zone.title}
					</h2>
					<p className="text-sm leading-relaxed text-slate-600">
						{zone.description}
					</p>

					<div className="mt-auto pt-4">
						{zone.comingSoon ? (
							<span className="inline-flex items-center rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-500">
								Coming soon
							</span>
						) : (
							/* The ::after makes the whole card clickable */
							<Link
								href={zone.href}
								className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md after:absolute after:inset-0 after:rounded-3xl focus-visible:outline-none focus-visible:after:ring-4 focus-visible:after:ring-violet-400/60"
							>
								{zone.cta}
								<ArrowIcon className="h-4 w-4 transition duration-200 motion-safe:group-hover:translate-x-0.5" />
							</Link>
						)}
					</div>
				</div>
			</article>
		</li>
	);
}

/* ---------------------------------------------------------------------- */
/* Page                                                                    */
/* ---------------------------------------------------------------------- */

export default async function HangoutPage() {
	const profile = await getProfile();

	return (
		<main className="h-full min-h-[100svh] overflow-y-auto bg-[linear-gradient(135deg,#eef2ff_0%,#f5f3ff_45%,#e0f2fe_100%)]">
			<HangoutHeader profile={profile} />

			<section className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
				<div className="max-w-2xl">
					<h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
						{profile
							? `Welcome to the Hangout, ${profile.firstName}!`
							: "Welcome to the Hangout!"}
					</h1>
					<p className="mt-3 text-base leading-relaxed text-slate-600 sm:text-lg">
						Pick a spot: capture your best moments at the Selfie
						Booth, share your thoughts on the Feedback Wall, or take
						a break in the Gaming Zone.
					</p>
				</div>

				<ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
					{ZONES.map((zone) => (
						<ZoneCard key={zone.id} zone={zone} />
					))}
				</ul>
			</section>
		</main>
	);
}
