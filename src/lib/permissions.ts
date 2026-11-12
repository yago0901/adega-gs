
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireModuleAccess(
  module: "POS" | "STOCK" | "EMPLOYEES" | "PRODUCTS" | "FINANCE" | "HISTORY"
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      active: true,
      role: true,
      accesses: {
        select: { module: true },
      },
    },
  });

  if (!user || !user.active) {
    redirect("/login");
  }

  const hasAccess =
    user.role === "ADMIN" ||
    user.accesses.some((access) => access.module === module);

  if (!hasAccess) {
    redirect("/dashboard");
  }

  return session;
}

export async function requireAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      active: true,
      role: true,
    },
  });

  if (!user || !user.active) {
    redirect("/login");
  }

  if (user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return session;
}

export async function requireCashRegisterManagement() {
  const session = await requireModuleAccess("POS");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      accesses: {
        where: { module: "POS" },
        select: {
          canManageCashRegister: true,
        },
      },
    },
  });

  if (
    user?.role !== "ADMIN" &&
    !user?.accesses.some((access) => access.canManageCashRegister)
  ) {
    throw new Error(
      "Você não tem permissão para abrir ou fechar o caixa.",
    );
  }

  return session;
}
