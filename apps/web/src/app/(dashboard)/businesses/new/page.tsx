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
import { authErrorMessage } from "@/lib/firebase-auth";

const schema = z.object({
  name: z.string().min(2, "Nome muito curto"),
  type: z.enum(["BARBERSHOP", "SALON", "RESTAURANT", "DENTAL", "STORE", "OTHER"]),
  whatsapp: z
    .string()
    .min(10, "Informe o número com DDI (ex.: 5531999999999)")
    .max(20, "Número muito longo"),
  description: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

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
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: "STORE" },
  });

  async function onSubmit(data: FormData) {
    if (existingBusiness) {
      toast.error("Sua conta já possui um negócio cadastrado.");
      router.replace(`/businesses/${existingBusiness.id}/settings`);
      return;
    }
    try {
      const business = await businessApi.create({
        name: data.name.trim(),
        type: data.type,
        whatsapp: data.whatsapp.replace(/\D/g, ""),
        description: data.description?.trim() || undefined,
      });
      queryClient.setQueryData(["businesses", uid], [business]);
      await queryClient.invalidateQueries({ queryKey: ["businesses", uid] });
      toast.success("Negócio criado com sucesso!");
      router.push(`/businesses/${business.id}/whatsapp`);
    } catch (err: unknown) {
      const code = err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";
      if (code) {
        toast.error(authErrorMessage(err, "Erro ao criar negócio"));
      } else {
        toast.error(err instanceof Error ? err.message : "Erro ao criar negócio");
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50 py-8 px-4 md:px-8">
      <div className="max-w-3xl mx-auto">
        {checkingBusiness ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : existingBusiness ? (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Negócio já cadastrado</h2>
            <p className="text-sm text-gray-500 mb-4">
              Sua conta permite apenas um negócio. Você pode editar os dados existentes.
            </p>
            <Link href={`/businesses/${existingBusiness.id}/settings`} className={buttonVariants()}>
              Ir para configurações
            </Link>
          </Card>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-10">
              {!setupRequired && (
                <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                  <ArrowLeft className="w-5 h-5" />
                </Link>
              )}
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {setupRequired ? "Crie seu negócio" : "Novo negócio"}
                </h1>
                <p className="text-gray-500 mt-1">
                  {setupRequired
                    ? "Último passo: nome, tipo, WhatsApp e uma descrição opcional."
                    : "Cadastre o básico para conectar o WhatsApp depois."}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <Card className="p-6 space-y-6">
                <div className="space-y-1.5">
                  <Label>Nome do negócio *</Label>
                  <Input type="text" placeholder="Meu Negócio" {...register("name")} />
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
                  <Label>Número do WhatsApp *</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="5531999999999"
                    {...register("whatsapp")}
                  />
                  <p className="text-xs text-muted-foreground">Somente dígitos, com código do país (55).</p>
                  {errors.whatsapp && (
                    <p className="text-xs text-red-500 mt-1">{errors.whatsapp.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Descrição</Label>
                  <Textarea
                    className="min-h-24 resize-none"
                    placeholder="Breve descrição do seu negócio (opcional)"
                    {...register("description")}
                  />
                </div>
              </Card>

              <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {setupRequired ? "Criar meu negócio e continuar" : "Criar negócio e conectar WhatsApp"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
