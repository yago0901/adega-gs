import "server-only";

import { prisma } from "@/lib/prisma";
import { employeeAuth } from "@/lib/employee-auth";

export const availableEmployeeModules = [
  "POS",
  "STOCK",
  "EMPLOYEES",
  "PRODUCTS",
  "FINANCE",
  "HISTORY",
  "CUSTOMERS",
  "FIADOS",
] as const;

export type EmployeeModule = (typeof availableEmployeeModules)[number];

export type CreateEmployeeInput = {
  name: string;
  email: string;
  username: string;
  password: string;
  modules: EmployeeModule[];
  canManageCashRegister: boolean;
};

export function parseCreateEmployeeInput(
  formData: FormData,
): CreateEmployeeInput | { error: string } {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const username = String(formData.get("username") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  const submittedModules = formData.getAll("modules").map(String);
  const canManageCashRegister =
    formData.get("canManageCashRegister") === "on";

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
        !availableEmployeeModules.includes(module as EmployeeModule),
    )
  ) {
    return { error: "Uma ou mais permissões são inválidas." };
  }

  const modules = [...new Set(submittedModules)] as EmployeeModule[];

  if (modules.length === 0) {
    return { error: "Selecione pelo menos um módulo." };
  }

  return {
    name,
    email,
    username,
    password,
    modules,
    canManageCashRegister,
  };
}

export async function createEmployeeRecord(input: CreateEmployeeInput) {
  const existingEmail = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (existingEmail) {
    return { error: "Este e-mail já está cadastrado." as const };
  }

  const existingUsername = await prisma.user.findUnique({
    where: { username: input.username },
    select: { id: true },
  });

  if (existingUsername) {
    return { error: "Este nome de usuário já está em uso." as const };
  }

  let createdUserId: string | undefined;

  try {
    const result = await employeeAuth.api.signUpEmail({
      body: {
        name: input.name,
        email: input.email,
        username: input.username,
        password: input.password,
      },
    });

    if (!result.user?.id) {
      throw new Error("Não foi possível criar o usuário.");
    }

    createdUserId = result.user.id;

    await prisma.userModuleAccess.createMany({
      data: input.modules.map((module) => ({
        userId: createdUserId!,
        module,
        canManageCashRegister:
          module === "POS" && input.canManageCashRegister,
      })),
    });

    return { success: true as const, userId: createdUserId };
  } catch (error) {
    if (createdUserId) {
      await prisma.user.delete({ where: { id: createdUserId } }).catch(() => undefined);
    }

    return {
      error:
        error instanceof Error
          ? error.message
          : ("Não foi possível criar o funcionário." as const),
    };
  }
}

export type UpdateEmployeeInput = {
  id: string;
  name: string;
  email: string;
  modules: EmployeeModule[];
  canManageCashRegister: boolean;
};

export function parseUpdateEmployeeInput(
  formData: FormData,
): UpdateEmployeeInput | { error: string } {
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  const submittedModules = formData.getAll("modules").map(String);

  const canManageCashRegister =
    formData.get("canManageCashRegister") === "on";

  if (!id || !name || !email) {
    return { error: "Preencha todos os campos obrigatórios." };
  }

  if (
    submittedModules.some(
      (module) =>
        !availableEmployeeModules.includes(module as EmployeeModule),
    )
  ) {
    return { error: "Uma ou mais permissões são inválidas." };
  }

  const modules = [...new Set(submittedModules)] as EmployeeModule[];

  if (modules.length === 0) {
    return { error: "Selecione pelo menos um módulo." };
  }

  return {
    id,
    name,
    email,
    modules,
    canManageCashRegister,
  };
}

export async function updateEmployeeRecord(input: UpdateEmployeeInput) {
  const employee = await prisma.user.findUnique({
    where: { id: input.id },
    select: {
      id: true,
      role: true,
    },
  });

  if (!employee || employee.role !== "EMPLOYEE") {
    return { error: "Funcionário não encontrado." as const };
  }

  const existingEmail = await prisma.user.findFirst({
    where: {
      email: input.email,
      id: { not: input.id },
    },
    select: { id: true },
  });

  if (existingEmail) {
    return { error: "Este e-mail já está cadastrado." as const };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: input.id },
        data: {
          name: input.name,
          email: input.email,
        },
      });

      await tx.userModuleAccess.deleteMany({
        where: { userId: input.id },
      });

      await tx.userModuleAccess.createMany({
        data: input.modules.map((module) => ({
          userId: input.id,
          module,
          canManageCashRegister:
            module === "POS" && input.canManageCashRegister,
        })),
      });
    });

    return { success: true as const };
  } catch (error) {
    console.error("Erro ao atualizar funcionário:", error);

    return {
      error: "Não foi possível atualizar o funcionário." as const,
    };
  }
}

export async function toggleEmployeeStatusRecord(employeeId: string) {
  const id = employeeId.trim();

  if (!id) {
    return { error: "Funcionário inválido." as const };
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
    return { error: "Funcionário não encontrado." as const };
  }

  try {
    await prisma.user.update({
      where: { id },
      data: {
        active: !employee.active,
      },
    });

    return { success: true as const };
  } catch (error) {
    console.error("Erro ao alterar situação do funcionário:", error);

    return {
      error: "Não foi possível alterar a situação do funcionário." as const,
    };
  }
}
