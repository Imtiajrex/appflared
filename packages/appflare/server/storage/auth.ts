import type {
	StorageAuthResult,
	StorageBaseContext,
	StorageRule,
} from "./types";

const allowAnonymous = <Principal>(): StorageAuthResult<Principal> => ({
	allow: true,
});

export async function authorizeRequest<Env, Principal>(
	ctx: StorageBaseContext<Env, Principal>,
	rule: StorageRule<Env, Principal>
): Promise<StorageAuthResult<Principal>> {
	return rule.authorize ? rule.authorize(ctx) : allowAnonymous<Principal>();
}
