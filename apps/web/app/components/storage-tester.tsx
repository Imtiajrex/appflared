"use client";

import { useMemo, useState } from "react";
import type { StorageManagerClient } from "appflare-config/_generated/src/api";

type Props = {
	storage: StorageManagerClient;
};

type Method = "url" | "get" | "put" | "post" | "delete";

const DEFAULT_BODY = JSON.stringify({ hello: "world" }, null, 2);

function prettyPrintJson(text: string): string {
	try {
		return JSON.stringify(JSON.parse(text), null, 2);
	} catch {
		return text;
	}
}

function describeError(error: unknown): string {
	return error instanceof Error ? error.message : "Unexpected error";
}

async function describeResponse(response: Response): Promise<string> {
	const contentType = response.headers.get("content-type") ?? "";
	const bodyText = await response.text();
	const renderedBody =
		contentType.includes("application/json") && bodyText
			? prettyPrintJson(bodyText)
			: bodyText || "(empty body)";
	return `Status: ${response.status}\n${renderedBody}`;
}

export function StorageManagerDemo({ storage }: Props) {
	const [path, setPath] = useState("demo.json");
	const [contentType, setContentType] = useState("application/json");
	const [body, setBody] = useState(DEFAULT_BODY);
	const [output, setOutput] = useState<string>();
	const [error, setError] = useState<string>();
	const [isLoading, setIsLoading] = useState(false);
	const [file, setFile] = useState<File | null>(null);
	const [useFilePayload, setUseFilePayload] = useState(false);

	const urlPreview = useMemo(() => storage.url(path || "/"), [path, storage]);

	const buildPayload = () => {
		if (useFilePayload) {
			if (!file) {
				throw new Error("Select a file before uploading");
			}
			const formData = new FormData();
			formData.append("file", file);
			return { payload: formData as BodyInit, headers: undefined };
		}

		const normalizedContentType = contentType.trim();
		const headers = normalizedContentType
			? { "content-type": normalizedContentType }
			: undefined;
		return { payload: body, headers };
	};

	const handleAction = async (method: Method) => {
		setIsLoading(true);
		setError(undefined);
		setOutput(undefined);
		try {
			switch (method) {
				case "url": {
					setOutput(urlPreview);
					break;
				}
				case "get": {
					const response = await storage.get(path);
					setOutput(await describeResponse(response));
					break;
				}
				case "delete": {
					const result = await storage.delete(path);
					setOutput(JSON.stringify(result, null, 2));
					break;
				}
				case "put": {
					const { payload, headers } = buildPayload();
					const result = await storage.put(path, payload, { headers });
					setOutput(JSON.stringify(result, null, 2));
					break;
				}
				case "post": {
					const { payload, headers } = buildPayload();
					const result = await storage.post(path, payload, { headers });
					setOutput(JSON.stringify(result, null, 2));
					break;
				}
				default: {
					setError("Unsupported action");
				}
			}
		} catch (err) {
			setError(describeError(err));
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<section
			style={{
				display: "grid",
				gap: "12px",
				padding: "16px",
				border: "1px solid #2f2f2f",
				borderRadius: "8px",
				background: "#111",
			}}
		>
			<header style={{ display: "flex", justifyContent: "space-between" }}>
				<div>
					<div style={{ fontWeight: 600 }}>Storage playground</div>
					<div style={{ color: "#9ca3af", fontSize: "12px" }}>
						Exercises api.storage url/get/post/put/delete
					</div>
				</div>
				<div style={{ fontSize: "12px", color: "#9ca3af" }}>
					Base url: {urlPreview}
				</div>
			</header>
			<label style={{ display: "grid", gap: "4px" }}>
				<span style={{ fontSize: "12px", color: "#9ca3af" }}>Path</span>
				<input
					value={path}
					onChange={(e) => setPath(e.target.value)}
					placeholder="demo.json"
					style={{ padding: "8px", background: "#1b1b1b", color: "#fff" }}
				/>
			</label>
			<label style={{ display: "flex", gap: "8px", alignItems: "center" }}>
				<input
					type="checkbox"
					checked={useFilePayload}
					onChange={(e) => setUseFilePayload(e.target.checked)}
				/>
				<span style={{ fontSize: "12px", color: "#9ca3af" }}>
					Use file as payload for post/put
				</span>
			</label>
			{useFilePayload ? (
				<label style={{ display: "grid", gap: "4px" }}>
					<span style={{ fontSize: "12px", color: "#9ca3af" }}>File</span>
					<input
						type="file"
						onChange={(e) => setFile(e.target.files?.[0] ?? null)}
						style={{ color: "#fff" }}
					/>
					<div style={{ fontSize: "12px", color: "#9ca3af" }}>
						{file
							? `${file.name} (${file.type || "unknown"}, ${file.size} bytes)`
							: "No file selected"}
					</div>
				</label>
			) : (
				<>
					<label style={{ display: "grid", gap: "4px" }}>
						<span style={{ fontSize: "12px", color: "#9ca3af" }}>
							Content-Type (post/put)
						</span>
						<input
							value={contentType}
							onChange={(e) => setContentType(e.target.value)}
							placeholder="application/json"
							style={{ padding: "8px", background: "#1b1b1b", color: "#fff" }}
						/>
					</label>
					<label style={{ display: "grid", gap: "4px" }}>
						<span style={{ fontSize: "12px", color: "#9ca3af" }}>Body</span>
						<textarea
							value={body}
							onChange={(e) => setBody(e.target.value)}
							rows={5}
							style={{ padding: "8px", background: "#1b1b1b", color: "#fff" }}
						/>
					</label>
				</>
			)}
			<div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
				<button onClick={() => handleAction("url")} disabled={isLoading}>
					url()
				</button>
				<button onClick={() => handleAction("get")} disabled={isLoading}>
					get()
				</button>
				<button onClick={() => handleAction("post")} disabled={isLoading}>
					post()
				</button>
				<button onClick={() => handleAction("put")} disabled={isLoading}>
					put()
				</button>
				<button onClick={() => handleAction("delete")} disabled={isLoading}>
					delete()
				</button>
			</div>
			{isLoading && (
				<div style={{ color: "#9ca3af", fontSize: "12px" }}>Working...</div>
			)}
			{error && (
				<div style={{ color: "#fca5a5", fontSize: "12px" }}>Error: {error}</div>
			)}
			{output && (
				<pre
					style={{
						background: "#0b0b0b",
						padding: "12px",
						borderRadius: "6px",
						whiteSpace: "pre-wrap",
						wordBreak: "break-word",
						border: "1px solid #2f2f2f",
					}}
				>
					{output}
				</pre>
			)}
		</section>
	);
}

export default StorageManagerDemo;
