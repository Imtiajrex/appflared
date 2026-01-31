"use client";

import { useState, type FormEvent } from "react";
import AppShell from "../components/app-shell";
import { api } from "../appflare-client";

function describeError(error: unknown) {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	return "Unexpected error";
}

export default function SignUpPage() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [name, setName] = useState("");
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setMessage(null);
		setError(null);
		const authClient = api.auth;
		if (!authClient) {
			setError(
				"Auth client is not configured. Enable Better Auth in appflare.config.ts.",
			);
			return;
		}
		setIsLoading(true);
		try {
			const result = await authClient.emailOtp;

			setMessage(
				result
					? "Sign up request submitted. Check email if verification is required."
					: "Sign up completed.",
			);
		} catch (err) {
			setError(describeError(err));
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<AppShell
			title="Sign up"
			subtitle="Submit the Better Auth email sign-up flow."
		>
			<section
				style={{
					display: "grid",
					gap: "12px",
					padding: "16px",
					borderRadius: "12px",
					border: "1px solid #1f2937",
					background: "#0b1220",
				}}
			>
				<form onSubmit={handleSubmit} style={{ display: "grid", gap: "12px" }}>
					<label style={{ display: "grid", gap: "6px" }}>
						<span style={{ color: "#cbd5e1", fontSize: "14px" }}>Email</span>
						<input
							required
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							style={{
								padding: "10px",
								borderRadius: "8px",
								border: "1px solid #1f2937",
								background: "#0f172a",
								color: "#e5e7eb",
							}}
						/>
					</label>
					<label style={{ display: "grid", gap: "6px" }}>
						<span style={{ color: "#cbd5e1", fontSize: "14px" }}>Password</span>
						<input
							required
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							style={{
								padding: "10px",
								borderRadius: "8px",
								border: "1px solid #1f2937",
								background: "#0f172a",
								color: "#e5e7eb",
							}}
						/>
					</label>
					<label style={{ display: "grid", gap: "6px" }}>
						<span style={{ color: "#cbd5e1", fontSize: "14px" }}>
							Name (optional)
						</span>
						<input
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							style={{
								padding: "10px",
								borderRadius: "8px",
								border: "1px solid #1f2937",
								background: "#0f172a",
								color: "#e5e7eb",
							}}
						/>
					</label>
					<button
						type="submit"
						disabled={isLoading}
						style={{
							padding: "12px",
							borderRadius: "10px",
							border: "1px solid #2563eb",
							background: isLoading ? "#1d4ed8" : "#2563eb",
							color: "white",
							fontWeight: 600,
							cursor: isLoading ? "not-allowed" : "pointer",
						}}
					>
						{isLoading ? "Signing up..." : "Sign up"}
					</button>
				</form>
				{message ? (
					<div style={{ color: "#bbf7d0", fontSize: "14px" }}>{message}</div>
				) : null}
				{error ? (
					<div style={{ color: "#fca5a5", fontSize: "14px" }}>
						Error: {error}
					</div>
				) : null}
			</section>
			<section
				style={{
					border: "1px solid #1f2937",
					borderRadius: "12px",
					padding: "16px",
					background: "#0f172a",
					display: "grid",
					gap: "8px",
					fontSize: "14px",
					color: "#d1d5db",
				}}
			>
				<div style={{ fontWeight: 700 }}>Notes</div>
				<ul style={{ display: "grid", gap: "6px", paddingLeft: "18px" }}>
					<li>
						The Better Auth router must be enabled in appflare.config.ts and
						configured in the backend for this flow to succeed.
					</li>
					<li>
						Sign up posts to /auth/sign-up/email using the shared
						createAuthClient instance.
					</li>
					<li>
						Check the backend logs if the adapter is missing or email delivery
						fails.
					</li>
				</ul>
			</section>
		</AppShell>
	);
}
