"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User as FirebaseUser } from "firebase/auth";
import { privacyApi, profileApi, tenantApi } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import {
  authErrorMessage,
  hasGoogleProvider,
  hasPasswordProvider,
  watchAuth,
} from "@/lib/firebase-auth";
import { PLAN_LABELS, cn } from "@/lib/utils";
import { toast } from "sonner";
import { CreditCard, Loader2, Mail, Lock, User, Shield, Sparkles, Chrome, FileDown } from "lucide-react";

const nameSchema = z.object({
  name: z.string().min(2, "Nome muito curto"),
});

const emailSchema = z.object({
  email: z.string().email("E-mail inválido"),
  currentPassword: z.string().min(1, "Informe a senha atual"),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Informe a senha atual"),
    newPassword: z.string().min(8, "Mínimo 8 caracteres"),
    confirmPassword: z.string().min(8, "Confirme a senha"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type NameForm = z.infer<typeof nameSchema>;
type EmailForm = z.infer<typeof emailSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const { uid, ready } = useAuth();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<FirebaseUser | null>(null);

  useEffect(() => watchAuth(setUser), []);

  const { data: tenant, isLoading } = useQuery({
    queryKey: ["tenant", uid],
    queryFn: () => tenantApi.get(),
    enabled: ready && !!uid,
  });

  const passwordAccount = hasPasswordProvider(user);
  const googleAccount = hasGoogleProvider(user);

  const nameForm = useForm<NameForm>({
    resolver: zodResolver(nameSchema),
    values: { name: tenant?.name ?? "" },
  });

  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    values: { email: tenant?.email ?? "", currentPassword: "" },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const updateName = useMutation({
    mutationFn: (data: NameForm) => profileApi.updateName(data.name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant", uid] });
      toast.success("Nome atualizado");
    },
    onError: (err: unknown) => toast.error(authErrorMessage(err, "Erro ao atualizar nome")),
  });

  const updateEmail = useMutation({
    mutationFn: (data: EmailForm) => profileApi.updateEmail(data.email, data.currentPassword),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant", uid] });
      emailForm.resetField("currentPassword");
      toast.success("E-mail atualizado");
    },
    onError: (err: unknown) => toast.error(authErrorMessage(err, "Erro ao atualizar e-mail")),
  });

  const updatePassword = useMutation({
    mutationFn: (data: PasswordForm) =>
      profileApi.updatePassword(data.currentPassword, data.newPassword),
    onSuccess: () => {
      passwordForm.reset();
      toast.success("Senha alterada");
    },
    onError: (err: unknown) => toast.error(authErrorMessage(err, "Erro ao alterar senha")),
  });

  const exportData = useMutation({
    mutationFn: () => privacyApi.exportMyData(),
    onSuccess: (payload) => {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `zapflow-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exportação concluída");
    },
    onError: (err: unknown) => toast.error(authErrorMessage(err, "Erro ao exportar dados")),
  });

  if (isLoading || !tenant) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  const initials = (tenant.name || "?").trim().split(/\s+/).slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Profile hero */}
      <div className="rounded-2xl bg-gradient-to-r from-brand-600 to-brand-700 p-5 mb-6 flex items-center gap-4">
        {user?.photoURL ? (
          <img
            src={user.photoURL}
            alt={tenant.name}
            className="w-14 h-14 rounded-full object-cover ring-2 ring-white/30"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-white/20 text-white flex items-center justify-center text-xl font-bold ring-2 ring-white/30 flex-shrink-0">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-white font-semibold text-lg leading-tight truncate">{tenant.name}</p>
          <p className="text-brand-100 text-sm truncate">{tenant.email}</p>
        </div>
        <div className="flex-shrink-0 text-right">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 text-white text-xs font-semibold">
            Plano {PLAN_LABELS[tenant.plan]}
          </span>
        </div>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">

        {/* Left: Dados da conta */}
        <div className="card space-y-5">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2 pb-3 border-b border-gray-100">
            <span className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-brand-600" />
            </span>
            Dados da conta
          </h2>

          {/* Name */}
          <form onSubmit={nameForm.handleSubmit((d) => updateName.mutate(d))} className="space-y-3">
            <div>
              <label className="label">Nome</label>
              <input type="text" className="input" {...nameForm.register("name")} />
              {nameForm.formState.errors.name && (
                <p className="text-xs text-red-500 mt-1">{nameForm.formState.errors.name.message}</p>
              )}
            </div>
            <button type="submit" className="btn-primary w-full" disabled={updateName.isPending}>
              {updateName.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar nome
            </button>
          </form>

          {/* Email */}
          <div className="pt-3 border-t border-gray-100">
            <h3 className="text-sm font-medium text-gray-700 flex items-center gap-1.5 mb-3">
              <Mail className="w-3.5 h-3.5 text-gray-400" />
              E-mail
            </h3>
            {passwordAccount ? (
              <form onSubmit={emailForm.handleSubmit((d) => updateEmail.mutate(d))} className="space-y-3">
                <div>
                  <label className="label">Novo e-mail</label>
                  <input type="email" className="input" {...emailForm.register("email")} />
                  {emailForm.formState.errors.email && (
                    <p className="text-xs text-red-500 mt-1">{emailForm.formState.errors.email.message}</p>
                  )}
                </div>
                <div>
                  <label className="label">Senha atual</label>
                  <input type="password" className="input" {...emailForm.register("currentPassword")} />
                  {emailForm.formState.errors.currentPassword && (
                    <p className="text-xs text-red-500 mt-1">{emailForm.formState.errors.currentPassword.message}</p>
                  )}
                </div>
                <button type="submit" className="btn-primary w-full" disabled={updateEmail.isPending}>
                  {updateEmail.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Atualizar e-mail
                </button>
              </form>
            ) : (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100">
                <Chrome className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-700">
                  Conta vinculada ao Google. O e-mail é gerenciado pela sua conta Google.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Senha */}
        <div className="card">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2 pb-3 border-b border-gray-100 mb-5">
            <span className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center">
              <Lock className="w-3.5 h-3.5 text-brand-600" />
            </span>
            Segurança
          </h2>

          {passwordAccount ? (
            <form
              onSubmit={passwordForm.handleSubmit((d) => updatePassword.mutate(d))}
              className="space-y-3"
            >
              <div>
                <label className="label">Senha atual</label>
                <input type="password" className="input" {...passwordForm.register("currentPassword")} />
                {passwordForm.formState.errors.currentPassword && (
                  <p className="text-xs text-red-500 mt-1">{passwordForm.formState.errors.currentPassword.message}</p>
                )}
              </div>
              <div>
                <label className="label">Nova senha</label>
                <input type="password" className="input" {...passwordForm.register("newPassword")} />
                {passwordForm.formState.errors.newPassword && (
                  <p className="text-xs text-red-500 mt-1">{passwordForm.formState.errors.newPassword.message}</p>
                )}
              </div>
              <div>
                <label className="label">Confirmar nova senha</label>
                <input type="password" className="input" {...passwordForm.register("confirmPassword")} />
                {passwordForm.formState.errors.confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">{passwordForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>
              <button type="submit" className="btn-primary w-full mt-1" disabled={updatePassword.isPending}>
                {updatePassword.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Alterar senha
              </button>
            </form>
          ) : (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100 mb-4">
              <Chrome className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-700">
                Você entrou com Google. A senha é gerenciada pela sua conta Google.
              </p>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 flex items-start gap-1.5">
              <Shield className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              Alterações sensíveis podem exigir login recente. Se aparecer erro, saia e entre novamente.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Plano */}
        <div className="card flex items-center gap-4">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
            tenant.plan === "UNLIMITED" ? "bg-violet-50" :
            tenant.plan === "PRO"       ? "bg-brand-50" :
                                          "bg-gray-100"
          )}>
            <CreditCard className={cn(
              "w-5 h-5",
              tenant.plan === "UNLIMITED" ? "text-violet-600" :
              tenant.plan === "PRO"       ? "text-brand-600" :
                                            "text-gray-500"
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn(
              "font-semibold text-sm",
              tenant.plan === "UNLIMITED" ? "text-violet-700" :
              tenant.plan === "PRO"       ? "text-brand-700" :
                                            "text-gray-700"
            )}>
              Plano {PLAN_LABELS[tenant.plan]}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Gerencie assinatura e pagamento</p>
          </div>
          <Link href="/plan" className="btn-secondary flex-shrink-0 text-sm">
            <CreditCard className="w-4 h-4" />
            Ver plano
          </Link>
        </div>

        {/* Tour */}
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 text-sm">Tour da plataforma</p>
            <p className="text-xs text-gray-500 mt-0.5">Veja o que o ZapFlow pode fazer</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!tenant.onboardingCompletedAt) {
                window.dispatchEvent(new Event("zapflow:open-onboarding"));
              }
            }}
            disabled={Boolean(tenant.onboardingCompletedAt)}
            className="btn-secondary flex-shrink-0 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4" />
            {tenant.onboardingCompletedAt ? "Tour concluído" : "Ver tour"}
          </button>
        </div>

        {/* Exportacao LGPD */}
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <FileDown className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 text-sm">Meus dados</p>
            <p className="text-xs text-gray-500 mt-0.5">Baixe seus dados pessoais (LGPD)</p>
          </div>
          <button
            type="button"
            onClick={() => exportData.mutate()}
            disabled={exportData.isPending}
            className="btn-secondary flex-shrink-0 text-sm"
          >
            {exportData.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            Exportar
          </button>
        </div>
      </div>
    </div>
  );
}
