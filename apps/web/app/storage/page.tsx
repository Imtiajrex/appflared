"use client";

import AppShell from "../components/app-shell";
import { StorageManagerDemo } from "../components/storage-tester";
import { api, appflareEndpoints } from "../appflare-client";

export default function StoragePage() {
	return (
		<AppShell
			title="Storage manager"
			subtitle="Exercise the storage routes with url/get/put/post/delete helpers."
		>
			<StorageManagerDemo storage={api.storage} />
			<section
				style={{
					display: "grid",
					gap: "8px",
					padding: "16px",
					borderRadius: "12px",
					border: "1px solid #1f2937",
					background: "#0f172a",
					color: "#d1d5db",
					fontSize: "14px",
				}}
			>
				<div style={{ fontWeight: 700 }}>Notes</div>
				<ul style={{ display: "grid", gap: "6px", paddingLeft: "18px" }}>
					<li>
						Uploads target {appflareEndpoints.baseUrl}/storage by default.
					</li>
					<li>
						Adjust paths to hit rule-based routes such as /readonly, /json, or
						/users/:userId.
					</li>
					<li>
						Use the file toggle to POST/PUT FormData; otherwise raw text is sent
						with the provided content-type.
					</li>
				</ul>
			</section>
		</AppShell>
	);
}
