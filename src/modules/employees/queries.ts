import "server-only";

import { prisma } from "@/lib/prisma";

export async function listEmployeesWithAccess() {
  return prisma.user.findMany({
    where: {
      role: "EMPLOYEE",
    },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      active: true,
      createdAt: true,
      accesses: {
        select: {
          module: true,
          canManageCashRegister: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}