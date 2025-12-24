import { z } from "zod";
import { mutation, query } from "./_generated/src/schema-types";

export const getRoombas = query({
	args: {
		id: z.string().optional(),
	},
	handler: async (ctx, args) => {
		const Roombas = await ctx.db.query("roombas").populate("owner").find();

		return Roombas;
	},
});

export const createRoomba = mutation({
	args: {
		model: z.string(),
		owner: z.string(),
	},
	handler: async (ctx, args) => {
		const Roomba = await ctx.db.insert("roombas", {
			model: args.model,
			owner: args.owner,
		});

		return Roomba;
	},
});
