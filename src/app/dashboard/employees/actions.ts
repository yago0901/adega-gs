
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/permissions";
import { employeeAuth } from "@/lib/employee-auth";

const availableModules = [
  "POS",
  "STOCK",
  "EMPLOYEES",
  "PRODUCTS",
  "FINANCE",
  "HISTORY",
] as const;

type EmployeeModule = (typeof availableModules)[number];

export async function createEmployee(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  const submittedModules = formData.getAll("modules").map(String);

  if (!name || !email || !username) {
    return { error: "Preencha todos os campos obrigatórios." };
  }

  if (password.length < 8 || password.length > 128) {
    return { error: "A senha deve ter entre 8 e 128 caracteres." };
  }

  if (username.length < 3 || username.length > 30) {
    return { error: "O usuário deve ter entre 3 e 30 caracteres." };
  }

  if (!/^[a-zA-Z0-9_.]+$/.test(username)) {
    return { error: "O usuário contém caracteres inválidos." };
  }

  if (
    submittedModules.some(
      (module) =>
        !availableModules.includes(module as EmployeeModule)
    )
  ) {
    return { error: "Uma ou mais permissões são inválidas." };
  }

  const modules = [...new Set(submittedModules)] as EmployeeModule[];

  if (modules.length === 0) {
    return { error: "Selecione pelo menos um módulo." };
  }

  const existingEmail = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingEmail) {
    return { error: "Este e-mail já está cadastrado." };
  }

  const existingUsername = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });

  if (existingUsername) {
    return { error: "Este nome de usuário já está em uso." };
  }

  let createdUserId: string | undefined;

  try {
    const result = await employeeAuth.api.signUpEmail({
      body: {
        name,
        email,
        username,
        password,
      },
    });

    if (!result.user?.id) {
      throw new Error("Não foi possível criar o usuário.");
    }

    createdUserId = result.user.id;

    await prisma.userModuleAccess.createMany({
      data: modules.map((module) => ({
        userId: createdUserId!,
        module,
      })),
    });

    revalidatePath("/dashboard/employees");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    if (createdUserId) {
      await prisma.user.delete({
        where: { id: createdUserId },
      }).catch(() => undefined);
    }

    console.error("Erro ao cadastrar funcionário:", error);

    return {
      error: "Não foi possível cadastrar o funcionário.",
    };
  }
}


export async function updateEmployee(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  const submittedModules = formData.getAll("modules").map(String);

  if (!id || !name || !email) {
    return { error: "Preencha todos os campos obrigatórios." };
  }

  if (
    submittedModules.some(
      (module) =>
        !availableModules.includes(module as EmployeeModule)
    )
  ) {
    return { error: "Uma ou mais permissões são inválidas." };
  }

  const modules = [...new Set(submittedModules)] as EmployeeModule[];

  if (modules.length === 0) {
    return { error: "Selecione pelo menos um módulo." };
  }

  const employee = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      role: true,
    },
  });

  if (!employee || employee.role !== "EMPLOYEE") {
    return { error: "Funcionário não encontrado." };
  }

  const existingEmail = await prisma.user.findFirst({
    where: {
      email,
      id: { not: id },
    },
    select: { id: true },
  });

  if (existingEmail) {
    return { error: "Este e-mail já está cadastrado." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          name,
          email,
        },
      });

      await tx.userModuleAccess.deleteMany({
        where: { userId: id },
      });

      await tx.userModuleAccess.createMany({
        data: modules.map((module) => ({
          userId: id,
          module,
        })),
      });
    });

    revalidatePath("/dashboard/employees");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar funcionário:", error);

    return {
      error: "Não foi possível atualizar o funcionário.",
    };
  }
}


export async function toggleEmployeeStatus(employeeId: string) {
  await requireAdmin();

  const id = employeeId.trim();

  if (!id) {
    return { error: "Funcionário inválido." };
  }

  const employee = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      role: true,
      active: true,
    },
  });

  if (!employee || employee.role !== "EMPLOYEE") {
    return { error: "Funcionário não encontrado." };
  }

  try {
    await prisma.user.update({
      where: { id },
      data: {
        active: !employee.active,
      },
    });

    revalidatePath("/dashboard/employees");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Erro ao alterar situação do funcionário:", error);

    return {
      error: "Não foi possível alterar a situação do funcionário.",
    };
  }
}

