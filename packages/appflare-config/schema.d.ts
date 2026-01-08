declare const _default: {
    tickets: import("appflare").AppflareTable<{
        body: import("zod").ZodString;
        user: import("zod").ZodString;
        roombas: import("zod").ZodArray<import("zod").ZodType<unknown, unknown, import("better-auth").$ZodTypeInternals<unknown, unknown>>>;
        stock: import("zod").ZodDefault<import("zod").ZodNumber>;
        location: import("zod").ZodObject<{
            type: import("zod").ZodLiteral<"Point">;
            coordinates: import("zod").ZodTuple<[import("zod").ZodNumber, import("zod").ZodNumber], null>;
        }, import("better-auth").$strip>;
    }>;
    users: import("appflare").AppflareTable<{
        name: import("zod").ZodString;
        tickets: import("zod").ZodArray<import("zod").ZodType<unknown, unknown, import("better-auth").$ZodTypeInternals<unknown, unknown>>>;
        roombas: import("zod").ZodArray<import("zod").ZodType<unknown, unknown, import("better-auth").$ZodTypeInternals<unknown, unknown>>>;
    }>;
    roombas: import("appflare").AppflareTable<{
        model: import("zod").ZodString;
        owner: import("zod").ZodString;
    }>;
};
export default _default;
