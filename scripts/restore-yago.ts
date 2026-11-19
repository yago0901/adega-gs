import "dotenv/config";
import { readFileSync } from "fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole, Module } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL não configurada");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

type Backup = {
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image: string | null;
    active: boolean;
    createdAt: string;
    updatedAt: string;
    username: string | null;
    displayUsername: string | null;
    role: UserRole;
  };
  accounts: Array<{
    id: string;
    accountId: string;
    providerId: string;
    userId: string;
    accessToken: string | null;
    refreshToken: string | null;
    idToken: string | null;
    accessTokenExpiresAt: string | null;
    refreshTokenExpiresAt: string | null;
    scope: string | null;
    password: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  accesses: Array<{
    id: string;
    module: Module;
    canManageCashRegister: boolean;
    userId: string;
  }>;
};

async function main() {
  const backup = JSON.parse(
    readFileSync("scripts/.yago-backup.json", "utf8"),
  ) as Backup;

  await prisma.user.create({
    data: {
      id: backup.user.id,
      name: backup.user.name,
      email: backup.user.email,
      emailVerified: backup.user.emailVerified,
      image: backup.user.image,
      active: backup.user.active,
      createdAt: new Date(backup.user.createdAt),
      updatedAt: new Date(backup.user.updatedAt),
      username: backup.user.username,
      displayUsername: backup.user.displayUsername,
      role: backup.user.role,
      accounts: {
        create: backup.accounts.map((account) => ({
          id: account.id,
          accountId: account.accountId,
          providerId: account.providerId,
          accessToken: account.accessToken,
          refreshToken: account.refreshToken,
          idToken: account.idToken,
          accessTokenExpiresAt: account.accessTokenExpiresAt
            ? new Date(account.accessTokenExpiresAt)
            : null,
          refreshTokenExpiresAt: account.refreshTokenExpiresAt
            ? new Date(account.refreshTokenExpiresAt)
            : null,
          scope: account.scope,
          password: account.password,
          createdAt: new Date(account.createdAt),
          updatedAt: new Date(account.updatedAt),
        })),
      },
      accesses: {
        create: backup.accesses.map((access) => ({
          id: access.id,
          module: access.module,
          canManageCashRegister: access.canManageCashRegister,
        })),
      },
    },
  });

  console.log("RESTORED", backup.user.username, backup.user.email);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
