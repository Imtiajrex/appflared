import { z } from "zod";
import { mutation, query } from "./_generated/src/schema-types";

export const getQuery = query({
	args: {
		test: z.string(),
	},
	handler: async (ctx, args) => {
		console.log("SECRET VALUE");
		const result = await ctx.db
			.query("tickets")
			.where({
				body: args.test,
			})
			.populate("user")
			.populate("roombas")
			.sort({
				body: "asc",
			})
			.select(["body", "roombas"])
			.find();
		return result;
	},
});

export const setMut = mutation({
	args: {
		id: z.string(),
		text: z.string(),
	},
	handler: async (ctx, args) => {
		await ctx.db.insert("tickets", {
			body: args.text,
			user: args.id,
			roombas: ["roomba1", "roomba2"],
		});
		return { success: true };
	},
});
