import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import { hashPassword } from "../src/lib/password.js";

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("ADMIN_EMAIL must be a valid email address");
  }
  if (!password || password.length < 12) {
    throw new Error("ADMIN_PASSWORD must have at least 12 characters");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== "ADMIN") throw new Error("ADMIN_EMAIL belongs to a non-admin user");
    console.info("Admin already exists; seed made no changes.");
    return;
  }

  await prisma.user.create({
    data: { email, passwordHash: await hashPassword(password), role: "ADMIN", isActive: true },
  });
  console.info("Admin created.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
