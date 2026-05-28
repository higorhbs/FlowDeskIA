"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  authErrorMessage,
  loginWithEmail,
  registerWithEmail,
} from "@/lib/firebase-auth";
import { getClientAuth } from "@zapflow/firebase/client";
import { setToken } from "@/lib/auth";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { AuthDivider } from "@/components/auth/AuthDivider";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import {
  MessageSquare,
  Loader2,
  X,
  Bot,
  CalendarCheck,
  CreditCard,
  Zap,
  ChevronRight,
  Star,
} from "lucide-react";

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

const TESTIMONIALS = [
  {
    name: "Rafael Mendes",
    role: "Barbearia do Rafael",
    initials: "RM",
    color: "bg-blue-600",
    text: "Minha agenda lotou em 2 semanas. O bot agenda sozinho e cobra o sinal via PIX.",
  },
  {
    name: "Camila Oliveira",
    role: "Studio Cami — Manicure",
    initials: "CF",
    color: "bg-pink-500",
    text: "Economizo 3 horas por dia. Hoje o bot resolve tudo e eu só confirmo. Valeu cada centavo.",
  },
  {
    name: "Marcos Oliveira",
    role: "Loja do Marcos — Varejo",
    initials: "MO",
    color: "bg-purple-600",
    text: "Coloquei o FAQ com horário e endereço e os clientes param de me ligar. Simples assim.",
  },
];

const features = [
  { icon: Bot, title: "Atendimento 24h", desc: "Responde clientes no WhatsApp fora do horário." },
  { icon: CalendarCheck, title: "Agendamento", desc: "Clientes agendam sozinhos, sem ligação." },
  { icon: CreditCard, title: "Cobrança PIX", desc: "QR Code e copia-e-cola direto na conversa." },
  { icon: Zap, title: "FAQ automático", desc: "Responde as dúvidas mais frequentes na hora." },
];

function LoginForm({ onSwitch }: { onSwitch: () => void }) {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<LoginData>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginData) {
    try {
      const res = await loginWithEmail(data.email, data.password);
      setToken(res.token);
      router.push("/dashboard");
    } catch (err: unknown) {
      toast.error(authErrorMessage(err, "Falha ao entrar"));
    }
  }

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Entrar na conta</h2>
      <p className="text-sm text-gray-500 mb-6">Acesse seu painel de atendimento</p>
      <GoogleSignInButton />
      <AuthDivider />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">E-mail</label>
          <input type="email" className="input" placeholder="seu@email.com" {...register("email")} />
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <label className="label">Senha</label>
          <input type="password" className="input" placeholder="••••••••" {...register("password")} />
          {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
        </div>
        <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Entrar
        </button>
      </form>
      <p className="text-center text-sm text-gray-500 mt-6">
        Não tem conta?{" "}
        <button type="button" onClick={onSwitch} className="text-brand-600 font-medium hover:underline">
          Criar grátis
        </button>
      </p>
    </div>
  );
}

function RegisterForm({ onSwitch }: { onSwitch: () => void }) {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<RegisterData>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(data: RegisterData) {
    try {
      const res = await registerWithEmail(data.name, data.email, data.password);
      setToken(res.token);
      router.replace("/dashboard");
    } catch (err: unknown) {
      const user = getClientAuth().currentUser;
      if (user) {
        const token = await user.getIdToken();
        setToken(token);
        router.replace("/dashboard");
        toast.warning("Conta criada. Se algo faltar, recarregue a página.");
        return;
      }
      toast.error(authErrorMessage(err, "Falha ao criar conta"));
    }
  }

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Criar conta grátis</h2>
      <p className="text-sm text-gray-500 mb-6">14 dias sem precisar de cartão</p>
      <GoogleSignInButton />
      <AuthDivider />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Nome do responsável</label>
          <input type="text" className="input" placeholder="João Silva" {...register("name")} />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label className="label">E-mail</label>
          <input type="email" className="input" placeholder="seu@email.com" {...register("email")} />
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <label className="label">Senha</label>
          <input type="password" className="input" placeholder="Mínimo 8 caracteres" {...register("password")} />
          {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
        </div>
        <button type="submit" className="btn-primary w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Criar minha conta
        </button>
      </form>
      <p className="text-center text-sm text-gray-500 mt-6">
        Já tem conta?{" "}
        <button type="button" onClick={onSwitch} className="text-brand-600 font-medium hover:underline">
          Entrar
        </button>
      </p>
    </div>
  );
}

