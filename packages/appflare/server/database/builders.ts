export function createDeleteBuilder(params: any): any {
	return {
		where: () => ({
			exec: async () => {},
		}),
	};
}

export function createUpdateBuilder(params: any): any {
	return {
		where: () => ({
			set: () => ({
				exec: async () => {},
			}),
			exec: async () => {},
		}),
	};
}

export function createPatchBuilder(params: any): any {
	return createUpdateBuilder(params);
}
