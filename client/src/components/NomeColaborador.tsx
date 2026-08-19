import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface NomeColaboradorProps {
  nome: string;
  className?: string;
  maxChars?: number;
}

/**
 * Exibe o nome do colaborador truncado com tooltip mostrando o nome completo.
 * Se o nome couber no limite de caracteres, exibe normalmente sem tooltip.
 */
export function NomeColaborador({ nome, className = "", maxChars = 28 }: NomeColaboradorProps) {
  const nomeTrimmed = nome?.trim() ?? "";
  const precisaTruncar = nomeTrimmed.length > maxChars;
  const nomeExibido = precisaTruncar
    ? nomeTrimmed.slice(0, maxChars).trim() + "…"
    : nomeTrimmed;

  if (!precisaTruncar) {
    return <span className={className}>{nomeTrimmed}</span>;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`cursor-help underline decoration-dotted underline-offset-2 decoration-muted-foreground/50 ${className}`}
            style={{ textDecorationStyle: "dotted" }}
          >
            {nomeExibido}
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs text-sm font-medium px-3 py-2 z-50"
        >
          {nomeTrimmed}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
