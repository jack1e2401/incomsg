const maxDatabaseInt = 2_147_483_647;

export function canReservePoints(input: { available: number; lifetime: number; reserved: number; requested: number }): boolean {
  return Number.isSafeInteger(input.requested) && input.requested >= 0 &&
    input.available + input.reserved + input.requested <= maxDatabaseInt &&
    input.lifetime + input.reserved + input.requested <= maxDatabaseInt;
}
