import { http } from "../_generated/src/schema-types";

export const stripeWebhook = http({
	handler: async(ctx,req)=>{
		return Response.json({
			ok: true
		})
	}
})