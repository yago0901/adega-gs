"use client";

import { useState, useTransition } from "react";
import { resizeProductImage } from "@/lib/resize-image";
import { uploadProductImageAction } from "./upload-image-action";

type ProductImageFieldProps = {
  initialUrl?: string | null;
};

export function ProductImageField({
  initialUrl = null,
}: ProductImageFieldProps) {
  const [imageUrl, setImageUrl] = useState(initialUrl ?? "");
  const [preview, setPreview] = useState(initialUrl ?? "");
  const [error, setError] = useState("");
  const [isUploading, startUpload] = useTransition();

  function handleFileChange(fileList: FileList | null) {
    const file = fileList?.[0];
    if (!file) return;

    setError("");

    startUpload(async () => {
      try {
        const resized = await resizeProductImage(file);
        const body = new FormData();
        body.set("file", resized);

        const result = await uploadProductImageAction(body);

        if ("error" in result && result.error) {
          setError(result.error);
          return;
        }

        if ("url" in result && result.url) {
          setImageUrl(result.url);
          setPreview(result.url);
        }
      } catch (uploadError) {
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "Falha ao processar a imagem.",
        );
      }
    });
  }

  function handleRemove() {
    setImageUrl("");
    setPreview("");
    setError("");
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Foto do produto</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Opcional. A imagem é reduzida automaticamente para o PDV.
          </p>
        </div>

        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Pré-visualização"
            className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400">
            Sem foto
          </div>
        )}
      </div>

      <input type="hidden" name="imageUrl" value={imageUrl} />

      <div className="flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          {isUploading ? "Enviando..." : preview ? "Trocar foto" : "Enviar foto"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={isUploading}
            onChange={(event) => {
              handleFileChange(event.target.files);
              event.target.value = "";
            }}
          />
        </label>

        {preview ? (
          <button
            type="button"
            onClick={handleRemove}
            disabled={isUploading}
            className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
          >
            Remover
          </button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
