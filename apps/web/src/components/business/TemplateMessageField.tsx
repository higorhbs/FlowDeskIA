"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const SETTINGS_TEMPLATE_VARS = [
  {
    token: "{nome}",
    label: "Nome de quem está conversando com você no WhatsApp",
    shortHint: "Pessoa na conversa",
  },
  {
    token: "{negocio}",
    label: "Nome do seu negócio (cadastrado em Informações básicas)",
    shortHint: "Nome do negócio",
  },
] as const;

export function TemplateVariablesHelp() {
  return (
    <ul className="text-xs text-gray-600 leading-relaxed rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-2.5 space-y-1.5 list-disc list-inside">
      <li>
        <strong className="font-medium text-gray-800 font-mono">{`{nome}`}</strong> — nome da pessoa com quem você
        está conversando no WhatsApp
      </li>
      <li>
        <strong className="font-medium text-gray-800 font-mono">{`{negocio}`}</strong> — nome do seu negócio
      </li>
      <li>Arraste ou clique nos blocos de cada mensagem para inserir</li>
    </ul>
  );
}

export type TemplateVariable = {
  token: string;
  label: string;
  shortHint?: string;
};

export function insertTemplateToken(text: string, token: string, start: number, end: number) {
  const from = Math.max(0, start);
  const to = Math.max(from, end);
  return `${text.slice(0, from)}${token}${text.slice(to)}`;
}

export function TemplateVariableBar({
  onPick,
  variables = SETTINGS_TEMPLATE_VARS,
}: {
  onPick: (token: string) => void;
  variables?: readonly TemplateVariable[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {variables.map((v) => (
        <Button
          key={v.token}
          type="button"
          variant="outline"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("text/plain", v.token);
            e.dataTransfer.effectAllowed = "copy";
          }}
          onClick={() => onPick(v.token)}
          className="inline-flex h-auto flex-col items-start rounded-lg border-brand-200 bg-brand-50 px-2.5 py-1.5 text-left hover:bg-brand-100 min-w-[7.5rem]"
          title={v.label}
        >
          <span className="text-xs font-semibold font-mono text-brand-800">{v.token}</span>
          {v.shortHint && (
            <span className="text-[10px] text-brand-700/90 leading-tight mt-0.5">{v.shortHint}</span>
          )}
        </Button>
      ))}
    </div>
  );
}

type TemplateMessageFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  className?: string;
  footer?: React.ReactNode | null;
  variables?: readonly TemplateVariable[];
};

export function TemplateMessageField({
  value,
  onChange,
  placeholder,
  rows = 4,
  maxLength,
  className,
  footer,
  variables = SETTINGS_TEMPLATE_VARS,
}: TemplateMessageFieldProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insertToken(token: string) {
    const el = textareaRef.current;
    if (!el) {
      onChange(`${value}${token}`);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = insertTemplateToken(value, token, start, end);
    onChange(next);
    requestAnimationFrame(() => {
      const cursor = start + token.length;
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div className="space-y-2">
      <TemplateVariableBar onPick={insertToken} variables={variables} />
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const token = e.dataTransfer.getData("text/plain");
          if (token.startsWith("{") && token.endsWith("}")) insertToken(token);
        }}
        rows={rows}
        maxLength={maxLength}
        className={cn("input resize-none w-full", className)}
        placeholder={placeholder}
      />
      {footer}
    </div>
  );
}
