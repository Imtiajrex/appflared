"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "appflare/react";
import AppShell from "../components/app-shell";
import { api } from "../appflare-client";

function describeError(error: unknown) {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	return "Unexpected error";
}

export default function UsersPage() {
	const [nameFilter, setNameFilter] = useState("User 1");
	const [idFilter, setIdFilter] = useState("");
	const [realtimeEnabled, setRealtimeEnabled] = useState(true);
	const [status, setStatus] = useState<string | null>(null);
	const [renameDrafts, setRenameDrafts] = useState<Record<string, string>>({});

	const usersQuery = useQuery(api.queries.user.getUsers, {
		realtime: realtimeEnabled,
		args: {
			name: nameFilter,
			id: idFilter || undefined,
		},
		queryOptions: {
			enabled: Boolean(nameFilter || idFilter),
		},
	});

	const createUser = useMutation(api.mutations.user.createUser);
	const deleteUser = useMutation(api.mutations.user.deleteUser);
	const updateUser = useMutation(api.mutations.user.updateUser);

	const handleFilters = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		usersQuery.refetch();
	};

	const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setStatus(null);
		const formData = new FormData(event.currentTarget);
		const name = String(formData.get("name") ?? "").trim();
		if (!name) {
			setStatus("Name is required.");
			return;
		}
		try {
			await createUser.mutateAsync({ name });
			setStatus(`Created user "${name}".`);
			(event.currentTarget as HTMLFormElement).reset();
			await usersQuery.refetch();
		} catch (err) {
			setStatus(`Create failed: ${describeError(err)}`);
		}
	};

	const handleDelete = async (id?: string) => {
		if (!id) return;
		setStatus(null);
		try {
			await deleteUser.mutateAsync({ id });
			setStatus("User deleted.");
			await usersQuery.refetch();
		} catch (err) {
			setStatus(`Delete failed: ${describeError(err)}`);
		}
	};

	const handleRename = async (id?: string, currentName?: string) => {
		if (!id) return;
		const nextName = renameDrafts[id]?.trim() || currentName;
		if (!nextName) return;
		setStatus(null);
		try {
			await updateUser.mutateAsync({ id, name: nextName });
			setStatus("User updated.");
			setRenameDrafts((prev) => {
				const next = { ...prev };
				delete next[id];
				return next;
			});
			await usersQuery.refetch();
		} catch (err) {
			setStatus(`Update failed: ${describeError(err)}`);
		}
	};

	return (
		<AppShell
			title="Users"
			subtitle="Run queries and mutations against the user handlers."
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
				<form onSubmit={handleFilters} style={{ display: "grid", gap: "12px" }}>
					<div
						style={{
							display: "grid",
							gap: "8px",
							gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
						}}
					>
						<label style={{ display: "grid", gap: "6px" }}>
							<span style={{ color: "#cbd5e1", fontSize: "14px" }}>
								Name filter (required by handler)
							</span>
							<input
								required
								value={nameFilter}
								onChange={(e) => setNameFilter(e.target.value)}
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
								User id (optional)
							</span>
							<input
								value={idFilter}
								onChange={(e) => setIdFilter(e.target.value)}
								placeholder="65f..."
								style={{
									padding: "10px",
									borderRadius: "8px",
									border: "1px solid #1f2937",
									background: "#0f172a",
									color: "#e5e7eb",
								}}
							/>
						</label>
					</div>
					<div
						style={{
							display: "flex",
							gap: "8px",
							alignItems: "center",
							flexWrap: "wrap",
						}}
					>
						<button
							type="submit"
							style={{
								padding: "10px 12px",
								borderRadius: "8px",
								border: "1px solid #2563eb",
								background: "#2563eb",
								color: "white",
								fontWeight: 600,
							}}
						>
							Refetch
						</button>
						<label
							style={{
								display: "flex",
								gap: "8px",
								alignItems: "center",
								color: "#cbd5e1",
								fontSize: "14px",
							}}
						>
							<input
								type="checkbox"
								checked={realtimeEnabled}
								onChange={(e) => setRealtimeEnabled(e.target.checked)}
							/>
							<span>Enable realtime websocket updates</span>
						</label>
					</div>
				</form>
				<div style={{ display: "grid", gap: "10px" }}>
					<div style={{ fontWeight: 700 }}>Create user</div>
					<form
						onSubmit={handleCreate}
						style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
					>
						<input
							name="name"
							placeholder="New user name"
							style={{
								flex: 1,
								minWidth: 200,
								padding: "10px",
								borderRadius: "8px",
								border: "1px solid #1f2937",
								background: "#0f172a",
								color: "#e5e7eb",
							}}
						/>
						<button
							type="submit"
							style={{
								padding: "10px 12px",
								borderRadius: "8px",
								border: "1px solid #10b981",
								background: "#10b981",
								color: "#0b1220",
								fontWeight: 700,
							}}
						>
							Create
						</button>
					</form>
				</div>
				{status ? (
					<div style={{ color: "#cbd5e1", fontSize: "14px" }}>{status}</div>
				) : null}
			</section>

			<section
				style={{
					display: "grid",
					gap: "12px",
					padding: "16px",
					borderRadius: "12px",
					border: "1px solid #1f2937",
					background: "#0f172a",
				}}
			>
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
					}}
				>
					<div style={{ fontWeight: 700 }}>Query results</div>
					<div style={{ color: "#9ca3af", fontSize: "13px" }}>
						{usersQuery.isFetching ? "Loading..." : null}
					</div>
				</div>
				{usersQuery.error ? (
					<div style={{ color: "#fca5a5", fontSize: "14px" }}>
						Error: {describeError(usersQuery.error)}
					</div>
				) : null}
				{!usersQuery.data || usersQuery.data.length === 0 ? (
					<p style={{ color: "#9ca3af" }}>
						No users returned. Provide a matching name filter and refetch.
					</p>
				) : (
					<div
						style={{
							display: "grid",
							gap: "12px",
							gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
						}}
					>
						{usersQuery.data.map((user) => (
							<div
								key={user._id}
								style={{
									border: "1px solid #1f2937",
									borderRadius: "10px",
									padding: "12px",
									background: "#0b1220",
									display: "grid",
									gap: "8px",
								}}
							>
								<div style={{ fontWeight: 700 }}>{user.name}</div>
								<div style={{ color: "#9ca3af", fontSize: "13px" }}>
									{user._id}
								</div>
								<div style={{ color: "#cbd5e1", fontSize: "13px" }}>
									{user.tickets?.length ?? 0} tickets |{" "}
									{user.roombas?.length ?? 0} roombas
								</div>
								<label style={{ display: "grid", gap: "6px" }}>
									<span style={{ color: "#cbd5e1", fontSize: "13px" }}>
										Rename
									</span>
									<input
										value={renameDrafts[user._id] ?? ""}
										onChange={(e) =>
											setRenameDrafts((prev) => ({
												...prev,
												[user._id]: e.target.value,
											}))
										}
										placeholder={user.name}
										style={{
											padding: "8px",
											borderRadius: "8px",
											border: "1px solid #1f2937",
											background: "#0f172a",
											color: "#e5e7eb",
										}}
									/>
								</label>
								<div style={{ display: "flex", gap: "8px" }}>
									<button
										type="button"
										onClick={() => handleRename(user._id, user.name)}
										style={{
											flex: 1,
											padding: "8px",
											borderRadius: "8px",
											border: "1px solid #334155",
											background: "#111827",
											color: "#e5e7eb",
										}}
									>
										Update
									</button>
									<button
										type="button"
										onClick={() => handleDelete(user._id)}
										style={{
											padding: "8px",
											borderRadius: "8px",
											border: "1px solid #7f1d1d",
											background: "#991b1b",
											color: "white",
										}}
									>
										Delete
									</button>
								</div>
							</div>
						))}
					</div>
				)}
			</section>
		</AppShell>
	);
}
