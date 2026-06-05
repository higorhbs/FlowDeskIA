"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  authErrorMessage,
  loginWithEmail,
  registerWithEmail,
  resendVerificationEmail,
  refreshVerifiedSession,
} from "@/lib/firebase-auth";
import { getClientAuth } from "@flowdesk/firebase/client";
import { APP_DISPLAY_NAME, STARTER_TRIAL_DAYS } from "@flowdesk/shared";
import { setToken } from "@/lib/auth";
import { trackGoogleAdsSignUp } from "@/lib/google-ads-events";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { AuthDivider } from "@/components/auth/AuthDivider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageSquare, Loader2, ShieldCheck, MailCheck, RefreshCw, X } from "lucide-react";

function AuthLegalNotice() {
  return (
    <div
      role="note"
      className="mt-8 border-t border-border/70 pt-6"
      aria-label="Termos legais"
    >
      <div>
        <div className="flex gap-2.5">
          <ShieldCheck
            className="mt-0.5 size-4 shrink-0 text-primary"
            aria-hidden
          />
          <p className="text-pretty text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Ao criar sua conta, você concorda com nossos documentos legais.
          </p>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:ml-6 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
          <Link
            href="/privacy"
            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary sm:text-sm"
            target="_blank"
            rel="noopener noreferrer"
          >
            Política de Privacidade
          </Link>
          <Link
            href="/terms"
            className="inline-flex min-h-9 items-center justify-center rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary sm:text-sm"
            target="_blank"
            rel="noopener noreferrer"
          >
            Termos de Uso
          </Link>
        </div>
      </div>
    </div>
  );
}

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

const registerSchema = z.object({
  name: z.string().min(2, "Nome muito curto"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
});

type LoginData = z.infer<typeof loginSchema>;
type RegisterData = z.infer<typeof registerSchema>;
export type AuthMode = "login" | "register";

type AuthDrawerProps = {
  open: boolean;
  mode: AuthMode;
  onClose: () => void;
  onModeChange: (mode: AuthMode) => void;
};

function LoginForm({ onSwitch }: { onSwitch: () => void }) {
  const router = useRouter();
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginData>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginData) {
    try {
      const res = await loginWithEmail(data.email, data.password);
      if (res.status === "VERIFICATION_REQUIRED") {
        setVerificationEmail(res.email);
        toast.warning("Enviamos um e-mail de confirmação. Verifique sua caixa de entrada.");
        return;
      }
      setToken(res.token);
      router.push("/dashboard");
    } catch (err: unknown) {
      toast.error(authErrorMessage(err, "Falha ao entrar"));
    }
  }

  if (verificationEmail) {
    return <VerificationPrompt email={verificationEmail} onBack={() => setVerificationEmail(null)} />;
  }

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">
        Entrar na conta
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        Acesse seu painel de atendimento
      </p>
      <GoogleSignInButton />
      <AuthDivider />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="login-email">E-mail</Label>
          <Input
            id="login-email"
            type="email"
            placeholder="seu@email.com"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="login-password">Senha</Label>
          <Input
            id="login-password"
            type="password"
            placeholder="••••••••"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-xs text-red-500 mt-1">
              {errors.password.message}
            </p>
          )}
        </div>
        <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Entrar
        </Button>
      </form>
      <p className="text-center text-sm text-gray-500 mt-6">
        Não tem conta?{" "}
        <button
          type="button"
          onClick={onSwitch}
          className="text-brand-600 font-medium hover:underline"
        >
          Criar grátis
        </button>
      </p>
    </div>
  );
}

