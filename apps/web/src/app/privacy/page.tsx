export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-6 md:p-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Política de Privacidade
        </h1>
        <p className="text-sm text-gray-500 mb-8">Versão 2026-05-v1</p>

        <section className="space-y-4 text-sm text-gray-700">
          <p>
            O AtendeJa trata dados pessoais para operar automações de
            atendimento via WhatsApp, incluindo cadastro da conta, dados do
            negócio, mensagens e agendamentos.
          </p>
          <p>
            Finalidades: autenticação, operação da plataforma, suporte, cobrança
            e cumprimento legal.
          </p>
          <p>
            Você pode solicitar exportação dos seus dados pelo próprio painel,
            em Meu perfil.
          </p>
          <p>
            Integrações com terceiros (ex.: WhatsApp/Asaas) podem receber dados
            necessários para execução das funcionalidades contratadas.
          </p>
          <p>
            Mantemos controles de acesso por autenticação e isolamento por conta
            para proteção dos dados.
          </p>
        </section>
      </div>
    </main>
  );
}