type AuthMode = "login" | "register" | null;

export function LoginScreen() {
  const [authMode, setAuthMode] = useState<AuthMode>(null);
  const isOpen = authMode !== null;

  function open(mode: "login" | "register") { setAuthMode(mode); }
  function close() { setAuthMode(null); }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gradient-to-br from-brand-50 via-white to-brand-50">

      {/* Header */}
      <header className="flex-none h-14 px-8 flex items-center justify-between border-b border-gray-100 bg-white/70 backdrop-blur">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-600 rounded-xl flex items-center justify-center shadow-sm">
            <MessageSquare className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900">ZapFlow</span>
        </Link>
        <nav className="flex items-center gap-5">
          <Link href="/plans" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
            Planos
          </Link>
          <button onClick={() => open("login")} className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors">
            Entrar
          </button>
        </nav>
      </header>

      {/* Conteúdo centralizado */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 gap-6">

        {/* Hero */}
        <div className="w-full max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-3 py-1 text-xs font-medium text-brand-700 mb-4">
            <Zap className="w-3 h-3" />
            Para negócios locais que usam WhatsApp
          </span>
          <h1 className="text-4xl font-bold text-gray-900 leading-tight mb-3">
            Seu WhatsApp no{" "}
            <span className="text-brand-600">piloto automático.</span>
          </h1>
          <p className="text-base text-gray-500 mb-6 max-w-xl">
            Barbearia, salão, hamburgueria, dentista ou loja de bairro — atenda melhor e nunca perca um cliente.
          </p>
          <div className="flex items-center gap-3">
            <button onClick={() => open("register")} className="btn-primary px-6 py-3 text-sm gap-2">
              Começar grátis
              <ChevronRight className="w-4 h-4" />
            </button>
            <button onClick={() => open("login")} className="text-sm font-medium text-gray-600 hover:text-brand-600 transition-colors flex items-center gap-1.5">
              Já tenho conta
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-4 gap-3 w-full max-w-3xl">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm text-center hover:shadow-md transition-shadow">
              <div className="w-9 h-9 bg-brand-50 rounded-lg flex items-center justify-center mb-2 mx-auto">
                <Icon className="w-4 h-4 text-brand-600" />
              </div>
              <h3 className="text-xs font-semibold text-gray-900 mb-1">{title}</h3>
              <p className="text-[11px] text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Depoimentos */}
        <div className="w-full max-w-3xl bg-brand-600 rounded-2xl p-5">
          <p className="text-sm font-semibold text-white text-center mb-4">Quem usou, recomendou! 🚀</p>
          <div className="grid grid-cols-3 gap-3">
            {TESTIMONIALS.map(({ name, role, initials, text }) => (
              <div key={name} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-1 mb-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-xs text-gray-600 leading-relaxed mb-3">"{text}"</p>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-[10px] font-bold flex-shrink-0">
                    {initials}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800 leading-none">{name}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Overlay */}
      <div
        onClick={close}
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Auth panel */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-white shadow-2xl flex flex-col transition-transform duration-500 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900">ZapFlow</span>
          </div>
          <button
            onClick={close}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setAuthMode("login")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              authMode === "login" ? "text-brand-600 border-b-2 border-brand-600" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Entrar
          </button>
          <button
            onClick={() => setAuthMode("register")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              authMode === "register" ? "text-brand-600 border-b-2 border-brand-600" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Criar conta
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {authMode === "login" ? (
            <LoginForm onSwitch={() => setAuthMode("register")} />
          ) : (
            <RegisterForm onSwitch={() => setAuthMode("login")} />
          )}
        </div>
      </div>
    </div>
  );
}
