import type {
	StorageAuthResult,
	StorageBaseContext,
	StorageRule,
} from "./types";

const allowAnonymous: () => StorageAuthResult = () => ({ allow: true });

export async function authorizeRequest<Env, Principal>(
	ctx: StorageBaseContext<Env, Principal>,
	rule: StorageRule<Env, Principal>
): Promise<StorageAuthResult<Principal>> {
	return rule.authorize ? rule.authorize(ctx) : allowAnonymous();
}
