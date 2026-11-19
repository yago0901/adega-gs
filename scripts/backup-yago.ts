import "dotenv/config";
import { writeFileSync } from "fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL não configurada");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: { equals: "yago", mode: "insensitive" } },
        { email: { contains: "yago", mode: "insensitive" } },
        { displayUsername: { equals: "yago", mode: "insensitive" } },
      ],
    },
    include: {
      accounts: true,
      accesses: true,
    },
  });

  if (!user) {
    console.log("USER_NOT_FOUND");
    const all = await prisma.user.findMany({
      select: { id: true, username: true, email: true, role: true },
    });
    console.log(JSON.stringify(all, null, 2));
    return;
  }

  const payload = {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      active: user.active,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      username: user.username,
      displayUsername: user.displayUsername,
      role: user.role,
    },
    accounts: user.accounts,
    accesses: user.accesses,
  };

  writeFileSync("scripts/.yago-backup.json", JSON.stringify(payload, null, 2));
  console.log(
    "BACKED_UP",
    user.username,
    user.email,
    user.id,
    "accounts",
    user.accounts.length,
    "accesses",
    user.accesses.length,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
