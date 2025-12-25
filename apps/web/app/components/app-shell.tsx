"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PropsWithChildren } from "react";

const links = [
	{ href: "/", label: "Overview" },
	{ href: "/sign-up", label: "Sign up" },
	{ href: "/sign-in", label: "Sign in" },
	{ href: "/users", label: "Users" },
	{ href: "/storage", label: "Storage" },
];

type AppShellProps = PropsWithChildren<{
	title: string;
	subtitle?: string;
}>;

function isActive(pathname: string, href: string) {
	if (href === "/") return pathname === "/";
	return pathname.startsWith(href);
}

export function AppShell({ title, subtitle, children }: AppShellProps) {
	const pathname = usePathname();
	return (
		<div
			style={{
				minHeight: "100vh",
				background: "radial-gradient(circle at 20% 20%, #1b1b1b, #0b0b0b)",
				color: "#f5f5f5",
			}}
		>
			<header
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					padding: "16px 24px",
					borderBottom: "1px solid #202020",
					position: "sticky",
					top: 0,
					backdropFilter: "blur(10px)",
					background: "rgba(10, 10, 10, 0.8)",
					zIndex: 10,
				}}
			>
				<div style={{ fontWeight: 700, letterSpacing: "0.4px" }}>
					Appflare Playground
				</div>
				<nav style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
					{links.map((link) => {
						const active = isActive(pathname, link.href);
						return (
							<Link
								key={link.href}
								href={link.href}
								style={{
									padding: "8px 12px",
									borderRadius: "8px",
									background: active ? "#1f2937" : "transparent",
									border: active ? "1px solid #374151" : "1px solid #1f2937",
									color: active ? "#e5e7eb" : "#cbd5e1",
									fontSize: "14px",
									transition: "background 150ms ease, border-color 150ms ease",
								}}
							>
								{link.label}
							</Link>
						);
					})}
				</nav>
			</header>
			<main
				style={{
					maxWidth: 960,
					margin: "0 auto",
					padding: "32px 24px 64px",
					display: "grid",
					gap: "16px",
				}}
			>
				<section style={{ display: "grid", gap: "8px" }}>
					<h1 style={{ fontSize: "28px", fontWeight: 700 }}>{title}</h1>
					{subtitle ? (
						<p style={{ color: "#d1d5db", lineHeight: 1.6 }}>{subtitle}</p>
					) : null}
				</section>
				{children}
			</main>
		</div>
	);
}

export default AppShell;
