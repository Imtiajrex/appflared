import { z } from "zod";
import { mutation, query } from "./_generated/src/schema-types";

export const getTickets = query({
	args: {
		id: z.string().optional(),
	},
	handler: async (ctx, args) => {
		const result = await ctx.db.tickets.findMany({
			where: args.id ? { _id: args.id } : undefined,
			include: { roombas: true, user: true },
		});
		const res = await ctx.db.tickets.aggregate({
			avg: ["stock"],
			sum: ["stock"],
		});
		console.log("Aggregate Result:", res);
		return result;
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
			? await ctx.db.users.findUnique({
					where: { _id: args.user },
				})
			: null;

		if (args.user && !user) {
			throw new Error("User not found for the provided id");
		}

		const ticket = await ctx.db.tickets.create({
			data: {
				body: args.body,
				roombas,
				user: args.user || null,
				stock: 10,
			},
		});

		if (user) {
			await ctx.db.users.update({
				where: { _id: user._id },
				data: {
					tickets: [...(user.tickets ?? []), ticket?._id],
				},
			});
		}

		return ticket;
	},
});
