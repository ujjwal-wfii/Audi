"use client";

import { FormEvent, useState } from "react";
import { Eye, EyeOff, ArrowRight, Building2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
	const router = useRouter();
	const supabase = createClient();

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");

	const [showPassword, setShowPassword] = useState(false);
	const [loading, setLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");

	async function handleLogin(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		setLoading(true);
		setErrorMessage("");

		const { error } = await supabase.auth.signInWithPassword({
			email: email.trim(),
			password,
		});

		if (error) {
			setErrorMessage(error.message);
			setLoading(false);
			return;
		}

		router.push("/");
		router.refresh();
	}

	return (
		<main className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
			{/* Background glow */}
			<div className="pointer-events-none absolute inset-0">
				<div className="absolute left-1/2 top-[-20%] h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-[140px]" />

				<div className="absolute bottom-[-20%] left-[-10%] h-[400px] w-[400px] rounded-full bg-purple-500/10 blur-[130px]" />

				<div className="absolute bottom-[-20%] right-[-10%] h-[400px] w-[400px] rounded-full bg-blue-500/10 blur-[130px]" />
			</div>

			{/* Subtle grid */}
			<div
				className="pointer-events-none absolute inset-0 opacity-[0.035]"
				style={{
					backgroundImage:
						"linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
					backgroundSize: "50px 50px",
				}}
			/>

			{/* Content */}
			<div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-6 sm:px-6 lg:px-8">
				<div className="w-full max-w-[440px]">
					{/* Brand */}
					<div className="mb-5 text-center sm:mb-6">
						<div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] shadow-lg shadow-black/20">
							<Building2 className="h-5 w-5 text-white" />
						</div>

						<p className="text-xs font-medium uppercase tracking-[0.28em] text-white/45">
							Opexn
						</p>
					</div>

					{/* Card */}
					<div className="rounded-2xl border border-white/10 bg-white/[0.055] p-5 shadow-2xl shadow-black/40 backdrop-blur-2xl sm:p-7">
						{/* Heading */}
						<div className="mb-6">
							<h1 className="text-2xl font-semibold tracking-tight text-white sm:text-[28px]">
								Welcome back
							</h1>

							<p className="mt-1.5 text-sm leading-5 text-white/50">
								Sign in to enter the virtual auditorium.
							</p>
						</div>

						<form onSubmit={handleLogin} className="space-y-4">
							{/* Email */}
							<div>
								<label
									htmlFor="login-email"
									className="mb-1.5 block text-xs font-medium text-white/70"
								>
									Email address
								</label>

								<input
									id="login-email"
									type="email"
									value={email}
									onChange={(event) =>
										setEmail(event.target.value)
									}
									placeholder="you@example.com"
									required
									autoComplete="email"
									className="h-11 w-full rounded-lg border border-white/10 bg-black/25 px-3.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.07] focus:ring-2 focus:ring-white/5"
								/>
							</div>

							{/* Password */}
							<div>
								<label
									htmlFor="login-password"
									className="mb-1.5 block text-xs font-medium text-white/70"
								>
									Password
								</label>

								<div className="relative">
									<input
										id="login-password"
										type={
											showPassword ? "text" : "password"
										}
										value={password}
										onChange={(event) =>
											setPassword(event.target.value)
										}
										placeholder="Enter your password"
										required
										autoComplete="current-password"
										className="h-11 w-full rounded-lg border border-white/10 bg-black/25 px-3.5 pr-11 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.07] focus:ring-2 focus:ring-white/5"
									/>

									<button
										type="button"
										onClick={() =>
											setShowPassword((value) => !value)
										}
										aria-label={
											showPassword
												? "Hide password"
												: "Show password"
										}
										className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-white/35 transition hover:text-white/75"
									>
										{showPassword ? (
											<EyeOff className="h-[17px] w-[17px]" />
										) : (
											<Eye className="h-[17px] w-[17px]" />
										)}
									</button>
								</div>
							</div>

							{/* Error */}
							{errorMessage && (
								<div className="rounded-lg border border-red-400/15 bg-red-500/10 px-3.5 py-2.5 text-xs leading-5 text-red-300">
									{errorMessage}
								</div>
							)}

							{/* Login button */}
							<button
								type="submit"
								disabled={loading}
								className="group flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{loading ? (
									<>
										<span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
										Signing in...
									</>
								) : (
									<>
										Enter Auditorium
										<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
									</>
								)}
							</button>
						</form>

						{/* Register */}
						<div className="mt-6 border-t border-white/10 pt-5 text-center">
							<p className="text-xs text-white/40">
								Don't have an account?{" "}
								<Link
									href="/register"
									className="font-medium text-white/80 underline-offset-4 transition hover:text-white hover:underline"
								>
									Create an account
								</Link>
							</p>
						</div>
					</div>

					{/* Footer */}
					<p className="mt-5 text-center text-[10px] uppercase tracking-[0.2em] text-white/20">
						Virtual Event Experience
					</p>
				</div>
			</div>
		</main>
	);
}
