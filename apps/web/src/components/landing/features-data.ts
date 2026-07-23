import {
  Bot,
  CalendarCheck,
  HelpCircle,
  LayoutDashboard,
  QrCode,
  ShoppingBag,
  Wallet,
  Workflow,
  type LucideIcon,
} from "lucide-react";

export type LandingFeature = {
  id: string;
  icon: LucideIcon;
  title: string;
  desc: string;
  detail: string;
};

export const LANDING_FEATURES: LandingFeature[] = [
  {
    id: "menu-24h",
    icon: Bot,
    title: "Menu automático 24h",
    desc: "Bot responde e guia o cliente a qualquer hora, mesmo fora do expediente.",
    detail: "Menu numerado por tipo de negócio + mensagem de ausência configurável.",
  },
  {
    id: "agendamento",
    icon: CalendarCheck,
    title: "Agendamento guiado",
    desc: "Serviço, data e horário confirmados sozinhos, direto no chat.",
    detail: "Fluxo guiado com confirmação automática e consulta de horário marcado.",
  },
  {
    id: "catalogo",
    icon: ShoppingBag,
    title: "Catálogo e orçamento",
    desc: "Cliente pede preço e recebe serviços ou produtos na hora.",
    detail: "Catálogo com preço e descrição, limite de itens por plano.",
  },
  {
    id: "faq",
    icon: HelpCircle,
    title: "FAQ inteligente",
    desc: "Palavras-chave configuradas no painel respondem dúvidas sozinhas.",
    detail: "Reduz mensagens repetitivas sem precisar de atendente humano.",
  },
  {
    id: "fluxo",
    icon: Workflow,
    title: "Fluxo conversacional",
    desc: "Passos com botões e imagens conduzem vendas guiadas e captam leads.",
    detail: "Ramificações configuráveis pelo painel, sem precisar programar.",
  },
  {
    id: "pix",
    icon: Wallet,
    title: "Cobrança PIX automática",
    desc: "QR Code e copia-e-cola direto na conversa, via Asaas.",
    detail: "Disponível nos planos Pro e Unlimited.",
  },
  {
    id: "atendimento",
    icon: QrCode,
    title: "Conexão fácil",
    desc: "Ligue seu número em segundos escaneando um QR Code.",
    detail: "Sem instalar nada — o bot assume assim que conectar.",
  },
  {
    id: "painel",
    icon: LayoutDashboard,
    title: "Painel completo",
    desc: "Conversas, agenda e métricas do negócio em um só lugar.",
    detail: "Assuma o atendimento humano quando quiser, direto pelo painel.",
  },
];
