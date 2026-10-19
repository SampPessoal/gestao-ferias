/**
 * Campo de valor em reais. Mostra "R$ 1.234,56" enquanto se digita (só números:
 * 3, 9, 5, 2 → 39,52) e entrega o valor no formato que a tela já usava:
 * formato "ponto" → "39.52" (padrão) | formato "virgula" → "39,52".
 * Vazio → "".
 */
import React from "react";
import { Input } from "@/components/ui/input";
import { lerReais, formatarReais, soDigitos } from "@/lib/mascaras";

type Props = Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: string | number | null | undefined;
  onValorChange: (valor: string) => void;
  formato?: "ponto" | "virgula";
};

export function InputMoeda({ value, onValorChange, formato = "ponto", className, placeholder, ...resto }: Props) {
  const exibido = formatarReais(lerReais(value));
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
      <Input
        {...resto}
        type="text"
        inputMode="numeric"
        className={`pl-8 tabular-nums ${className ?? ""}`}
        placeholder={placeholder ?? "0,00"}
        value={exibido}
        onChange={e => {
          const d = soDigitos(e.target.value).replace(/^0+(?=\d)/, "").slice(0, 12);
          if (!d) { onValorChange(""); return; }
          const texto = (Number(d) / 100).toFixed(2);
          onValorChange(formato === "virgula" ? texto.replace(".", ",") : texto);
        }}
      />
    </div>
  );
}

export default InputMoeda;
