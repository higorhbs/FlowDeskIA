import { APP_DISPLAY_NAME, formatLegalDocument } from "@flowdesk/shared";
import { getLegalEntityConfig } from "@/lib/legal-config";
import { LGPD_POLICY_VERSION } from "@/lib/lgpd-policy";

export default function PrivacyPage() {
  const legal = getLegalEntityConfig();
  const docLabel = legal.type === "CNPJ" ? "CNPJ" : "CPF";
  const docFormatted = formatLegalDocument(legal.type, legal.document);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-6 md:p-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Política de Privacidade</h1>
        <p className="text-sm text-gray-500 mb-8">Versão {LGPD_POLICY_VERSION}</p>

        <section className="space-y-6 text-sm text-gray-700">
          <div>
            <h2 className="font-semibold text-gray-900 mb-2">1. Controlador dos dados</h2>
            <p>
              O controlador dos dados pessoais tratados nesta plataforma é{" "}
              <strong>{legal.name}</strong>
              {docFormatted ? (
                <>
                  , {docLabel} <strong>{docFormatted}</strong>
                </>
              ) : (
                <> (documento cadastral informado nos canais oficiais do serviço)</>
              )}
              , operador do {APP_DISPLAY_NAME}, disponível em{" "}
              <a href={legal.website} className="text-brand-600 hover:underline">
                {legal.website}
              </a>
              .
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-gray-900 mb-2">2. Encarregado (DPO)</h2>
            <p>
              Para assuntos de privacidade e direitos do titular, entre em contato pelo e-mail{" "}
              <a href={`mailto:${legal.privacyEmail}`} className="text-brand-600 hover:underline">
                {legal.privacyEmail}
              </a>
              . Prazo de resposta: até 15 dias, conforme art. 18 da LGPD.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-gray-900 mb-2">3. Dados tratados e finalidades</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Cadastro da conta (nome, e-mail): autenticação e gestão do contrato.</li>
              <li>Dados do negócio (telefone, endereço, horários): operação do atendimento.</li>
              <li>Mensagens e agendamentos: automação via WhatsApp solicitada pelo usuário.</li>
              <li>Dados de cobrança: processamento de assinatura e pagamentos.</li>
              <li>Registros técnicos (IP, data de aceite): segurança, auditoria e cumprimento legal.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-semibold text-gray-900 mb-2">4. Bases legais</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Execução de contrato e procedimentos preliminares (art. 7º, V).</li>
              <li>Legítimo interesse para segurança e melhoria do serviço (art. 7º, IX).</li>
              <li>Consentimento para cookies de medição/marketing, quando aplicável (art. 7º, I).</li>
              <li>Cumprimento de obrigação legal ou regulatória (art. 7º, II).</li>
            </ul>
          </div>

          <div>
            <h2 className="font-semibold text-gray-900 mb-2">5. Compartilhamento e transferência</h2>
            <p>
              Podemos compartilhar dados com provedores necessários à operação: Google/Firebase
              (hospedagem e autenticação), Stripe (assinaturas), Asaas (PIX, quando habilitado),
              Meta/WhatsApp (mensageria) e ferramentas de analytics com consentimento. Alguns
              provedores podem processar dados fora do Brasil, com salvaguardas contratuais.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-gray-900 mb-2">6. Retenção e eliminação</h2>
            <p>
              Mantemos os dados enquanto a conta estiver ativa e pelo tempo necessário para
              obrigações legais, cobrança e defesa de direitos. Você pode solicitar exclusão
              definitiva da conta em Meu perfil; apagamos tenant, negócios e dados associados no
              Firestore, além de cancelar assinatura quando houver.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-gray-900 mb-2">7. Seus direitos</h2>
            <p>
              Confirmação, acesso, correção, anonimização, portabilidade, eliminação, informação
              sobre compartilhamento e revogação de consentimento. Use Meu perfil para exportar ou
              excluir dados, ou envie solicitação para {legal.privacyEmail}.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-gray-900 mb-2">8. Segurança</h2>
            <p>
              Aplicamos autenticação, isolamento por conta (tenant) e controles de acesso no
              Firestore. Nenhum sistema é 100% seguro; notifique o encarregado em caso de
              incidente relevante.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-gray-900 mb-2">9. Autoridade nacional</h2>
            <p>
              Você pode apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD) se
              entender que o tratamento viola a LGPD.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-gray-900 mb-2">10. Atualizações</h2>
            <p>
              Esta política pode ser atualizada. Mudanças relevantes exigem novo aceite no painel,
              com registro da versão aceita.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
