import { z } from "zod";
import { mutation, query } from "./_generated/src/schema-types";
export const getUsers = query({
	args: {
		id: z.string().optional(),
		name: z.string().optional(),
	},
	handler: async (ctx, args) => {
		const where: Record<string, string | undefined> = {};
		if (args.name) where.name = args.name;
		if (args.id) where._id = args.id;

		return ctx.db.users.findMany({
			where,
			include: { roombas: true, tickets: true },
		});
	},
});

export const createUser = mutation({
	args: {
		name: z.string(),
	},
	handler: async (ctx, args) => {
		const User = await ctx.db.users.create({
			data: {
				name: args.name,
				roombas: [],
				tickets: [],
			},
		});

		return User;
	},
});

export const deleteUser = mutation({
	args: {
		id: z.string(),
	},
	handler: async (ctx, args) => {
		await ctx.db.users.delete({
			where: { _id: args.id },
		});

		return {
			success: true,
			message: "User deleted successfully",
		};
	},
});

export const updateUser = mutation({
	args: {
		id: z.string(),
		name: z.string().optional(),
	},
	handler: async (ctx, args) => {
		await ctx.db.users.update({
			where: { _id: args.id },
			data: {
				name: args.name,
			},
		});

		return {
			success: true,
			message: "User updated successfully",
		};
	},
});
