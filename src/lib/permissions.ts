
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
