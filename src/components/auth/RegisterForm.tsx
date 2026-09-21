"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Building2, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export default function RegisterForm() {
	const router = useRouter();
	const supabase = createClient();

	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [mobileNumber, setMobileNumber] = useState("");
	const [companyName, setCompanyName] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");

	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);

	const [loading, setLoading] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");
	const [successMessage, setSuccessMessage] = useState("");

	async function handleRegister(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		setErrorMessage("");
		setSuccessMessage("");

		if (password !== confirmPassword) {
			setErrorMessage("Passwords do not match.");
			return;
		}

		if (password.length < 8) {
			setErrorMessage("Password must be at least 8 characters.");
			return;
		}

		setLoading(true);

		const { data, error } = await supabase.auth.signUp({
			email: email.trim(),
			password,
			options: {
				data: {
					name: name.trim(),
					mobile_number: mobileNumber.trim() || null,
					company_name: companyName.trim(),
				},
			},
		});

		if (error) {
			setErrorMessage(error.message);
			setLoading(false);
			return;
		}

		if (data.session) {
			router.push("/");
			router.refresh();
			return;
		}

		setSuccessMessage(
			"Registration successful. Please check your email to continue.",
		);

		setLoading(false);
	}

	return (
		<main className="relative h-screen overflow-hidden bg-[#050505] text-white">
			{/* Background glow */}
			<div className="pointer-events-none absolute inset-0">
				<div className="absolute left-1/2 top-[-25%] h-96 w-[700px] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-[130px]" />

				<div className="absolute bottom-[-20%] left-[-8%] h-80 w-80 rounded-full bg-purple-500/10 blur-[120px]" />

				<div className="absolute bottom-[-20%] right-[-8%] h-80 w-80 rounded-full bg-blue-500/10 blur-[120px]" />
			</div>

			{/* Background grid */}
			<div
				className="pointer-events-none absolute inset-0 opacity-[0.035]"
				style={{
					backgroundImage:
						"linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
					backgroundSize: "50px 50px",
				}}
			/>

			{/* Main content */}
			<div className="relative z-10 flex h-full items-center justify-center px-4 py-4 sm:px-6">
				<div className="w-full max-w-3xl">
					{/* Logo */}
					<div className="mb-4 text-center">
						<div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]">
							<Building2 className="h-5 w-5 text-white" />
						</div>

						<p className="text-[10px] font-medium uppercase tracking-[0.3em] text-white/45">
							Opexn
						</p>
					</div>

					{/* Register card */}
					<div className="rounded-2xl border border-white/10 bg-white/[0.055] p-5 shadow-2xl shadow-black/50 backdrop-blur-2xl sm:p-6 lg:p-7">
						{/* Heading */}
						<div className="mb-5 text-center">
							<h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
								Create your account
							</h1>

							<p className="mt-1.5 text-xs text-white/45 sm:text-sm">
								Join the event and enter the virtual auditorium.
							</p>
						</div>

						{/* Form */}
						<form
							onSubmit={handleRegister}
							className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-5"
						>
							{/* Name */}
							<div>
								<label
									htmlFor="register-name"
									className="mb-1.5 block text-xs font-medium text-white/70"
								>
									Name
								</label>

								<input
									id="register-name"
									type="text"
									value={name}
									onChange={(event) =>
										setName(event.target.value)
									}
									placeholder="Your name"
									required
									autoComplete="name"
									className="h-10 w-full rounded-lg border border-white/10 bg-black/25 px-3.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.07] focus:ring-2 focus:ring-white/5"
								/>
							</div>

							{/* Email */}
							<div>
								<label
									htmlFor="register-email"
									className="mb-1.5 block text-xs font-medium text-white/70"
								>
									Email address
								</label>

								<input
									id="register-email"
									type="email"
									value={email}
									onChange={(event) =>
										setEmail(event.target.value)
									}
									placeholder="you@example.com"
									required
									autoComplete="email"
									className="h-10 w-full rounded-lg border border-white/10 bg-black/25 px-3.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.07] focus:ring-2 focus:ring-white/5"
								/>
							</div>

							{/* Mobile */}
							<div>
								<label
									htmlFor="register-mobile"
									className="mb-1.5 block text-xs font-medium text-white/70"
								>
									Mobile number
									<span className="ml-1 text-white/25">
										(optional)
									</span>
								</label>

								<input
									id="register-mobile"
									type="tel"
									value={mobileNumber}
									onChange={(event) =>
										setMobileNumber(event.target.value)
									}
									placeholder="9876543210"
									autoComplete="tel"
									className="h-10 w-full rounded-lg border border-white/10 bg-black/25 px-3.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.07] focus:ring-2 focus:ring-white/5"
								/>
							</div>

							{/* Company */}
							<div>
								<label
									htmlFor="register-company"
									className="mb-1.5 block text-xs font-medium text-white/70"
								>
									Company name
								</label>

								<input
									id="register-company"
									type="text"
									value={companyName}
									onChange={(event) =>
										setCompanyName(event.target.value)
									}
									placeholder="Company name"
									required
									autoComplete="organization"
									className="h-10 w-full rounded-lg border border-white/10 bg-black/25 px-3.5 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.07] focus:ring-2 focus:ring-white/5"
								/>
							</div>

							{/* Password */}
							<div>
								<label
									htmlFor="register-password"
									className="mb-1.5 block text-xs font-medium text-white/70"
								>
									Password
								</label>

								<div className="relative">
									<input
										id="register-password"
										type={
											showPassword ? "text" : "password"
										}
										value={password}
										onChange={(event) =>
											setPassword(event.target.value)
										}
										placeholder="Minimum 8 characters"
										required
										minLength={8}
										autoComplete="new-password"
										className="h-10 w-full rounded-lg border border-white/10 bg-black/25 px-3.5 pr-11 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.07] focus:ring-2 focus:ring-white/5"
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
										className="absolute right-0 top-0 flex h-10 w-11 items-center justify-center text-white/35 transition hover:text-white/80"
									>
										{showPassword ? (
											<EyeOff className="h-4 w-4" />
										) : (
											<Eye className="h-4 w-4" />
										)}
									</button>
								</div>
							</div>

							{/* Confirm password */}
							<div>
								<label
									htmlFor="register-confirm-password"
									className="mb-1.5 block text-xs font-medium text-white/70"
								>
									Confirm password
								</label>

								<div className="relative">
									<input
										id="register-confirm-password"
										type={
											showConfirmPassword
												? "text"
												: "password"
										}
										value={confirmPassword}
										onChange={(event) =>
											setConfirmPassword(
												event.target.value,
											)
										}
										placeholder="Repeat your password"
										required
										minLength={8}
										autoComplete="new-password"
										className="h-10 w-full rounded-lg border border-white/10 bg-black/25 px-3.5 pr-11 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/30 focus:bg-white/[0.07] focus:ring-2 focus:ring-white/5"
									/>

									<button
										type="button"
										onClick={() =>
											setShowConfirmPassword(
												(value) => !value,
											)
										}
										aria-label={
											showConfirmPassword
												? "Hide password"
												: "Show password"
										}
										className="absolute right-0 top-0 flex h-10 w-11 items-center justify-center text-white/35 transition hover:text-white/80"
									>
										{showConfirmPassword ? (
											<EyeOff className="h-4 w-4" />
										) : (
											<Eye className="h-4 w-4" />
										)}
									</button>
								</div>
							</div>

							{/* Messages */}
							{(errorMessage || successMessage) && (
								<div className="md:col-span-2">
									{errorMessage && (
										<div className="rounded-lg border border-red-400/15 bg-red-500/10 px-3 py-2 text-xs text-red-300">
											{errorMessage}
										</div>
									)}

									{successMessage && (
										<div className="rounded-lg border border-emerald-400/15 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
											{successMessage}
										</div>
									)}
								</div>
							)}

							{/* Submit */}
							<div className="md:col-span-2">
								<button
									type="submit"
									disabled={loading}
									className="group flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
								>
									{loading ? (
										<>
											<span className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-black" />
											Creating account...
										</>
									) : (
										<>
											Create Account
											<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
										</>
									)}
								</button>
							</div>
						</form>

						{/* Login link */}
						<div className="mt-5 border-t border-white/10 pt-4 text-center">
							<p className="text-xs text-white/40">
								Already have an account?{" "}
								<Link
									href="/login"
									className="font-medium text-white/80 underline-offset-4 transition hover:text-white hover:underline"
								>
									Sign in
								</Link>
							</p>
						</div>
					</div>

					{/* Footer */}
					<p className="mt-3 text-center text-[9px] uppercase tracking-[0.2em] text-white/20">
						Virtual Event Experience
					</p>
				</div>
			</div>
		</main>
	);
}
