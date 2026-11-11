import { healthRepository } from "./health.repository.js";

export const healthService = {
  getStatus() {
    return { status: "ok" as const };
  },
  async getDatabaseStatus() {
    await healthRepository.checkDatabase();
    return { status: "ok" as const, database: "connected" as const };
  },
};
