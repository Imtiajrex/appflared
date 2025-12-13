import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	tickets: defineTable({
		body: v.string(),
		user: v.id("users"),
	}),
	users: defineTable({
		name: v.string(),
		tickets: v.array(v.id("tickets")),
	}),
});
