import { z } from "zod";

export type AppflareTable<TShape extends Record<string, z.ZodTypeAny>> =
	z.ZodObject<TShape>;

export type AppflareSchema<TTables extends Record<string, AppflareTable<any>>> =
	TTables;

export function defineTable<TShape extends Record<string, z.ZodTypeAny>>(
	shape: TShape
): AppflareTable<TShape> {
	return z.object(shape);
}

export function defineSchema<
	TTables extends Record<string, AppflareTable<any>>,
>(tables: TTables): AppflareSchema<TTables> {
	return tables;
}
