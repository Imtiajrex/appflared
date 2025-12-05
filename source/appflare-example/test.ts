import { v } from '../appflare/db';
import { query } from './_generated/dist/schema-types';

export const getQuery = query({
	args: {
		test: v.string(),
	},
	handler: async (ctx, args) => {
		const result = await ctx.db.query('messages').collect();
		console.log('Test arg:', args.test);
		return `Hello, ${args.test}!`;
	},
});
