import { geo } from "appflare/location";
import { z } from "zod";
import { mutation, query, QueryContext } from "../_generated/src/schema-types";
import schema from "../_generated/src/schema";
const middleware = async (ctx: QueryContext, args: any) => {
	console.log("Context User:", ctx.user);
	if (!ctx.user) {
		throw ctx.error(401, "unauthorized");
	}
};
export const getTickets = query({
	args: {
		id: z.string().optional(),
	},
	middleware,
	handler: async (ctx, args) => {
		const result = await ctx.db.tickets.findMany({
			where: args.id ? { _id: args.id } : undefined,
			include: { roombas: true, user: true },
		});
		const res = await ctx.db.tickets.aggregate({
			avg: ["stock"],
			sum: ["stock"],
			where: {},
		});
		console.log("Aggregate Result:", res);
		return result;
	},
});

export const createTicket = mutation({
	args: schema.tickets.shape,
	handler: async (ctx, args) => {
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
				roombas: args.roombas ?? [],
				user: args.user || null,
				stock: 10,
				location: geo.point(-73.97, 40.77),
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
