"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { businessApi } from "@/lib/api";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BusinessTypePicker } from "@/components/business/BusinessTypePicker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/auth-context";
import { useRequiresBusinessSetup } from "@/hooks/use-requires-business-setup";

const schema = z.object({
  name: z.string().min(2, "Nome muito curto"),
  type: z.enum(["BARBERSHOP", "SALON", "RESTAURANT", "DENTAL", "STORE", "OTHER"]),
  phone: z.string().min(10, "Telefone inválido"),
  address: z.string().optional(),
  description: z.string().optional(),
  greetingMsg: z.string().optional(),
  awayMsg: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_PT = { mon: "Seg", tue: "Ter", wed: "Qua", thu: "Qui", fri: "Sex", sat: "Sáb", sun: "Dom" };

export default function NewBusinessPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { uid, ready } = useAuth();
  const { active: setupRequired } = useRequiresBusinessSetup();
  const { data: businesses, isLoading: checkingBusiness } = useQuery({
    queryKey: ["businesses", uid],
    queryFn: businessApi.list,
    enabled: ready && !!uid,
  });
  const existingBusiness = businesses?.[0];
  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: "BARBERSHOP",
      greetingMsg: "Olá {nome}! Bem-vindo ao {negocio} 😊 Como posso ajudar?",
      awayMsg: "Olá! No momento estamos fechados, mas logo retornamos. Deixe sua mensagem!",
    },
  });

  async function onSubmit(data: FormData) {
    if (existingBusiness) {
      toast.error("Sua conta já possui um negócio cadastrado.");
      router.replace(`/businesses/${existingBusiness.id}/settings`);
      return;
    }
    try {
      const workingHours: Record<string, [string, string] | null> = {};
      DAY_KEYS.forEach((d) => { workingHours[d] = d === "sun" ? null : ["09:00", "18:00"]; });

      const business = await businessApi.create({ ...data, workingHours });
      await queryClient.invalidateQueries({ queryKey: ["businesses", uid] });
      toast.success("Negócio criado com sucesso!");
      router.push(`/businesses/${business.id}/whatsapp`);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? "Erro ao criar negócio");
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      {checkingBusiness ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : existingBusiness ? (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Negócio já cadastrado</h2>
          <p className="text-sm text-gray-500 mb-4">Sua conta permite apenas um negócio. Você pode editar os dados existentes.</p>
          <Link href={`/businesses/${existingBusiness.id}/settings`} className={buttonVariants()}>
            Ir para configurações
          </Link>
        </Card>
      ) : (
        <>
      <div className="flex items-center gap-3 mb-8">
        {!setupRequired && (
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {setupRequired ? "Crie seu negócio" : "Novo negócio"}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {setupRequired
              ? "Último passo para começar: cadastre seu negócio e conecte o WhatsApp."
              : "Configure seu negócio para usar o atendimento automático"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card className="space-y-4">
          <h2 className="font-semibold text-gray-900">Informações básicas</h2>

          <div className="space-y-1.5">
            <Label>Nome do negócio *</Label>
            <Input type="text" placeholder="Barbearia do João" {...register("name")} />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Tipo de negócio *</Label>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <BusinessTypePicker
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.type?.message}
                />
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Número do WhatsApp Business *</Label>
            <Input type="text" placeholder="+55 11 99999-9999" {...register("phone")} />
            {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Endereço</Label>
            <Input type="text" placeholder="Rua das Flores, 123 - São Paulo/SP" {...register("address")} />
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea className="min-h-20 resize-none" placeholder="Breve descrição do seu negócio..." {...register("description")} />
          </div>
        </Card>

        <Card className="space-y-4">
          <h2 className="font-semibold text-gray-900">Mensagens automáticas</h2>
          <p className="text-sm text-gray-500">Use {`{nome}`} e {`{negocio}`} como variáveis dinâmicas.</p>

          <div className="space-y-1.5">
            <Label>Mensagem de boas-vindas</Label>
            <Textarea className="min-h-24 resize-none" {...register("greetingMsg")} />
          </div>

          <div className="space-y-1.5">
            <Label>Mensagem fora do horário</Label>
            <Textarea className="min-h-24 resize-none" {...register("awayMsg")} />
          </div>
        </Card>

        <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {setupRequired ? "Criar meu negócio e continuar" : "Criar negócio e conectar WhatsApp"}
        </Button>
      </form>
        </>
      )}
    </div>
  );
}
