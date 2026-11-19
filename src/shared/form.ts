export function getText(formData: FormData, field: string) {
  return String(formData.get(field) ?? "").trim();
}

export function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}
