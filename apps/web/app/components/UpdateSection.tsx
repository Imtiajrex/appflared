"use client";

import { useState } from "react";

const API_BASE =
	process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787";

export default function UpdateSection() {
	const [userId, setUserId] = useState("");
	const [name, setName] = useState("");
	const [age, setAge] = useState("");

	const handleUpdate = async () => {
		const body: any = {};
		if (name) body.name = name;
		if (age) body.age = parseInt(age);
		try {
			const res = await fetch(`${API_BASE}/mutations/update/${userId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			if (res.ok) {
				setUserId("");
				setName("");
				setAge("");
			} else {
				alert("Update failed");
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
			<h3 style={{ margin: 0, fontSize: 18 }}>Update User</h3>
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
					onClick={handleUpdate}
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
					Update
				</button>
			</div>
		</section>
	);
}
