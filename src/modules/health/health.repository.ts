import { prisma } from "../../lib/prisma.js";

export const healthRepository = {
  async checkDatabase(): Promise<void> {
    await prisma.$queryRaw`SELECT 1`;
  },
};
