import type { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";

/**
 * Options for creating a D1 Prisma context.
 */
export type D1PrismaContextOptions = {
	/** The D1 database binding from Cloudflare Workers environment. */
	d1: D1Database;
};

/**
 * Factory type for creating a Prisma client with D1 adapter.
 * Users provide their own PrismaClient constructor configured for their schema.
 */
export type PrismaClientFactory<T extends PrismaClient> = (
	adapter: PrismaD1,
) => T;

/**
 * Creates a Prisma client configured with the D1 adapter.
 *
 * @example
 * ```typescript
 * import { PrismaClient } from "@prisma/client";
 * import { createD1PrismaContext } from "appflare/server/database";
 *
 * // In your Cloudflare Worker
 * const db = createD1PrismaContext(
 *   { d1: env.DB },
 *   (adapter) => new PrismaClient({ adapter })
 * );
 *
 * // Use Prisma as usual
 * const users = await db.user.findMany();
 * ```
 */
export function createD1PrismaContext<T extends PrismaClient>(
	options: D1PrismaContextOptions,
	prismaClientFactory: PrismaClientFactory<T>,
): T {
	const adapter = new PrismaD1(options.d1);
	return prismaClientFactory(adapter);
}

/**
 * Type helper for the D1 Prisma context.
 * This is the return type of createD1PrismaContext.
 */
export type D1PrismaContext<T extends PrismaClient = PrismaClient> = T;
