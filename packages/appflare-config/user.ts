import { z } from "zod";
import { mutation, query } from "./_generated/src/schema-types";

export const getUsers = query({
	args: {
		id: z.string().optional(),
	},
	handler: async (ctx, args) => {
		const Users = await ctx.db.query("users").populate("roombas").find();

		return Users;
	},
});

export const createUser = mutation({
	args: {
		name: z.string(),
	},
	handler: async (ctx, args) => {
		const User = await ctx.db.insert("users", {
			name: args.name,
		});

		return User;
	},
});

export const deleteUser = mutation({
	args: {
		id: z.string().optional(),
	},
	handler: async (ctx, args) => {
		await ctx.db
			.delete("users")
			.where({
				_id: args.id,
			})
			.exec();

		return {
			success: true,
			message: "User deleted successfully",
		};
	},
});

export const updateUser = mutation({
	args: {
		id: z.string().optional(),
		name: z.string().optional(),
	},
	handler: async (ctx, args) => {
		await ctx.db
			.update("users")
			.where({
				_id: args.id,
			})
			.set({
				name: args.name,
			})
			.exec();

		return {
			success: true,
			message: "User updated successfully",
		};
	},
});
