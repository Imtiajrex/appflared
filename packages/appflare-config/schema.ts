import { defineSchema, defineTable } from "appflare/db";
import { v } from "appflare/values";

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
