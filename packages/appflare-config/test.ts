import { z } from "zod";
import { mutation, query } from "./_generated/dist/schema-types";

export const getQuery = query({
	args: {
		test: z.string(),
	},
	handler: async (ctx, args) => {
		console.log("SECRET VALUE");
		const result = await ctx.db.query("messages").collect();
		return result;
	},
});

export const setMut = mutation({
	args: {
		id: z.string(),
		text: z.string(),
	},
	handler: async (ctx, args) => {
		// Dummy implementation
		await ctx.db.insert("messages", {
			body: args.text,
			user: args.id,
		});
		return { success: true };
	},
});
