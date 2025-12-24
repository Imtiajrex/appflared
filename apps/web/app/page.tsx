"use client";

import QuerySection from "./components/QuerySection";
import CreateSection from "./components/CreateSection";
import UpdateSection from "./components/UpdateSection";
import DeleteSection from "./components/DeleteSection";
import { createAppflareApi } from "appflare-config/_generated/src/api";
import { useQuery, useMutation } from "appflare/react/index";

const api = createAppflareApi({
	baseUrl: "http://localhost:8787",
	realtime: {
		baseUrl: "ws://localhost:8787",
	},
});
export default function Page() {
	const schema = api.queries.user.getUsers.schema;
	const result = useQuery(api.queries.user.getUsers, {
		realtime: {
			enabled: true,
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
					{data._id} - {data.name} - {data.tickets.length} tickets -{" "}
					{data.roombas.length} roombas
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
