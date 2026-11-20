import { connection } from "next/server";
import { requireAdmin } from "@/lib/permissions";
import { listEmployees } from "@/modules/employees/list";
import { EmployeeManagement } from "./employee-management";
import Link from "next/link";

export const instant = false;

export default async function EmployeesPage() {
  await connection();
  await requireAdmin();

  const initial = await listEmployees({ page: 1, pageSize: 20 });

  return (
    <main className="min-h-screen bg-slate-100 p-5 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-emerald-700 hover:underline"
          >
            ← Dashboard
          </Link>

          <h1 className="mt-3 text-2xl font-bold">Funcionários</h1>

          <p className="mt-1 text-sm text-slate-500">
            Gerencie funcionários e suas permissões de acesso.
          </p>
        </div>

        <EmployeeManagement initial={initial} />
      </div>
    </main>
  );
}
