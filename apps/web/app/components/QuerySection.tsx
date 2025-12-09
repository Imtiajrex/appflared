"use client";

import { useState } from "react";
import { useUserQuery } from "../hooks";

type Status = "active" | "inactive";

export default function QuerySection() {
	const [userId, setUserId] = useState("user-123");
	const [minAge, setMinAge] = useState("");
	const [maxAge, setMaxAge] = useState("");
	const [status, setStatus] = useState<Status | "">("");

	const query = {
		userId: userId || undefined,
		minAge: minAge ? parseInt(minAge) : undefined,
		maxAge: maxAge ? parseInt(maxAge) : undefined,
		status: status as Status | undefined,
	};

	const { data, loading, error } = useUserQuery(query);

	return (
		<section
			style={{
				border: "1px solid #e5e5e5",
				borderRadius: "12px",
				padding: "16px",
				background: "linear-gradient(135deg, #f7f7ff, #fdfdfd)",
				boxShadow: "0 8px 24px rgba(0,0,0,0.05)",
			}}
		>
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: 12,
				}}
			>
				<h2 style={{ margin: 0, fontSize: 18 }}>Live query</h2>
				<span
					style={{
						fontSize: 13,
						color: loading ? "#555" : "#2f855a",
						fontWeight: 600,
					}}
				>
					{loading ? "Loading…" : "Live"}
				</span>
			</div>
			<div style={{ display: "grid", gap: "12px", marginBottom: 16 }}>
				<div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
					<label style={{ fontWeight: 600, minWidth: 60 }}>User ID</label>
					<input
						value={userId}
						onChange={(e) => setUserId(e.target.value)}
						placeholder="user-123"
						style={{
							padding: "10px 12px",
							border: "1px solid #ccc",
							borderRadius: "8px",
							flex: 1,
							fontSize: 16,
						}}
					/>
				</div>
				<div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
					<label style={{ fontWeight: 600, minWidth: 60 }}>Min Age</label>
					<input
						type="number"
						value={minAge}
						onChange={(e) => setMinAge(e.target.value)}
						placeholder="19"
						style={{
							padding: "10px 12px",
							border: "1px solid #ccc",
							borderRadius: "8px",
							flex: 1,
							fontSize: 16,
						}}
					/>
					<label style={{ fontWeight: 600, minWidth: 60 }}>Max Age</label>
					<input
						type="number"
						value={maxAge}
						onChange={(e) => setMaxAge(e.target.value)}
						placeholder="98"
						style={{
							padding: "10px 12px",
							border: "1px solid #ccc",
							borderRadius: "8px",
							flex: 1,
							fontSize: 16,
						}}
					/>
				</div>
				<div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
					<label style={{ fontWeight: 600, minWidth: 60 }}>Status</label>
					<select
						value={status}
						onChange={(e) => setStatus(e.target.value as Status | "")}
						style={{
							padding: "10px 12px",
							border: "1px solid #ccc",
							borderRadius: "8px",
							flex: 1,
							fontSize: 16,
						}}
					>
						<option value="">Any</option>
						<option value="active">Active</option>
						<option value="inactive">Inactive</option>
					</select>
				</div>
			</div>
			<pre
				style={{
					padding: 12,
					background: "#0f172a",
					color: "#e2e8f0",
					borderRadius: 10,
					fontSize: 13,
					minHeight: 120,
					overflowX: "auto",
				}}
			>
				{error
					? `Error: ${error}`
					: JSON.stringify(data ?? (loading ? "Loading" : []), null, 2)}
			</pre>
		</section>
	);
}
