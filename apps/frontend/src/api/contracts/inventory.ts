export interface InventorySummaryDto {
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
}

export interface InventoryMovementDto {
  id: number;
  movementType: string;
  quantityDelta: number;
  onHandBefore: number;
  onHandAfter: number;
  reservedBefore: number;
  reservedAfter: number;
  reason: string;
  actorId: number | null;
  actorEmail: string | null;
  createdAt: string;
}

export interface InventoryResponse {
  inventory: InventorySummaryDto;
  movements: InventoryMovementDto[];
}

export interface InventoryAdjustmentResponse {
  inventory: InventorySummaryDto;
  replayed: boolean;
}
