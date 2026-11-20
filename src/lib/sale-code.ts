export function getSaleCode(saleId: string) {
  return saleId.slice(-8).toUpperCase();
}

export function saleCodeMatches(saleId: string, search: string) {
  const term = search.trim().replace(/^#/, "").toLowerCase();
  if (!term) return true;

  return (
    saleId.toLowerCase().includes(term) ||
    getSaleCode(saleId).toLowerCase().includes(term)
  );
}
