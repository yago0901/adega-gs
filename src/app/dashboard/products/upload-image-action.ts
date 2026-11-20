"use server";

import { put } from "@vercel/blob";
import { requireModuleAccess } from "@/lib/permissions";

const MAX_BYTES = 2 * 1024 * 1024;

export async function uploadProductImageAction(formData: FormData) {
  await requireModuleAccess("PRODUCTS");

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return {
      error:
        "Falta configurar o Vercel Blob. No dashboard da Vercel: Storage → Create → Blob, depois adicione BLOB_READ_WRITE_TOKEN no .env e no projeto.",
    } as const;
  }

  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione uma imagem." as const };
  }

  if (!file.type.startsWith("image/")) {
    return { error: "O arquivo precisa ser uma imagem." as const };
  }

  if (file.size > MAX_BYTES) {
    return { error: "A imagem deve ter no máximo 2 MB." as const };
  }

  try {
    const blob = await put(
      `products/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "-")}`,
      file,
      {
        access: "public",
        contentType: file.type || "image/jpeg",
        token: process.env.BLOB_READ_WRITE_TOKEN,
      },
    );

    return { url: blob.url } as const;
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível enviar a imagem.",
    } as const;
  }
}
