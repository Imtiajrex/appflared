"use client";

import { createAppflareApi } from "appflare-config/_generated/src/api";
import { useMutation } from "appflare/react/useMutation";
import { useQuery } from "appflare/react/useQuery";

const api = createAppflareApi({
	baseUrl: "http://localhost:8787",
	realtime: {
		baseUrl: "ws://localhost:8787",
	},
});
export default function Page() {
	const result = useQuery(api.queries.user.getUsers, {
		realtime: {
			enabled: true,
		},
		args: {
			name: "User 1",
			id: undefined,
		},
	});
	const addUser = useMutation(api.mutations.user.createUser);

	return (
		<main
			style={{ display: "grid", gap: "16px", padding: "32px", maxWidth: 720 }}
		>
			{result.data?.map((data) => (
				<div
					key={data._id}
					style={{
						padding: "8px",
						border: "1px solid #4d4d4dff",
						borderRadius: "4px",
						backgroundColor: "#1b1b1bff",
					}}
				>
					{data._id} - {data.name} - {data.tickets?.length} tickets -{" "}
					{data.roombas?.length} roombas
				</div>
			))}
			<form
				onSubmit={async (e) => {
					e.preventDefault();
					const form = e.currentTarget.closest("form")!;
					const formData = new FormData(form);
					const name = formData.get("name") as string;
					await addUser.mutateAsync({ name });
					form.reset();
				}}
			>
				<input type="text" name="name" placeholder="Name" />
				<button type="submit">Add User</button>
			</form>
		</main>
	);
}
