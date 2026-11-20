import "dotenv/config";
import { Prisma } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";
import { employeeAuth } from "../src/lib/employee-auth";

const DEMO_PASSWORD = "senha1234";

function money(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}

function qty(value: number) {
  return new Prisma.Decimal(value.toFixed(3));
}

async function ensureEmployee(input: {
  name: string;
  email: string;
  username: string;
  modules: Array<
    | "POS"
    | "STOCK"
    | "EMPLOYEES"
    | "PRODUCTS"
    | "FINANCE"
    | "HISTORY"
    | "CUSTOMERS"
    | "FIADOS"
  >;
  canManageCashRegister?: boolean;
}) {
  const existing = await prisma.user.findUnique({
    where: { username: input.username },
    select: { id: true },
  });

  if (existing) {
    console.log(`  funcionário já existe: ${input.username}`);
    return existing.id;
  }

  const result = await employeeAuth.api.signUpEmail({
    body: {
      name: input.name,
      email: input.email,
      username: input.username,
      password: DEMO_PASSWORD,
    },
  });

  if (!result.user?.id) {
    throw new Error(`Falha ao criar funcionário ${input.username}`);
  }

  await prisma.userModuleAccess.createMany({
    data: input.modules.map((module) => ({
      userId: result.user.id,
      module,
      canManageCashRegister:
        module === "POS" && Boolean(input.canManageCashRegister),
    })),
  });

  console.log(`  funcionário criado: ${input.username}`);
  return result.user.id;
}

