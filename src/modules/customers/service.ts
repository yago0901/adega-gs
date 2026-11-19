import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getText, normalizePhone } from "@/shared/form";

export type CustomerAddressInput = {
  zipCode: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  reference: string | null;
  deliveryFee: Prisma.Decimal;
  isDefault: boolean;
};

export type CustomerPersonalData = {
  name: string;
  phone: string;
  phoneNormalized: string;
  notes: string | null;
};

export function parseCustomerAddresses(formData: FormData): CustomerAddressInput[] {
  const raw = getText(formData, "addressesJson");

  if (!raw) {
    throw new Error("Informe pelo menos um endereço para o cliente.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Os endereços informados são inválidos.");
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("Informe pelo menos um endereço para o cliente.");
  }

  const addresses = parsed.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Endereço ${index + 1} inválido.`);
    }

    const address = item as Record<string, unknown>;

    const zipCode = String(address.zipCode ?? "")
      .replace(/\D/g, "")
      .trim();
    const street = String(address.street ?? "").trim();
    const number = String(address.number ?? "").trim();
    const complement = String(address.complement ?? "").trim() || null;
    const neighborhood = String(address.neighborhood ?? "").trim();
    const city = String(address.city ?? "").trim();
    const state = String(address.state ?? "")
      .trim()
      .toUpperCase();
    const reference = String(address.reference ?? "").trim() || null;
    const deliveryFeeRaw = String(address.deliveryFee ?? "")
      .trim()
      .replace(",", ".");
    const isDefault = Boolean(address.isDefault);

    if (
      !zipCode ||
      !street ||
      !number ||
      !neighborhood ||
      !city ||
      !state
    ) {
      throw new Error(
        `Preencha todos os campos obrigatórios do endereço ${index + 1}.`,
      );
    }

    if (zipCode.length !== 8) {
      throw new Error(`Informe um CEP válido no endereço ${index + 1}.`);
    }

    if (state.length !== 2) {
      throw new Error(
        `Informe a UF com duas letras no endereço ${index + 1}.`,
      );
    }

    if (!/^\d+(\.\d{1,2})?$/.test(deliveryFeeRaw)) {
      throw new Error(
        `Informe uma taxa de entrega válida no endereço ${index + 1}.`,
      );
    }

    const deliveryFee = new Prisma.Decimal(deliveryFeeRaw);

    if (deliveryFee.lt(0) || deliveryFee.gt("9999999999.99")) {
      throw new Error(
        `A taxa de entrega do endereço ${index + 1} é inválida.`,
      );
    }

    return {
      zipCode,
      street,
      number,
      complement,
      neighborhood,
      city,
      state,
      reference,
      deliveryFee,
      isDefault,
    };
  });

  const defaultCount = addresses.filter((address) => address.isDefault).length;

  if (defaultCount === 0) {
    addresses[0].isDefault = true;
  } else if (defaultCount > 1) {
    let found = false;

    for (const address of addresses) {
      if (address.isDefault && !found) {
        found = true;
        continue;
      }

      address.isDefault = false;
    }
  }

  return addresses;
}

export function parseCustomerPersonalData(
  formData: FormData,
): CustomerPersonalData {
  const name = getText(formData, "name");
  const phone = getText(formData, "phone");
  const phoneNormalized = normalizePhone(phone);
  const notes = getText(formData, "notes") || null;

  if (name.length < 2) {
    throw new Error("Informe um nome válido.");
  }

  if (phoneNormalized.length < 10 || phoneNormalized.length > 13) {
    throw new Error("Informe um telefone válido com DDD.");
  }

  return {
    name,
    phone,
    phoneNormalized,
    notes,
  };
}

export async function createCustomerRecord(
  data: CustomerPersonalData,
  addresses: CustomerAddressInput[],
) {
  const existingCustomer = await prisma.customer.findUnique({
    where: {
      phoneNormalized: data.phoneNormalized,
    },
    select: {
      id: true,
    },
  });

  if (existingCustomer) {
    throw new Error("Já existe um cliente cadastrado com esse telefone.");
  }

  return prisma.customer.create({
    data: {
      ...data,
      addresses: {
        create: addresses,
      },
    },
  });
}

export async function updateCustomerRecord(
  id: string,
  data: CustomerPersonalData,
  addresses: CustomerAddressInput[],
) {
  const existingCustomer = await prisma.customer.findUnique({
    where: {
      phoneNormalized: data.phoneNormalized,
    },
    select: {
      id: true,
    },
  });

  if (existingCustomer && existingCustomer.id !== id) {
    throw new Error("Já existe outro cliente cadastrado com esse telefone.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.customer.update({
      where: { id },
      data,
    });

    await tx.customerAddress.deleteMany({
      where: { customerId: id },
    });

    await tx.customerAddress.createMany({
      data: addresses.map((address) => ({
        ...address,
        customerId: id,
      })),
    });
  });
}

export async function deactivateCustomerRecord(id: string) {
  await prisma.customer.update({
    where: { id },
    data: { active: false },
  });
}

export async function listActiveCustomersWithAddresses() {
  return prisma.customer.findMany({
    where: { active: true },
    include: {
      addresses: {
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getActiveCustomerWithAddresses(id: string) {
  return prisma.customer.findUnique({
    where: { id },
    include: {
      addresses: {
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      },
    },
  });
}
