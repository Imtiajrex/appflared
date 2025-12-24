import { z } from "zod";
import { mutation, query } from "./_generated/src/schema-types";

export const getTickets = query({
	args: {
		id: z.string().optional(),
	},
	handler: async (ctx, args) => {
		const tickets = await ctx.db
			.query("tickets")
			.populate("roombas")
			.populate("user")
			.where({})
			.find();

		return tickets;
	},
});

export const createTicket = mutation({
	args: {
		body: z.string(),
		user: z.string().optional(),
		roombas: z.array(z.string()).optional(),
	},
	handler: async (ctx, args) => {
		const roombas = args.roombas ?? [];
		const user = args.user
			? await ctx.db.query("users").where({ _id: args.user }).findOne()
			: null;

		if (args.user && !user) {
			throw new Error("User not found for the provided id");
		}

		const ticketId = await ctx.db.insert("tickets", {
			body: args.body,
			roombas,
			user: args.user || null,
		});

		if (user) {
			await ctx.db
				.update("users")
				.where({ _id: user._id })
				.set({
					tickets: Array.from(new Set([...(user.tickets ?? []), ticketId])),
				})
				.exec();
		}

		return ticketId;
	},
});