async function main() {
  const admin = await prisma.user.findFirst({
    where: { username: "yago" },
    select: { id: true },
  });

  if (!admin) {
    throw new Error("Admin yago não encontrado. Abortando seed.");
  }

  console.log("\n=== Seed Adega GS (dados fictícios) ===\n");

  console.log("1) Funcionários");
  await ensureEmployee({
    name: "Ana Caixa",
    email: "ana.caixa@adegags.demo",
    username: "ana.caixa",
    modules: ["POS", "CUSTOMERS", "FIADOS", "HISTORY"],
    canManageCashRegister: true,
  });
  await ensureEmployee({
    name: "Bruno Estoque",
    email: "bruno.estoque@adegags.demo",
    username: "bruno.estoque",
    modules: ["STOCK", "PRODUCTS", "HISTORY"],
  });
  await ensureEmployee({
    name: "Carla Atendimento",
    email: "carla.atendimento@adegags.demo",
    username: "carla.atendimento",
    modules: ["POS", "CUSTOMERS", "FIADOS"],
    canManageCashRegister: false,
  });
  await ensureEmployee({
    name: "Diego Gerente",
    email: "diego.gerente@adegags.demo",
    username: "diego.gerente",
    modules: [
      "POS",
      "STOCK",
      "PRODUCTS",
      "CUSTOMERS",
      "FIADOS",
      "HISTORY",
      "EMPLOYEES",
      "FINANCE",
    ],
    canManageCashRegister: true,
  });
  await ensureEmployee({
    name: "Elena PDV",
    email: "elena.pdv@adegags.demo",
    username: "elena.pdv",
    modules: ["POS", "HISTORY"],
    canManageCashRegister: true,
  });

  console.log("\n2) Motoboys");
  const motoboys = [
    {
      name: "José Entregas",
      phone: "(11) 98888-1001",
      phoneNormalized: "11988881001",
      notes: "Moto vermelha",
    },
    {
      name: "Pedro Rápido",
      phone: "(11) 97777-2002",
      phoneNormalized: "11977772002",
      notes: "Disponível noite",
    },
  ];

  for (const motoboy of motoboys) {
    const existing = await prisma.motoboy.findUnique({
      where: { phoneNormalized: motoboy.phoneNormalized },
      select: { id: true },
    });

    if (existing) {
      console.log(`  motoboy já existe: ${motoboy.name}`);
      continue;
    }

    await prisma.motoboy.create({ data: motoboy });
    console.log(`  motoboy criado: ${motoboy.name}`);
  }

  console.log("\n3) Clientes");
  const customers = [
    {
      name: "Marcos Silva",
      phone: "(11) 91234-5678",
      phoneNormalized: "11912345678",
      notes: "Cliente frequente",
      addresses: [
        {
          zipCode: "01310100",
          street: "Av. Paulista",
          number: "1000",
          complement: "Apto 12",
          neighborhood: "Bela Vista",
          city: "São Paulo",
          state: "SP",
          reference: "Próximo ao MASP",
          deliveryFee: money(8),
          isDefault: true,
        },
        {
          zipCode: "04038001",
          street: "Rua Domingos de Morais",
          number: "500",
          complement: null,
          neighborhood: "Vila Mariana",
          city: "São Paulo",
          state: "SP",
          reference: null,
          deliveryFee: money(12),
          isDefault: false,
        },
      ],
    },
    {
      name: "Juliana Costa",
      phone: "(11) 99876-5432",
      phoneNormalized: "11998765432",
      notes: null,
      addresses: [
        {
          zipCode: "05407002",
          street: "Rua Teodoro Sampaio",
          number: "220",
          complement: "Casa",
          neighborhood: "Pinheiros",
          city: "São Paulo",
          state: "SP",
          reference: "Portão azul",
          deliveryFee: money(10),
          isDefault: true,
        },
      ],
    },
    {
      name: "Roberto Almeida",
      phone: "(11) 95555-0101",
      phoneNormalized: "11955550101",
      notes: "Prefere PIX",
      addresses: [
        {
          zipCode: "03164000",
          street: "Rua Serra de Bragança",
          number: "88",
          complement: null,
          neighborhood: "Tatuapé",
          city: "São Paulo",
          state: "SP",
          reference: "Em frente à padaria",
          deliveryFee: money(15),
          isDefault: true,
        },
      ],
    },
    {
      name: "Fernanda Oliveira",
      phone: "(11) 96666-0202",
      phoneNormalized: "11966660202",
      notes: "Entregar após 19h",
      addresses: [
        {
          zipCode: "04543011",
          street: "Av. Brigadeiro Faria Lima",
          number: "3500",
          complement: "Sala 101",
          neighborhood: "Itaim Bibi",
          city: "São Paulo",
          state: "SP",
          reference: null,
          deliveryFee: money(18),
          isDefault: true,
        },
      ],
    },
  ];

  for (const customer of customers) {
    const existing = await prisma.customer.findUnique({
      where: { phoneNormalized: customer.phoneNormalized },
      select: { id: true },
    });

    if (existing) {
      console.log(`  cliente já existe: ${customer.name}`);
      continue;
    }

    await prisma.customer.create({
      data: {
        name: customer.name,
        phone: customer.phone,
        phoneNormalized: customer.phoneNormalized,
        notes: customer.notes,
        addresses: { create: customer.addresses },
      },
    });
    console.log(`  cliente criado: ${customer.name}`);
  }

  console.log("\n4) Categorias e produtos");

  async function ensureCategory(name: string) {
    const existing = await prisma.category.findUnique({ where: { name } });
    if (existing) return existing;
    return prisma.category.create({ data: { name } });
  }

  const catBebidas = await ensureCategory("Bebidas");
  const catDestilados = await ensureCategory("Destilados");
  const catInsumos = await ensureCategory("Insumos");
  const catCombos = await ensureCategory("Combos");
  const catDoses = await ensureCategory("Doses");

  const existingProducts = await prisma.product.count();
  if (existingProducts > 0) {
    console.log(
      `  já existem ${existingProducts} produtos — pulando criação de produtos/estoque`,
    );
  } else {
    // STANDARD simples: Cerveja lata
    const cervejaStock = await prisma.stockItem.create({
      data: {
        name: "Cerveja Lata 350ml",
        unit: "UNIT",
        minStock: qty(12),
        purchaseCost: money(2.5),
        balance: { create: { quantity: qty(48) } },
      },
    });

    const cerveja = await prisma.product.create({
      data: {
        code: "00000001",
        name: "Cerveja Lata 350ml",
        description: "Cerveja pilsen lata",
        type: "STANDARD",
        salePrice: money(5.5),
        categoryId: catBebidas.id,
        stockItemId: cervejaStock.id,
      },
    });

    await prisma.stockMovement.create({
      data: {
        type: "INITIAL",
        quantity: qty(48),
        unit: "UNIT",
        reason: "Seed inicial",
        stockItemId: cervejaStock.id,
        userId: admin.id,
      },
    });

    // STANDARD: Refrigerante
    const refriStock = await prisma.stockItem.create({
      data: {
        name: "Refrigerante 2L",
        unit: "UNIT",
        minStock: qty(6),
        purchaseCost: money(4),
        balance: { create: { quantity: qty(24) } },
      },
    });

    const refrigerante = await prisma.product.create({
      data: {
        code: "00000002",
        name: "Refrigerante 2L",
        type: "STANDARD",
        salePrice: money(9.9),
        categoryId: catBebidas.id,
        stockItemId: refriStock.id,
      },
    });

    await prisma.stockMovement.create({
      data: {
        type: "INITIAL",
        quantity: qty(24),
        unit: "UNIT",
        reason: "Seed inicial",
        stockItemId: refriStock.id,
        userId: admin.id,
      },
    });

    // SUPPLY: Gelo
    const geloStock = await prisma.stockItem.create({
      data: {
        name: "Gelo 5kg",
        unit: "UNIT",
        minStock: qty(5),
        purchaseCost: money(3),
        balance: { create: { quantity: qty(20) } },
      },
    });

    await prisma.product.create({
      data: {
        code: "00000003",
        name: "Gelo 5kg",
        type: "SUPPLY",
        salePrice: money(8),
        categoryId: catInsumos.id,
        stockItemId: geloStock.id,
      },
    });

    await prisma.stockMovement.create({
      data: {
        type: "INITIAL",
        quantity: qty(20),
        unit: "UNIT",
        reason: "Seed inicial",
        stockItemId: geloStock.id,
        userId: admin.id,
      },
    });

    // SUPPLY: Copo descartável
    const copoStock = await prisma.stockItem.create({
      data: {
        name: "Copo Descartável",
        unit: "UNIT",
        minStock: qty(50),
        purchaseCost: money(0.15),
        balance: { create: { quantity: qty(200) } },
      },
    });

    await prisma.product.create({
      data: {
        code: "00000004",
        name: "Copo Descartável",
        type: "SUPPLY",
        salePrice: money(0.5),
        categoryId: catInsumos.id,
        stockItemId: copoStock.id,
      },
    });

    await prisma.stockMovement.create({
      data: {
        type: "INITIAL",
        quantity: qty(200),
        unit: "UNIT",
        reason: "Seed inicial",
        stockItemId: copoStock.id,
        userId: admin.id,
      },
    });

    // Bebida em aberto (SELF packaging): Whisky 1L -> doses em ML
    const whiskyFactor = 1000;
    const whiskyStock = await prisma.stockItem.create({
      data: {
        name: "Whisky Escocês 1L",
        unit: "ML",
        minStock: qty(2 * whiskyFactor),
        purchaseCost: money(Number((89.9 / whiskyFactor).toFixed(2))),
        balance: { create: { quantity: qty(350) } }, // já aberto
      },
    });

    const whiskyPackaging = await prisma.stockPackaging.create({
      data: {
        name: "Garrafa 1L",
        conversionFactor: qty(whiskyFactor),
        stockItemId: whiskyStock.id,
        balance: { create: { quantity: qty(6) } }, // 6 garrafas fechadas
      },
    });

    await prisma.product.create({
      data: {
        code: "00000005",
        name: "Whisky Escocês 1L",
        description: "Garrafa fechada / pode abrir para dose",
        type: "STANDARD",
        salePrice: money(149.9),
        categoryId: catDestilados.id,
        stockItemId: whiskyStock.id,
        stockPackagingId: whiskyPackaging.id,
      },
    });

    await prisma.stockMovement.createMany({
      data: [
        {
          type: "INITIAL",
          quantity: qty(6),
          unit: "UNIT",
          reason: "Seed garrafas fechadas",
          stockItemId: whiskyStock.id,
          stockPackagingId: whiskyPackaging.id,
          userId: admin.id,
        },
        {
          type: "INITIAL",
          quantity: qty(350),
          unit: "ML",
          reason: "Seed saldo aberto",
          stockItemId: whiskyStock.id,
          userId: admin.id,
        },
      ],
    });

    // Vodka com embalagem (SELF) para doses
    const vodkaFactor = 1000;
    const vodkaStock = await prisma.stockItem.create({
      data: {
        name: "Vodka Premium 1L",
        unit: "ML",
        minStock: qty(1 * vodkaFactor),
        purchaseCost: money(Number((45 / vodkaFactor).toFixed(2))),
        balance: { create: { quantity: qty(500) } },
      },
    });

    const vodkaPackaging = await prisma.stockPackaging.create({
      data: {
        name: "Garrafa 1L",
        conversionFactor: qty(vodkaFactor),
        stockItemId: vodkaStock.id,
        balance: { create: { quantity: qty(8) } },
      },
    });

    await prisma.product.create({
      data: {
        code: "00000006",
        name: "Vodka Premium 1L",
        type: "STANDARD",
        salePrice: money(69.9),
        categoryId: catDestilados.id,
        stockItemId: vodkaStock.id,
        stockPackagingId: vodkaPackaging.id,
      },
    });

    await prisma.stockMovement.createMany({
      data: [
        {
          type: "INITIAL",
          quantity: qty(8),
          unit: "UNIT",
          reason: "Seed garrafas fechadas",
          stockItemId: vodkaStock.id,
          stockPackagingId: vodkaPackaging.id,
          userId: admin.id,
        },
        {
          type: "INITIAL",
          quantity: qty(500),
          unit: "ML",
          reason: "Seed saldo aberto",
          stockItemId: vodkaStock.id,
          userId: admin.id,
        },
      ],
    });

    // Embalagem comercial CHILD: fardo de cerveja -> cerveja lata
    const fardoStock = await prisma.stockItem.create({
      data: {
        name: "Fardo Cerveja (12 un)",
        unit: "UNIT",
        minStock: qty(2),
        purchaseCost: money(28),
        balance: { create: { quantity: qty(10) } },
      },
    });

    await prisma.product.create({
      data: {
        code: "00000007",
        name: "Fardo Cerveja 12un",
        description: "Abre em 12 latas",
        type: "STANDARD",
        salePrice: money(55),
        categoryId: catBebidas.id,
        stockItemId: fardoStock.id,
        packagingChildProductId: cerveja.id,
        packagingChildQuantity: qty(12),
      },
    });

    await prisma.stockMovement.create({
      data: {
        type: "INITIAL",
        quantity: qty(10),
        unit: "UNIT",
        reason: "Seed inicial",
        stockItemId: fardoStock.id,
        userId: admin.id,
      },
    });

    // FRACTIONAL (dose) usando whisky e vodka
    await prisma.product.create({
      data: {
        code: "00000008",
        name: "Dose Whisky 50ml",
        type: "FRACTIONAL",
        salePrice: money(18),
        categoryId: catDoses.id,
        composition: {
          create: {
            groups: {
              create: [
                {
                  name: "Destilado",
                  minSelections: 1,
                  maxSelections: 1,
                  position: 0,
                  options: {
                    create: [
                      {
                        stockItemId: whiskyStock.id,
                        quantity: qty(50),
                        position: 0,
                      },
                      {
                        stockItemId: vodkaStock.id,
                        quantity: qty(50),
                        position: 1,
                      },
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    });

    await prisma.product.create({
      data: {
        code: "00000009",
        name: "Dose Vodka 50ml",
        type: "FRACTIONAL",
        salePrice: money(12),
        categoryId: catDoses.id,
        composition: {
          create: {
            groups: {
              create: [
                {
                  name: "Destilado",
                  minSelections: 1,
                  maxSelections: 1,
                  position: 0,
                  options: {
                    create: [
                      {
                        stockItemId: vodkaStock.id,
                        quantity: qty(50),
                        position: 0,
                      },
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    });

    // COMBO
    await prisma.product.create({
      data: {
        code: "00000010",
        name: "Combo Festa (6 cervejas + 1 refri)",
        type: "COMBO",
        salePrice: money(39.9),
        categoryId: catCombos.id,
        comboItems: {
          create: [
            { componentProductId: cerveja.id, quantity: qty(6) },
            { componentProductId: refrigerante.id, quantity: qty(1) },
          ],
        },
      },
    });

    console.log("  produtos criados: STANDARD, SUPPLY, embalagem, dose, combo");
  }

  console.log("\n=== Seed concluído ===");
  console.log(`Senha dos funcionários demo: ${DEMO_PASSWORD}`);
  console.log(
    "Usuários: ana.caixa, bruno.estoque, carla.atendimento, diego.gerente, elena.pdv",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
