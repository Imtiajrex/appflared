import { z } from "zod";

export type GeoCoordinates = readonly [number, number];

export type GeoPoint = {
	type: "Point";
	coordinates: GeoCoordinates;
};

export const geoPointSchema = z
	.object({
		type: z.literal("Point"),
		coordinates: z.tuple([z.number(), z.number()]),
	})
	.describe("geo:point");

export const EARTH_RADIUS_METERS = 6_378_100;

const normalizePoint = (point: GeoPoint | GeoCoordinates): GeoPoint =>
	Array.isArray(point)
		? { type: "Point", coordinates: [point[0], point[1]] }
		: (point as GeoPoint);

export const point = (lng: number, lat: number): GeoPoint => ({
	type: "Point",
	coordinates: [lng, lat],
});

export type NearQueryOptions = {
	maxDistanceMeters?: number;
	minDistanceMeters?: number;
};

export const near = (
	field: string,
	geometry: GeoPoint | GeoCoordinates,
	options: NearQueryOptions = {}
): Record<string, unknown> => {
	const $near: Record<string, unknown> = {
		$geometry: normalizePoint(geometry),
	};
	if (options.maxDistanceMeters !== undefined) {
		$near.$maxDistance = options.maxDistanceMeters;
	}
	if (options.minDistanceMeters !== undefined) {
		$near.$minDistance = options.minDistanceMeters;
	}
	return { [field]: { $near } };
};

export const withinRadius = (
	field: string,
	center: GeoPoint | GeoCoordinates,
	radiusMeters: number
): Record<string, unknown> => ({
	[field]: {
		$geoWithin: {
			$centerSphere: [
				normalizePoint(center).coordinates,
				radiusMeters / EARTH_RADIUS_METERS,
			],
		},
	},
});

export const withinBox = (
	field: string,
	southwest: GeoPoint | GeoCoordinates,
	northeast: GeoPoint | GeoCoordinates
): Record<string, unknown> => ({
	[field]: {
		$geoWithin: {
			$box: [
				normalizePoint(southwest).coordinates,
				normalizePoint(northeast).coordinates,
			],
		},
	},
});

export const withinPolygon = (
	field: string,
	polygon: ReadonlyArray<GeoPoint | GeoCoordinates>
): Record<string, unknown> => ({
	[field]: {
		$geoWithin: {
			$polygon: polygon.map((p) => normalizePoint(p).coordinates),
		},
	},
});

export const intersects = (
	field: string,
	geometry: { type: string; coordinates: unknown }
): Record<string, unknown> => ({
	[field]: {
		$geoIntersects: {
			$geometry: geometry,
		},
	},
});

export const geo = {
	point,
	near,
	withinRadius,
	withinBox,
	withinPolygon,
	intersects,
};
