"use client";

import { useState } from "react";

const API_BASE =
	process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787";

export default function CreateSection() {
	const [userId, setUserId] = useState("");
	const [name, setName] = useState("");
	const [age, setAge] = useState("");

	const handleCreate = async () => {
		try {
			const res = await fetch(`${API_BASE}/mutations/create`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					userId,
					name,
					age: parseInt(age),
				}),
			});
			if (res.ok) {
				setUserId("");
				setName("");
				setAge("");
			} else {
				alert("Create failed");
			}
		} catch (e) {
			alert("Error");
		}
	};

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
			<h3 style={{ margin: 0, fontSize: 18 }}>Create User</h3>
			<div style={{ display: "flex", gap: "12px", marginTop: 12 }}>
				<input
					placeholder="User ID"
					value={userId}
					onChange={(e) => setUserId(e.target.value)}
					style={{
						padding: "10px 12px",
						border: "1px solid #ccc",
						borderRadius: "8px",
						flex: 1,
						fontSize: 16,
					}}
				/>
				<input
					placeholder="Name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					style={{
						padding: "10px 12px",
						border: "1px solid #ccc",
						borderRadius: "8px",
						flex: 1,
						fontSize: 16,
					}}
				/>
				<input
					placeholder="Age"
					type="number"
					value={age}
					onChange={(e) => setAge(e.target.value)}
					style={{
						padding: "10px 12px",
						border: "1px solid #ccc",
						borderRadius: "8px",
						flex: 1,
						fontSize: 16,
					}}
				/>
				<button
					onClick={handleCreate}
					style={{
						padding: "10px 16px",
						background: "#2f855a",
						color: "white",
						border: "none",
						borderRadius: "8px",
						fontSize: 16,
						cursor: "pointer",
					}}
				>
					Create
				</button>
			</div>
		</section>
	);
}
