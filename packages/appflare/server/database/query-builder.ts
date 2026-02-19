export function createQueryBuilder(params: any): any {
	const api: any = {
		where() {
			return api;
		},
		sort() {
			return api;
		},
		limit() {
			return api;
		},
		offset() {
			return api;
		},
		select() {
			return api;
		},
		populate() {
			return api;
		},
		async find() {
			return [];
		},
		async findOne() {
			return null;
		},
	};
	return api;
}
