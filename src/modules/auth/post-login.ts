import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const moduleRoutes: Record<string, string> = {
  POS: "/dashboard/pos",
  STOCK: "/dashboard/stock",
  PRODUCTS: "/dashboard/products",
  EMPLOYEES: "/dashboard/employees",
  FINANCE: "/dashboard/finance",
  HISTORY: "/dashboard/history",
  CUSTOMERS: "/dashboard/clients",
  FIADOS: "/dashboard/fiados",
  MOTOBOYS: "/dashboard/motoboys",
};

export async function resolvePostLoginPath() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return "/";
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      active: true,
      accesses: {
        select: {
          module: true,
        },
      },
    },
  });

  if (!user || !user.active) {
    return "/";
  }

  if (user.role === "ADMIN") {
    return "/dashboard";
  }

  if (user.accesses.length === 0) {
    return "/";
  }

  if (user.accesses.length === 1) {
    return moduleRoutes[user.accesses[0].module] ?? "/dashboard";
  }

  return "/dashboard";
}