function RegisterForm({ onSwitch }: { onSwitch: () => void }) {
  const router = useRouter();
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterData>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(data: RegisterData) {
    try {
      const res = await registerWithEmail(data.name, data.email, data.password);
      if (res.status === "VERIFICATION_REQUIRED") {
        setVerificationEmail(res.email);
        toast.success("Enviamos um link de confirmação para seu e-mail.");
        return;
      }
      setToken(res.token);
      trackGoogleAdsSignUp();
      router.replace("/dashboard");
    } catch (err: unknown) {
      const user = getClientAuth().currentUser;
      if (user) {
        toast.warning("Conta criada, mas ainda falta confirmar o e-mail.");
        return;
      }
      toast.error(authErrorMessage(err, "Falha ao criar conta"));
    }
  }

  if (verificationEmail) {
    return <VerificationPrompt email={verificationEmail} onBack={() => setVerificationEmail(null)} />;
  }

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">
        Criar conta grátis
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        {STARTER_TRIAL_DAYS} dias sem precisar de cartão
      </p>
      <GoogleSignInButton />
      <AuthDivider />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="register-name">Nome do responsável</Label>
          <Input
            id="register-name"
            type="text"
            placeholder="João Silva"
            {...register("name")}
          />
          {errors.name && (
            <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="register-email">E-mail</Label>
          <Input
            id="register-email"
            type="email"
            placeholder="seu@email.com"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="register-password">Senha</Label>
          <Input
            id="register-password"
            type="password"
            placeholder="Mínimo 8 caracteres"
            {...register("password")}
          />
          {errors.password && (
            <p className="text-xs text-red-500 mt-1">
              {errors.password.message}
            </p>
          )}
        </div>
        <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Criar minha conta
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <button
          type="button"
          onClick={onSwitch}
          className="font-medium text-primary hover:underline"
        >
          Entrar
        </button>
      </p>

      <AuthLegalNotice />
    </div>
  );
}

function VerificationPrompt({ email, onBack }: { email: string; onBack: () => void }) {
  const router = useRouter();
  const [loadingResend, setLoadingResend] = useState(false);
  const [loadingConfirm, setLoadingConfirm] = useState(false);

  async function handleResend() {
    setLoadingResend(true);
    try {
      await resendVerificationEmail();
      toast.success("E-mail de confirmação reenviado.");
    } catch (err: unknown) {
      toast.error(authErrorMessage(err, "Não foi possível reenviar o e-mail"));
    } finally {
      setLoadingResend(false);
    }
  }

  async function handleConfirm() {
    setLoadingConfirm(true);
    try {
      const res = await refreshVerifiedSession();
      setToken(res.token);
      trackGoogleAdsSignUp();
      toast.success("E-mail confirmado. Abrindo o painel...");
      router.replace("/dashboard");
    } catch (err: unknown) {
      toast.error(authErrorMessage(err, "Ainda não conseguimos validar sua confirmação"));
    } finally {
      setLoadingConfirm(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Confirme seu e-mail</h2>
      <p className="text-sm text-gray-500 mb-6">
        Enviamos um link para <strong>{email}</strong>. O acesso ao painel fica liberado apenas após a confirmação.
      </p>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-6 text-sm text-amber-900">
        <div className="flex gap-2 items-start">
          <MailCheck className="w-4 h-4 mt-0.5" />
          <p>Abra sua caixa de entrada, confirme o endereço e volte aqui para liberar o acesso.</p>
        </div>
      </div>

      <div className="space-y-3">
        <Button type="button" className="h-10 w-full" onClick={handleConfirm} disabled={loadingConfirm || loadingResend}>
          {loadingConfirm ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          Já confirmei, entrar
        </Button>
        <Button type="button" variant="secondary" className="h-10 w-full" onClick={handleResend} disabled={loadingResend || loadingConfirm}>
          {loadingResend ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Reenviar e-mail
        </Button>
        <Button type="button" variant="ghost" className="h-10 w-full" onClick={onBack} disabled={loadingResend || loadingConfirm}>
          Voltar ao formulário
        </Button>
      </div>
    </div>
  );
}

export function AuthDrawer({
  open,
  mode,
  onClose,
  onModeChange,
}: AuthDrawerProps) {
  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
      />

      <div
        className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-white shadow-2xl flex flex-col transition-transform duration-500 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900">{APP_DISPLAY_NAME}</span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex border-b border-gray-100">
          <button
            onClick={() => onModeChange("login")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              mode === "login"
                ? "text-brand-600 border-b-2 border-brand-600"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Entrar
          </button>
          <button
            onClick={() => onModeChange("register")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              mode === "register"
                ? "text-brand-600 border-b-2 border-brand-600"
                : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Criar conta
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {mode === "login" ? (
            <LoginForm onSwitch={() => onModeChange("register")} />
          ) : (
            <RegisterForm onSwitch={() => onModeChange("login")} />
          )}
        </div>
      </div>
    </>
  );
}
