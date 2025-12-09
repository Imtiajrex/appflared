import { z } from 'zod';

export const userQuerySchema = z.object({
	userId: z.string().optional(),
	minAge: z.coerce.number().gt(18).lt(99).optional(),
	maxAge: z.coerce.number().gt(18).lt(99).optional(),
	status: z.enum(['active', 'inactive']).optional(),
});

export type UserQuery = z.infer<typeof userQuerySchema>;

export function buildUserFilter(query: UserQuery): Record<string, unknown> {
	const filter: Record<string, unknown> = {};
	if (query.userId) filter.userId = query.userId;
	if (query.minAge !== undefined || query.maxAge !== undefined) {
		filter.age = {};
		if (query.minAge !== undefined) (filter.age as any).$gte = query.minAge;
		if (query.maxAge !== undefined) (filter.age as any).$lte = query.maxAge;
	}
	if (query.status) filter.status = query.status;
	return filter;
}

export function parseUserQueryParams(params: URLSearchParams) {
	return userQuerySchema.safeParse({
		userId: params.get('userId') || undefined,
		minAge: params.get('minAge') ? Number(params.get('minAge')) : undefined,
		maxAge: params.get('maxAge') ? Number(params.get('maxAge')) : undefined,
		status: (params.get('status') as UserQuery['status']) ?? undefined,
	});
}

export function matchesUserQuery(query: UserQuery, document: Record<string, unknown>): boolean {
	if (!document) return false;
	if (query.userId && (document as { userId?: unknown }).userId !== query.userId) return false;

	const docAge = (document as { age?: number }).age;
	if (query.minAge !== undefined && (docAge === undefined || docAge < query.minAge)) return false;
	if (query.maxAge !== undefined && (docAge === undefined || docAge > query.maxAge)) return false;

	const docStatus = (document as { status?: unknown }).status;
	if (query.status && docStatus !== query.status) return false;

	return true;
}
