import { defineSchema, defineTable } from "appflare/db";
import { v } from "appflare/values";
export default defineSchema({
    tickets: defineTable({
        body: v.string(),
        user: v.id("users"),
        roombas: v.array(v.id("roombas")),
        stock: v.number().default(0),
        location: v.point(),
    }),
    users: defineTable({
        name: v.string(),
        tickets: v.array(v.id("tickets")),
        roombas: v.array(v.id("roombas")),
    }),
    roombas: defineTable({
        model: v.string(),
        owner: v.id("users"),
    }),
});
