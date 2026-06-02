"use client";

import { useEffect } from "react";

const SUPPORT_EMAIL_URL = "mailto:1devhigor@gmail.com?subject=Suporte%20FlowDesk";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
          <h1 className="text-4xl font-bold text-red-600 mb-4">Algo deu errado</h1>
          <p className="text-gray-500 mb-8 text-center max-w-md">
            Ocorreu um erro inesperado. Tente novamente ou entre em contato com o suporte.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={reset}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Tentar novamente
            </button>
            <a
              href={SUPPORT_EMAIL_URL}
              className="px-6 py-3 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors font-medium border border-emerald-200"
            >
              Suporte por e-mail
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}