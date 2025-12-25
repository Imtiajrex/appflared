"use client";

import Link from "next/link";
import AppShell from "./components/app-shell";
import { appflareEndpoints } from "./appflare-client";

const cards = [
	{
		href: "/sign-up",
		title: "Sign up",
		description: "Create a user via Better Auth email flow.",
	},
	{
		href: "/sign-in",
		title: "Sign in",
		description: "Sign in, check session, and sign out.",
	},
	{
		href: "/users",
		title: "Users",
		description: "Query, create, update, and delete users.",
	},
	{
		href: "/storage",
		title: "Storage",
		description: "Exercise storage url/get/put/post/delete APIs.",
	},
];

export default function Page() {
	return (
		<AppShell
			title="Appflare demo kit"
			subtitle="A few focused pages to exercise Appflare auth, database handlers, and storage manager endpoints."
		>
			<section
				style={{
					display: "grid",
					gap: "12px",
					gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
				}}
			>
				{cards.map((card) => (
					<Link
						key={card.href}
						href={card.href}
						style={{
							padding: "16px",
							borderRadius: "12px",
							border: "1px solid #1f2937",
							background: "linear-gradient(145deg, #0f172a, #111827)",
							boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
							minHeight: 140,
							display: "grid",
							gap: "8px",
							alignContent: "start",
							transition: "transform 120ms ease, border-color 120ms ease",
						}}
						onMouseEnter={(e) =>
							(e.currentTarget.style.transform = "translateY(-2px)")
						}
						onMouseLeave={(e) =>
							(e.currentTarget.style.transform = "translateY(0)")
						}
					>
						<div style={{ fontWeight: 700, fontSize: "16px" }}>
							{card.title}
						</div>
						<p style={{ color: "#cbd5e1", lineHeight: 1.5 }}>
							{card.description}
						</p>
						<span style={{ fontSize: "12px", color: "#6b7280" }}>
							Open {card.href}
						</span>
					</Link>
				))}
			</section>
			<section
				style={{
					display: "grid",
					gap: "8px",
					padding: "16px",
					borderRadius: "12px",
					border: "1px solid #1f2937",
					background: "#0b1220",
				}}
			>
				<div style={{ fontWeight: 700 }}>Environment</div>
				<dl
					style={{
						display: "grid",
						gridTemplateColumns: "max-content 1fr",
						gap: "6px 12px",
						color: "#cbd5e1",
						fontSize: "14px",
					}}
				>
					<dt style={{ color: "#9ca3af" }}>API base</dt>
					<dd>{appflareEndpoints.baseUrl}</dd>
					<dt style={{ color: "#9ca3af" }}>Realtime</dt>
					<dd>{appflareEndpoints.realtimeUrl}</dd>
					<dt style={{ color: "#9ca3af" }}>Auth</dt>
					<dd>{appflareEndpoints.authUrl}</dd>
				</dl>
				<p style={{ color: "#9ca3af", fontSize: "13px" }}>
					Override with NEXT_PUBLIC_APPFLARE_BASE_URL,
					NEXT_PUBLIC_APPFLARE_REALTIME_URL, and NEXT_PUBLIC_APPFLARE_AUTH_URL.
				</p>
			</section>
		</AppShell>
	);
}
