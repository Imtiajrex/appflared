import { z } from "zod";
import { mutation, query } from "./_generated/src/schema-types";

export const getTickets = query({
	args: {
		id: z.string().optional(),
	},
	handler: async (ctx, args) => {
		const tickets = await ctx.db.query("tickets").where({}).find();

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
		const ticket = await ctx.db.insert("tickets", {
			body: args.body,
			roombas: args.roombas || [],
			user: args.user || null,
		});

		return ticket;
	},
});
