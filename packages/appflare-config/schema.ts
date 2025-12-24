import { defineSchema, defineTable } from "appflare/db";
import { v } from "appflare/values";

export default defineSchema({
	tickets: defineTable({
		body: v.string(),
		user: v.id("users"),
		roombas: v.array(v.id("roombas")),
	}),
	users: defineTable({
		name: v.string(),
		tickets: v.array(v.id("tickets")).optional(),
		roombas: v.array(v.id("roombas")).optional(),
	}),
	roombas: defineTable({
		model: v.string(),
		owner: v.id("users"),
	}),
});
