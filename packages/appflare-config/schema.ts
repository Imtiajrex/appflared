import { defineSchema, defineTable, v } from "../appflare/db";

export default defineSchema({
	messages: defineTable({
		body: v.string(),
		user: v.id("users"),
	}),
	users: defineTable({
		name: v.string(),
		tokenIdentifier: v.string(),
	}),
	demo: defineTable({
		title: v.string(),
		description: v.string().optional(),
	}),
});
