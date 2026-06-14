import {
  Building2,
  Camera,
  Dumbbell,
  PawPrint,
  Pizza,
  Sparkles,
  Stethoscope,
  Store,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Marquee } from "@/components/ui/marquee";
import { APP_DISPLAY_NAME } from "@flowdesk/shared";
import { cn } from "@/lib/utils";

const STATS = [
  { value: "500+", label: "negócios ativos" },
  { value: "12k+", label: "agendamentos/mês" },
  { value: "< 30s", label: "tempo de resposta" },
  { value: "4.9", label: "avaliação média" },
] as const;

type Testimonial = {
  id: string;
  business: string;
  segment: string;
  quote: string;
  author: string;
  icon: LucideIcon;
};

const TESTIMONIALS: Testimonial[] = [
  {
    id: "estudio-beleza",
    business: "Estúdio Beleza",
    segment: "Estética",
    quote: "Agendamento no WhatsApp sem eu pegar no celular o dia todo.",
    author: "Marcos · São Paulo",
    icon: Sparkles,
  },
  {
    id: "studio-bella",
    business: "Studio Bella",
    segment: "Salão",
    quote: "Cliente marca manicure e paga sinal via PIX antes de vir.",
    author: "Camila · Curitiba",
    icon: Sparkles,
  },
  {
    id: "burger-47",
    business: "Burger House 47",
    segment: "Hamburgueria",
    quote: "Pedidos e horário de retirada respondidos na hora, 24h.",
    author: "Rafael · Belo Horizonte",
    icon: UtensilsCrossed,
  },
  {
    id: "clinica-sorriso",
    business: "Clínica Sorriso",
    segment: "Dentista",
    quote: "Lembretes de consulta automáticos reduziram faltas pela metade.",
    author: "Dra. Ana · Recife",
    icon: Stethoscope,
  },
  {
    id: "mercado-bairro",
    business: "Mercado do Bairro",
    segment: "Comércio",
    quote: "FAQ de horário e entrega parou de encher minha equipe.",
    author: "Paulo · Porto Alegre",
    icon: Building2,
  },
  {
    id: "auto-center",
    business: "Auto Center",
    segment: "Oficina",
    quote: "Dobrei os agendamentos no fim de semana sem contratar ninguém.",
    author: "Ricardo · Brasília",
    icon: Wrench,
  },
  {
    id: "pizzaria-roma",
    business: "Pizzaria Roma",
    segment: "Restaurante",
    quote: "Reservas de mesa e pedidos para viagem no automático.",
    author: "Lucas · Fortaleza",
    icon: Pizza,
  },
  {
    id: "pet-amigo",
    business: "Pet Shop Amigo",
    segment: "Pet shop",
    quote: "Banho e tosa agendados com confirmação automática.",
    author: "Fernanda · Salvador",
    icon: PawPrint,
  },
  {
    id: "academia-fit",
    business: "Academia Fit",
    segment: "Academia",
    quote: "Vendas guiadas qualificam lead antes de eu ligar.",
    author: "Diego · Campinas",
    icon: Dumbbell,
  },
  {
    id: "espaco-unhas",
    business: "Espaço Unhas",
    segment: "Manicure",
    quote: "Lista de espera e reagendamento sem mensagem perdida.",
    author: "Patrícia · Goiânia",
    icon: Sparkles,
  },
  {
    id: "foto-luz",
    business: "Foto & Luz",
    segment: "Fotografia",
    quote: "PIX do sinal cai antes da sessão começar.",
    author: "Thiago · Rio de Janeiro",
    icon: Camera,
  },
  {
    id: "lanches-praca",
    business: "Lanches da Praça",
    segment: "Lanchonete",
    quote: "Cardápio e promo do dia respondidos sozinhos.",
    author: "Renata · Manaus",
    icon: UtensilsCrossed,
  },
  {
    id: "studio-hair",
    business: "Studio Hair",
    segment: "Salão",
    quote: "Coloração e corte com horário confirmado em segundos.",
    author: "Juliana · Florianópolis",
    icon: Sparkles,
  },
  {
    id: "clinica-vet",
    business: "Clínica Vet Centro",
    segment: "Veterinário",
    quote: "Consultas e vacinas com lembrete um dia antes.",
    author: "Dr. Pedro · Vitória",
    icon: PawPrint,
  },
  {
    id: "loja-moderna",
    business: "Loja Moderna",
    segment: "Varejo",
    quote: "Status do pedido e troca sem fila no balcão.",
    author: "Carla · Natal",
    icon: Store,
  },
  {
    id: "odonto-plus",
    business: "Odonto Plus",
    segment: "Dentista",
    quote: "Paciente novo tira dúvida de convênio antes da visita.",
    author: "Dra. Luiza · São Luís",
    icon: Stethoscope,
  },
  {
    id: "smash-burger",
    business: "Smash Burger Co.",
    segment: "Hamburgueria",
    quote: "Pico do almoço sem atraso: fila virtual no WhatsApp.",
    author: "André · Belém",
    icon: UtensilsCrossed,
  },
  {
    id: "consultoria-nova",
    business: "Consultoria Nova",
    segment: "Serviços",
    quote: "Cliente VIP lembra horário sozinho toda semana.",
    author: "Felipe · Cuiabá",
    icon: Building2,
  },
  {
    id: "cafe-central",
    business: "Café Central",
    segment: "Cafeteria",
    quote: "Encomendas de festa e retirada organizadas no chat.",
    author: "Beatriz · João Pessoa",
    icon: Store,
  },
  {
    id: "salao-glam",
    business: "Salão Glam",
    segment: "Salão",
    quote: "Escova e progressiva com depósito via PIX automático.",
    author: "Aline · Maceió",
    icon: Sparkles,
  },
];

