"use client";

import { useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  digitsOnlyCep,
  formatAddressFromCep,
  formatCepMask,
  lookupCep,
} from "@/lib/viacep";

type AddressCepFieldProps = {
  value: string;
  onChange: (address: string) => void;
  placeholder?: string;
  inputClassName?: string;
  showIcon?: boolean;
  hint?: string;
};

export function AddressCepField({
  value,
  onChange,
  placeholder = "Rua Example, 123 – Cidade/UF",
  inputClassName,
  showIcon = false,
  hint = "Digite o CEP e busque para preencher rua, bairro e cidade.",
}: AddressCepFieldProps) {
  const [cep, setCep] = useState("");
  const [loading, setLoading] = useState(false);

  async function searchCep() {
    const digits = digitsOnlyCep(cep);
    if (digits.length !== 8) {
      toast.error("Digite um CEP válido com 8 dígitos.");
      return;
    }
    setLoading(true);
    try {
      const data = await lookupCep(digits);
      const formatted = formatAddressFromCep(data);
      if (!formatted) {
        toast.error("CEP sem endereço completo. Preencha manualmente.");
        return;
      }
      onChange(formatted);
      toast.success("Endereço preenchido pelo CEP. Ajuste o número se precisar.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao buscar CEP.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          type="text"
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="CEP: 01310-100"
          value={cep}
          onChange={(e) => setCep(formatCepMask(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void searchCep();
            }
          }}
          className={cn(inputClassName, "flex-1")}
          aria-label="Buscar endereço por CEP"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => void searchCep()}
          disabled={loading || digitsOnlyCep(cep).length !== 8}
          className={cn(
            "shrink-0 gap-1.5 rounded-xl px-3",
            inputClassName ? "h-11" : "h-9",
          )}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Search className="size-4" aria-hidden />
          )}
          Buscar
        </Button>
      </div>

      <div className="relative">
        {showIcon ? (
          <MapPin
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            aria-hidden
          />
        ) : null}
        <Input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(inputClassName, showIcon && "pl-10")}
          autoComplete="street-address"
        />
      </div>
      {hint ? (
        <p className="text-[11px] text-gray-400 leading-relaxed">{hint}</p>
      ) : null}
    </div>
  );
}
