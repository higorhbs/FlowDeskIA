export type ViaCepResult = {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
};

export function digitsOnlyCep(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
}

export function formatCepMask(value: string) {
  const d = digitsOnlyCep(value);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function formatAddressFromCep(data: ViaCepResult) {
  const street = data.logradouro?.trim() || "";
  const district = data.bairro?.trim() || "";
  const city = data.localidade?.trim() || "";
  const uf = data.uf?.trim() || "";
  const cityUf = [city, uf].filter(Boolean).join("/");
  const head = [street, district].filter(Boolean).join(" - ");
  if (head && cityUf) return `${head}, ${cityUf}`;
  return head || cityUf;
}

export async function lookupCep(cep: string): Promise<ViaCepResult> {
  const digits = digitsOnlyCep(cep);
  if (digits.length !== 8) {
    throw new Error("CEP deve ter 8 dígitos.");
  }

  const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Não foi possível consultar o CEP.");

  const data = (await res.json()) as ViaCepResult & { erro?: boolean };
  if (data.erro) throw new Error("CEP não encontrado.");

  return {
    cep: data.cep ?? formatCepMask(digits),
    logradouro: data.logradouro ?? "",
    complemento: data.complemento ?? "",
    bairro: data.bairro ?? "",
    localidade: data.localidade ?? "",
    uf: data.uf ?? "",
  };
}
