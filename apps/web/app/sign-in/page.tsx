"use client";

import { useState, type FormEvent } from "react";
import AppShell from "../components/app-shell";
import { api } from "../appflare-client";

function describeError(error: unknown) {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	return "Unexpected error";
}

export default function SignInPage() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [message, setMessage] = useState<string | null>(null);
	const [session, setSession] = useState<unknown>(null);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	const authClient = api.auth as any;

	const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setMessage(null);
		setError(null);
		if (!authClient) {
			setError(
				"Auth client is not configured. Enable Better Auth in appflare.config.ts."
			);
			return;
		}
		setIsLoading(true);
		try {
			const result = await authClient.signIn?.email({ email, password });
			setMessage(result ? "Sign in succeeded." : "Sign in completed.");
		} catch (err) {
			setError(describeError(err));
		} finally {
			setIsLoading(false);
		}
	};

	const handleSession = async () => {
		setError(null);
		if (!authClient) {
			setError("Auth client is not configured.");
			return;
		}
		try {
			const response = await authClient.getSession?.();
			setSession(response ?? null);
			setMessage("Session refreshed.");
		} catch (err) {
			setError(describeError(err));
		}
	};

	const handleSignOut = async () => {
		setError(null);
		if (!authClient) {
			setError("Auth client is not configured.");
			return;
		}
		try {
			await authClient.signOut?.();
			setMessage("Signed out.");
			setSession(null);
		} catch (err) {
			setError(describeError(err));
		}
	};

	return (
		<AppShell
			title="Sign in"
			subtitle="Run the email sign-in flow, read the session, and sign out."
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
				<form onSubmit={handleSignIn} style={{ display: "grid", gap: "12px" }}>
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
						{isLoading ? "Signing in..." : "Sign in"}
					</button>
				</form>
				<div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
					<button
						type="button"
						onClick={handleSession}
						style={{
							padding: "10px 12px",
							borderRadius: "8px",
							border: "1px solid #334155",
							background: "#111827",
							color: "#e5e7eb",
						}}
					>
						Get session
					</button>
					<button
						type="button"
						onClick={handleSignOut}
						style={{
							padding: "10px 12px",
							borderRadius: "8px",
							border: "1px solid #334155",
							background: "#111827",
							color: "#e5e7eb",
						}}
					>
						Sign out
					</button>
				</div>
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
					display: "grid",
					gap: "8px",
					padding: "16px",
					borderRadius: "12px",
					border: "1px solid #1f2937",
					background: "#0f172a",
					fontSize: "14px",
					color: "#d1d5db",
				}}
			>
				<div style={{ fontWeight: 700 }}>Session payload</div>
				{session ? (
					<pre
						style={{
							background: "#0b0f1a",
							border: "1px solid #1f2937",
							borderRadius: "8px",
							padding: "12px",
							whiteSpace: "pre-wrap",
							wordBreak: "break-word",
						}}
					>
						{JSON.stringify(session, null, 2)}
					</pre>
				) : (
					<p style={{ color: "#9ca3af" }}>
						Call "Get session" after a successful sign-in.
					</p>
				)}
			</section>
		</AppShell>
	);
}
