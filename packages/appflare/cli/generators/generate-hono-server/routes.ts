import type { DiscoveredHandler } from "../../utils/utils";

export function buildRouteLines(params: {
	queries: DiscoveredHandler[];
	mutations: DiscoveredHandler[];
	localNameFor: (handler: DiscoveredHandler) => string;
}): string[] {
	const routeLines: string[] = [];
	for (const query of params.queries) {
		const local = params.localNameFor(query);
		routeLines.push(
			`app.get(\n` +
				`	${JSON.stringify(`/queries/${query.routePath}/${query.name}`)},\n` +
				`\tsValidator("query", z.object(${local}.args as any)),\n` +
				`\tasync (c) => {\n` +
				`\t\ttry {\n` +
				`\t\t\tconst query = c.req.valid("query");\n` +
				`\t\t\tconst ctx = await resolveContext(c);\n` +
				`\t\t\tconst result = await runHandlerWithMiddleware(\n` +
				`\t\t\t\t${local} as any,\n` +
				`\t\t\t\tctx as any,\n` +
				`\t\t\t\tquery as any\n` +
				`\t\t\t);\n` +
				`\t\t\tif (isHandlerError(result)) {\n` +
				`\t\t\t\tconst { status, body } = formatHandlerError(result);\n` +
				`\t\t\t\treturn c.json(body as any, status);\n` +
				`\t\t\t}\n` +
				`\t\t\treturn c.json(result, 200);\n` +
				`\t\t} catch (err) {\n` +
				`\t\t\tconst { status, body } = formatHandlerError(err);\n` +
				`\t\t\tconsole.error("Appflare query handler error", err);\n` +
				`\t\t\treturn c.json(body as any, status);\n` +
				`\t\t}\n` +
				`\t}\n` +
				`);`
		);
	}
	for (const mutation of params.mutations) {
		const local = params.localNameFor(mutation);
		routeLines.push(
			`app.post(\n` +
				`\t${JSON.stringify(`/mutations/${mutation.routePath}/${mutation.name}`)},\n` +
				`\tsValidator("json", z.object(${local}.args as any)),\n` +
				`\tasync (c) => {\n` +
				`\t\ttry {\n` +
				`\t\t\tconst body = c.req.valid("json");\n` +
				`\t\t\tconst ctx = await resolveContext(c);\n` +
				`\t\t\tconst result = await runHandlerWithMiddleware(\n` +
				`\t\t\t\t${local} as any,\n` +
				`\t\t\t\tctx as any,\n` +
				`\t\t\t\tbody as any\n` +
				`\t\t\t);\n` +
				`\t\t\tif (isHandlerError(result)) {\n` +
				`\t\t\t\tconst { status, body } = formatHandlerError(result);\n` +
				`\t\t\t\treturn c.json(body as any, status);\n` +
				`\t\t\t}\n` +
				`\t\t\tif (notifyMutation) {\n` +
				`\t\t\t\ttry {\n` +
				`\t\t\t\t\tawait notifyMutation({\n` +
				`\t\t\t\t\t table: normalizeTableName(${JSON.stringify(mutation.fileName)}),\n` +
				`\t\t\t\t\t handler: { file: ${JSON.stringify(mutation.routePath)}, name: ${JSON.stringify(mutation.name)} },\n` +
				`\t\t\t\t\t args: body,\n` +
				`\t\t\t\t\t result,\n` +
				`\t\t\t\t});\n` +
				`\t\t\t\t} catch (err) {\n` +
				`\t\t\t\t\tconsole.error("Appflare realtime notification failed", err);\n` +
				`\t\t\t\t}\n` +
				`\t\t\t}\n` +
				`\t\t\treturn c.json(result, 200);\n` +
				`\t\t} catch (err) {\n` +
				`\t\t\tconst { status, body } = formatHandlerError(err);\n` +
				`\t\t\tconsole.error("Appflare mutation handler error", err);\n` +
				`\t\t\treturn c.json(body as any, status);\n` +
				`\t\t}\n` +
				`\t}\n` +
				`);`
		);
	}
	return routeLines;
}
