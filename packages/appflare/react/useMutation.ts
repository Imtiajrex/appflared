import {
	MutationKey,
	UseMutationOptions,
	UseMutationResult,
	useMutation as useNativeMutation,
} from "@tanstack/react-query";

export type Handler<TArgs, TResult> = {
	(args: TArgs, init?: RequestInit): Promise<TResult>;
	path?: string;
	schema?: unknown;
};

export type UseAppflareMutationOptions<
	TArgs,
	TResult,
	TError = unknown,
	TContext = unknown,
> = {
	handler: Handler<TArgs, TResult>;
	mutationKey?: MutationKey;
	mutationOptions?: Omit<
		UseMutationOptions<TResult, TError, TArgs, TContext>,
		"mutationFn" | "mutationKey"
	>;
};

export type UseAppflareMutationResult<
	TResult,
	TError = unknown,
	TArgs = unknown,
	TContext = unknown,
> = UseMutationResult<TResult, TError, TArgs, TContext>;

export function useMutation<
	TArgs,
	TResult,
	TError = unknown,
	TContext = unknown,
>(
	options: UseAppflareMutationOptions<TArgs, TResult, TError, TContext>
): UseAppflareMutationResult<TResult, TError, TArgs, TContext>;

export function useMutation<
	TArgs,
	TResult,
	TError = unknown,
	TContext = unknown,
>(
	handler: Handler<TArgs, TResult>,
	options?: Omit<
		UseAppflareMutationOptions<TArgs, TResult, TError, TContext>,
		"handler"
	>
): UseAppflareMutationResult<TResult, TError, TArgs, TContext>;

export function useMutation<
	TArgs,
	TResult,
	TError = unknown,
	TContext = unknown,
>(
	optionsOrHandler:
		| UseAppflareMutationOptions<TArgs, TResult, TError, TContext>
		| Handler<TArgs, TResult>,
	options?: Omit<
		UseAppflareMutationOptions<TArgs, TResult, TError, TContext>,
		"handler"
	>
): UseAppflareMutationResult<TResult, TError, TArgs, TContext> {
	const normalizedOptions =
		typeof optionsOrHandler === "function"
			? ({
					handler: optionsOrHandler,
					...(options ?? {}),
				} as UseAppflareMutationOptions<TArgs, TResult, TError, TContext>)
			: optionsOrHandler;

	const { handler, mutationKey, mutationOptions } = normalizedOptions;
	const finalMutationKey: MutationKey = mutationKey ?? [
		handler?.path ?? "appflare-handler",
	];

	return useNativeMutation<TResult, TError, TArgs, TContext>({
		mutationKey: finalMutationKey,
		mutationFn: (variables: TArgs) => handler(variables),
		...(mutationOptions ?? {}),
	});
}
