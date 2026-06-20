"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (phone: string) => void | Promise<void>;
  pending?: boolean;
};

export function StartConversationModal({ open, onOpenChange, onSubmit, pending }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [phone, setPhone] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      setPhone("");
      return;
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const root = document.getElementById("__next");
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (root) root.inert = true;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) {
        e.preventDefault();
        onOpenChange(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      if (root) root.inert = false;
    };
  }, [open, pending, onOpenChange]);

  if (!mounted || !open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = phone.trim();
    if (!trimmed || pending) return;
    void onSubmit(trimmed);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
      onClick={() => !pending && onOpenChange(false)}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-conversation-title"
        className="w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <Card className="p-6 shadow-xl">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <MessageSquarePlus className="h-6 w-6" />
          </div>
          <h2 id="start-conversation-title" className="mb-2 text-lg font-semibold text-gray-900">
            Nova conversa
          </h2>
          <p className="mb-4 text-sm text-gray-600">
            Informe o WhatsApp do cliente com DDI e DDD, sem espaços.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              ref={inputRef}
              type="tel"
              inputMode="numeric"
              placeholder="5511999999999"
              value={phone}
              disabled={pending}
              onChange={(e) => setPhone(e.target.value)}
            />
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={pending}
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={pending || !phone.trim()}>
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Iniciar"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>,
    document.body,
  );
}
