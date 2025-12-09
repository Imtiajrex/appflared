"use client";

import QuerySection from "./components/QuerySection";
import CreateSection from "./components/CreateSection";
import UpdateSection from "./components/UpdateSection";
import DeleteSection from "./components/DeleteSection";

export default function Page() {
	return (
		<main
			style={{ display: "grid", gap: "16px", padding: "32px", maxWidth: 720 }}
		>
			<QuerySection />
			<CreateSection />
			<UpdateSection />
			<DeleteSection />
		</main>
	);
}
