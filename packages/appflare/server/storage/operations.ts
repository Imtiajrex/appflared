import type {
	StorageHttpMethod,
	StorageKeyContext,
	StorageRule,
} from "./types";
import type {
	R2Bucket,
	R2ObjectBody,
	R2PutOptions,
} from "@cloudflare/workers-types";

async function respondWithObject(
	object: R2ObjectBody,
	cacheControl: string,
	headOnly: boolean
): Promise<Response> {
	const headers = new Headers();
	if (object.httpEtag) headers.set("etag", object.httpEtag);
	if (object.size !== undefined)
		headers.set("content-length", `${object.size}`);
	if (object.httpMetadata?.contentType)
		headers.set("content-type", object.httpMetadata.contentType);
	headers.set("cache-control", cacheControl);
	return headOnly
		? new Response(null, { status: 200, headers })
		: new Response(object.body as any, { status: 200, headers });
}

type ResolvedPayload = {
	body: ArrayBuffer;
	size: number;
	contentType: string;
};

async function resolvePayload<Env, Principal>(
	ctx: StorageKeyContext<Env, Principal>,
	rule: StorageRule<Env, Principal>,
	cacheControl: string
): Promise<ResolvedPayload | Response> {
	const headerContentType = ctx.c.req.header("content-type") ?? "";
	const isMultipart = headerContentType
		.toLowerCase()
		.startsWith("multipart/form-data");

	if (isMultipart) {
		const form = await ctx.c.req.formData();
		let file: File | null = null;
		for (const value of form.values()) {
			if (value instanceof File) {
				file = value;
				break;
			}
		}
		if (!file) return ctx.c.json({ error: "No file found in form-data" }, 400);
		const body = await file.arrayBuffer();
		if (rule.maxSizeBytes && body.byteLength > rule.maxSizeBytes) {
			return ctx.c.json({ error: "Payload too large" }, 413);
		}
		const contentType =
			rule.contentType?.(ctx) ||
			file.type ||
			headerContentType ||
			"application/octet-stream";
		return { body, size: body.byteLength, contentType };
	}

	const body = await ctx.c.req.arrayBuffer();
	if (rule.maxSizeBytes && body.byteLength > rule.maxSizeBytes) {
		return ctx.c.json({ error: "Payload too large" }, 413);
	}
	const contentType =
		rule.contentType?.(ctx) || headerContentType || "application/octet-stream";
	return { body, size: body.byteLength, contentType };
}

async function handlePut<Env, Principal>(
	bucket: R2Bucket,
	key: string,
	ctx: StorageKeyContext<Env, Principal>,
	rule: StorageRule<Env, Principal>,
	cacheControl: string
): Promise<Response> {
	const payload = await resolvePayload(ctx, rule, cacheControl);
	if (payload instanceof Response) return payload;

	const putOptions: R2PutOptions = {
		httpMetadata: { contentType: payload.contentType, cacheControl },
	};
	await bucket.put(key, payload.body, putOptions);
	return ctx.c.json(
		{
			key,
			size: payload.size,
			contentType: payload.contentType,
			cacheControl,
		},
		201
	);
}

async function handleGet(
	bucket: R2Bucket,
	key: string,
	cacheControl: string,
	headOnly: boolean
): Promise<Response> {
	const object = await bucket.get(key);
	if (!object) return new Response(null, { status: 404 });
	return respondWithObject(object, cacheControl, headOnly);
}

async function handleDelete<Env, Principal>(
	bucket: R2Bucket,
	key: string,
	ctx: StorageKeyContext<Env, Principal>
): Promise<Response> {
	await bucket.delete(key);
	return ctx.c.json({ key, deleted: true }, 200);
}

export type OperationParams<Env, Principal> = {
	method: StorageHttpMethod;
	bucket: R2Bucket;
	key: string;
	cacheControl: string;
	ctx: StorageKeyContext<Env, Principal>;
	rule: StorageRule<Env, Principal>;
};

export async function executeOperation<Env, Principal>(
	params: OperationParams<Env, Principal>
): Promise<Response> {
	const { method, bucket, key, cacheControl, ctx, rule } = params;
	switch (method) {
		case "GET":
			return handleGet(bucket, key, cacheControl, false);
		case "HEAD":
			return handleGet(bucket, key, cacheControl, true);
		case "PUT":
		case "POST":
			return handlePut<Env, Principal>(bucket, key, ctx, rule, cacheControl);
		case "DELETE":
			return handleDelete(bucket, key, ctx);
		case "OPTIONS":
			return new Response(null, { status: 204 });
		default:
			return ctx.c.json({ error: "Method not allowed" }, 405);
	}
}
