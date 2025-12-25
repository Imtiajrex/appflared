"use client";
import { useQuery } from "appflare/react/index";
import React from "react";
import { api } from "../appflare-client";

export default function page() {
	const userQuery = useQuery(api.queries.user.getUserData, {
		realtime: true,
		args: {},
		queryOptions: {},
	});
	return (
		<div>
			<pre>{JSON.stringify(userQuery.data, null, 2)}</pre>
		</div>
	);
}