const firstRow = TESTIMONIALS.slice(0, TESTIMONIALS.length / 2);
const secondRow = TESTIMONIALS.slice(TESTIMONIALS.length / 2);

function TestimonialCard({
  business,
  segment,
  quote,
  author,
  icon: Icon,
}: Testimonial) {
  return (
    <figure
      className={cn(
        "w-64 shrink-0 cursor-default rounded-xl border p-4",
        "border-border/80 bg-card shadow-sm",
      )}
    >
      <div className="flex flex-row items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
          <Icon className="size-3.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <figcaption className="truncate text-sm font-medium text-foreground">
            {business}
          </figcaption>
          <p className="truncate text-xs text-muted-foreground">{segment}</p>
        </div>
      </div>
      <blockquote className="mt-2 text-sm leading-snug text-foreground/90">
        &ldquo;{quote}&rdquo;
      </blockquote>
      <p className="mt-2 text-xs font-medium text-primary">{author}</p>
    </figure>
  );
}

export function LandingSocialProof({ adMode = false }: { adMode?: boolean }) {
  return (
    <section
      id="clientes"
      aria-labelledby="social-proof-heading"
      className="relative scroll-mt-24 overflow-x-hidden border-t border-brand-200/50 bg-gradient-to-b from-brand-50 via-white to-[#f0f7f2] py-16 sm:py-24"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,197,94,0.12),transparent)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">
            Nossos clientes
          </p>
          <h2
            id="social-proof-heading"
            className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
          >
            {adMode
              ? "Quem já usa não volta ao atendimento manual"
              : "Negócios locais que já automatizaram o WhatsApp"}
          </h2>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">
            Comércios, serviços e clínicas locais usando o {APP_DISPLAY_NAME} todos
            os dias.
          </p>
        </div>

        <dl className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4 sm:gap-8">
          {STATS.map(({ value, label }) => (
            <div key={label} className="text-center">
              <dt className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">
                {value}
              </dt>
              <dd className="mt-1 text-sm text-muted-foreground">{label}</dd>
            </div>
          ))}
        </dl>

        <div className="relative mt-14 flex w-full flex-col items-center justify-center gap-4 overflow-x-hidden overflow-y-visible py-2 [mask-image:linear-gradient(to_right,transparent_0%,black_10%,black_90%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_right,transparent_0%,black_10%,black_90%,transparent_100%)]">
          <Marquee pauseOnHover className="py-1 [--duration:50s] [--gap:1rem]">
            {firstRow.map((item) => (
              <TestimonialCard key={item.id} {...item} />
            ))}
          </Marquee>
          <Marquee
            reverse
            pauseOnHover
            className="py-1 [--duration:50s] [--gap:1rem]"
          >
            {secondRow.map((item) => (
              <TestimonialCard key={item.id} {...item} />
            ))}
          </Marquee>
        </div>
      </div>
    </section>
  );
}
