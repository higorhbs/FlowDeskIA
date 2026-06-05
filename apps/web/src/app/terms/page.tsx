import { APP_DISPLAY_NAME, formatLegalDocument } from "@flowdesk/shared";
import { getLegalEntityConfig } from "@/lib/legal-config";
import { LGPD_POLICY_VERSION } from "@/lib/lgpd-policy";

export default function TermsPage() {
  const legal = getLegalEntityConfig();
  const docLabel = legal.type === "CNPJ" ? "CNPJ" : "CPF";
  const docFormatted = formatLegalDocument(legal.type, legal.document);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-6 md:p-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Termos de Uso</h1>
        <p className="text-sm text-gray-500 mb-8">Versão {LGPD_POLICY_VERSION}</p>

        <section className="space-y-6 text-sm text-gray-700">
          <div>
            <h2 className="font-semibold text-gray-900 mb-2">1. Partes e serviço</h2>
            <p>
              Estes termos regem o uso do {APP_DISPLAY_NAME}, oferecido por <strong>{legal.name}</strong>
              {docFormatted ? (
                <>
                  , {docLabel} <strong>{docFormatted}</strong>
                </>
              ) : null}
              . Ao criar conta ou utilizar o painel, você declara ter lido e aceito estes termos e a
              Política de Privacidade (versão {LGPD_POLICY_VERSION}).
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-gray-900 mb-2">2. Uso permitido</h2>
            <p>
              A plataforma destina-se à gestão de atendimento, automação de mensagens no WhatsApp,
              agendamentos, catálogo e funcionalidades comerciais do seu negócio. Você deve utilizar
              o serviço em conformidade com a lei, as políticas do WhatsApp/Meta e os direitos dos
              seus clientes finais.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-gray-900 mb-2">3. Responsabilidades do usuário</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Garantir base legal para tratar dados dos clientes que você inserir na plataforma.</li>
              <li>Manter credenciais e conexão do WhatsApp sob sua guarda.</li>
              <li>Não enviar spam, conteúdo ilícito ou mensagens em desacordo com o consentimento do destinatário.</li>
              <li>Informar dados verdadeiros no cadastro do negócio.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-semibold text-gray-900 mb-2">4. Planos e pagamento</h2>
            <p>
              Planos pagos são cobrados conforme condições exibidas no painel. Cancelamentos e
              reembolsos seguem a legislação aplicável e as regras do provedor de pagamento (ex.:
              Stripe). O trial, quando oferecido, encerra automaticamente na data indicada.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-gray-900 mb-2">5. Integrações de terceiros</h2>
            <p>
              O serviço pode depender de Google, Firebase, Stripe, Asaas, WhatsApp e outros
              provedores. Indisponibilidades ou mudanças nesses serviços podem afetar funcionalidades
              sem que isso configure inadimplemento imediato por parte do {APP_DISPLAY_NAME}.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-gray-900 mb-2">6. Privacidade e exclusão</h2>
            <p>
              O tratamento de dados pessoais é descrito na Política de Privacidade. Você pode exportar
              ou excluir sua conta em Meu perfil. Dúvidas:{" "}
              <a href={`mailto:${legal.privacyEmail}`} className="text-brand-600 hover:underline">
                {legal.privacyEmail}
              </a>
              .
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-gray-900 mb-2">7. Limitação de responsabilidade</h2>
            <p>
              O serviço é fornecido na medida das funcionalidades disponíveis. Não nos
              responsabilizamos por perdas indiretas, lucros cessantes ou uso indevido da automação
              pelo usuário. A responsabilidade total, quando aplicável, limita-se aos valores pagos
              nos últimos 12 meses pelo plano contratado.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-gray-900 mb-2">8. Alterações e contato</h2>
            <p>
              Podemos atualizar estes termos; o uso continuado após mudança relevante implica
              concordância com a nova versão. Suporte:{" "}
              <a href={`mailto:${legal.supportEmail}`} className="text-brand-600 hover:underline">
                {legal.supportEmail}
              </a>
              .
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
