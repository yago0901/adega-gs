import { connection } from "next/server";
import { requireAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { EmployeeManagement } from "./employee-management";
import Link from "next/link";

export const instant = false;

export default async function EmployeesPage() {
  await connection();
  await requireAdmin();

  const employees = await prisma.user.findMany({
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
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="text-sm text-emerald-700 hover:underline"
        >
          ← Dashboard
        </Link>

        <h1 className="mt-3 text-2xl font-bold">Funcionários</h1>

        <p className="mt-1 text-sm text-zinc-500">
          Gerencie funcionários e suas permissões de acesso.
        </p>
      </div>

      <EmployeeManagement employees={employees} />
    </div>
  );
}
