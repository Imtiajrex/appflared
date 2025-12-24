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
		const owner = await ctx.db
			.query("users")
			.where({ _id: args.owner })
			.findOne();

		if (!owner) {
			throw new Error("Owner not found for the provided user id");
		}

		const roombaId = await ctx.db.insert("roombas", {
			model: args.model,
			owner: args.owner,
		});

		await ctx.db
			.update("users")
			.where({ _id: args.owner })
			.set({
				roombas: Array.from(new Set([...(owner.roombas ?? []), roombaId])),
			})
			.exec();

		return roombaId;
	},
});
