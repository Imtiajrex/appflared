import { z } from "zod";
import { mutation, query } from "./_generated/src/schema-types";

export const getRoombas = query({
	args: {
		id: z.string().optional(),
	},
	handler: async (ctx, args) => {
		const userId = ctx?.user?.id;
		return ctx.db.roombas.findMany({
			where: args.id ? { _id: args.id } : undefined,
			include: { owner: true },
		});
	},
});

export const createRoomba = mutation({
	args: {
		model: z.string(),
		owner: z.string(),
	},
	handler: async (ctx, args) => {
		const owner = await ctx.db.users.findUnique({
			where: { _id: args.owner },
		});

		if (!owner) {
			throw new Error("Owner not found for the provided user id");
		}

		const roomba = await ctx.db.roombas.create({
			data: {
				model: args.model,
				owner: args.owner,
			},
		});

		await ctx.db.users.update({
			where: { _id: args.owner },
			data: {
				roombas: Array.from(new Set([...(owner.roombas ?? []), roomba?._id])),
			},
		});

		return roomba;
	},
});
