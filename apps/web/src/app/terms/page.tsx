export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-6 md:p-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Termos de Uso</h1>
        <p className="text-sm text-gray-500 mb-8">Versão 2026-05-v1</p>

        <section className="space-y-4 text-sm text-gray-700">
          <p>
            Ao utilizar o AtendeJa, você concorda com o uso da plataforma para
            gestão de atendimento, automação de mensagens e operação comercial
            do seu negócio.
          </p>
          <p>
            Você é responsável pela legalidade dos dados inseridos e pelas
            comunicações enviadas aos clientes.
          </p>
          <p>
            O serviço pode integrar provedores externos para autenticação,
            mensageria e pagamentos.
          </p>
          <p>
            O uso contínuo após atualizações dos termos representa concordância
            com a versão vigente.
          </p>
        </section>
      </div>
    </main>
  );
}
