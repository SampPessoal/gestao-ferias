import React from "react";
import { Eye, EyeOff } from "lucide-react";
import { usePrivacy } from "@/contexts/PrivacyContext";

/**
 * PrivacyValue — exibe um valor monetário com botão de olho para ocultar/mostrar.
 * O estado de visibilidade é controlado pelo PrivacyContext global.
 * Quando o contexto global está oculto, todos os valores ficam ocultos.
 * O botão individual permite sobrescrever o estado global para aquele campo.
 *
 * Props:
 *   value     — string formatada do valor (ex: "R$ 1.234,56")
 *   className — classes extras para o container
 *   iconSize  — tamanho do ícone em px (padrão: 14)
 *   hiddenChar — caractere usado para ocultar (padrão: "••••")
 */
export function PrivacyValue({
  value,
  className = "",
  iconSize = 14,
  hiddenChar = "••••",
}: {
  value: React.ReactNode;
  className?: string;
  iconSize?: number;
  hiddenChar?: string;
}) {
  const { hidden, toggle } = usePrivacy();

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="tabular-nums">{hidden ? hiddenChar : value}</span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); toggle(); }}
        className="shrink-0 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
        title={hidden ? "Mostrar todos os valores" : "Ocultar todos os valores"}
      >
        {hidden ? (
          <EyeOff style={{ width: iconSize, height: iconSize }} />
        ) : (
          <Eye style={{ width: iconSize, height: iconSize }} />
        )}
      </button>
    </span>
  );
}
