import { maxPoints, points, type PointValue } from "./loyalty.calculation.js";

export function canReservePoints(input: { available: PointValue; lifetime: PointValue; reserved: PointValue; requested: PointValue }): boolean {
  const available = points(input.available), lifetime = points(input.lifetime);
  const reserved = points(input.reserved), requested = points(input.requested);
  return [available, lifetime, reserved, requested].every((value) => value.isFinite()) && !reserved.isNegative() && !requested.isNegative() &&
    available.plus(reserved).plus(requested).lessThanOrEqualTo(maxPoints) &&
    lifetime.plus(reserved).plus(requested).lessThanOrEqualTo(maxPoints);
}
