import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { auth } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";


const rl = createInterface({ input: stdin, output: stdout });

const modules = [
  "POS",
  "STOCK",
  "EMPLOYEES",
  "PRODUCTS",
  "FINANCE",
  "HISTORY",
] as const;

async function main() {
  const existingAdmin = await prisma.user.count({
    where: { role: "ADMIN" },
  });

  if (existingAdmin > 0) {
    console.log("Já existe um administrador. Operação cancelada.");
    return;
  }

  const existingUsername = await prisma.user.findUnique({
    where: { username: "yago" },
  });

  if (existingUsername) {
    throw new Error(
      "O username yago já existe. Verifique o usuário antes de continuar."
    );
  }

  console.log("\n=== CRIAÇÃO DO ADMINISTRADOR INICIAL ===\n");

  const email = (
    await rl.question("E-mail da conta: ")
  ).trim().toLowerCase();

  const password = await rl.question("Senha (mínimo 8 caracteres): ");

  if (!email || password.length < 8) {
    throw new Error("E-mail inválido ou senha muito curta.");
  }

  const result = await auth.api.signUpEmail({
    body: {
      name: "Yago Santos",
      username: "yago",
      email,
      password,
    },
  });

  if (!result.user?.id) {
    throw new Error("Better Auth não retornou o usuário criado.");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: result.user.id },
      data: { role: "ADMIN" },
    }),

    prisma.userModuleAccess.createMany({
      data: modules.map((module) => ({
        userId: result.user.id,
        module,
      })),
    }),
  ]);

  console.log("\nAdministrador criado com sucesso!");
  console.log("Username: yago");
  console.log("Cargo: ADMIN");
  console.log("Acesso aos seis módulos concedido.");
}

main()
  .catch((error) => {
    console.error("\nErro ao criar administrador:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await prisma.$disconnect();
  });
