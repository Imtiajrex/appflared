import { z } from "zod";
import {
	internalQuery,
	mutation,
	query,
	scheduler,
} from "./_generated/src/schema-types";
import { internal, runInternalMutation } from "./_generated/src/api";
export const getUsers = query({
	args: {
		id: z.string().optional(),
		name: z.string().optional(),
	},
	handler: async (ctx, args) => {
		const where: Record<string, string | undefined> = {};
		if (args.name) where.name = args.name;
		if (args.id) where._id = args.id;
		if (!ctx.user) {
			throw new Error("Unauthorized");
		}

		const users = ctx.db.users.findMany({
			where,
			include: { roombas: true, tickets: true },
		});

		await ctx.scheduler?.enqueue("user/sendEmail", {
			email: ctx.user.email,
			name: ctx.user.name,
		});

		return users;
	},
});
export const sendEmail = scheduler({
	args: {
		email: z.string().email().optional(),
		name: z.string().optional(),
	},
	handler: async (ctx, payload) => {
		console.log("Sending email to:", payload.email);
		// Simulate email sending logic here
	},
});
export const testSchedule = scheduler({
	handler: async (ctx, payload) => {
		console.log(payload);
		await ctx.db.users.update({
			where: { _id: "694e5166a780c80869606347" },
			data: { name: `Scheduled Update ${new Date().toISOString()}` },
		});
	},
});

// Test scheduler + enqueue helper to verify queue wiring.
export const enqueueTestSchedule = mutation({
	args: {
		userId: z.string().optional(),
		delaySeconds: z.number().int().nonnegative().optional(),
	},
	handler: async (ctx, args) => {
		await ctx.scheduler?.enqueue(
			"user/testSchedule",
			null,
			args.delaySeconds ? { delaySeconds: args.delaySeconds } : undefined
		);
		await ctx.scheduler.enqueue("user/sendEmail", {
			email: "rogersmith@gmail.com",
			name: "Roger Smith",
		});
		return { enqueued: true };
	},
});
export const getUserData = query({
	args: {},
	handler: async (ctx, args) => {
		return ctx.user;
	},
});
export const getAllUsers = query({
	args: {},
	handler: async (ctx, args) => {
		const users = ctx.db.users.findMany({});

		return users;
	},
});
export const getInternalUserCount = internalQuery({
	args: {
		test: z.string().optional(),
	},
	handler: async (ctx, args) => {
		const count = await ctx.db.users.count({});
		return count;
	},
});
export const createUser = mutation({
	args: {
		name: z.string(),
	},
	handler: async (ctx, args) => {
		const count = await runInternalMutation(ctx, getInternalUserCount, {
			test: "testing",
		});
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
