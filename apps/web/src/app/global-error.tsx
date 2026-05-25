"use client";

import { useEffect } from "react";

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
          <button
            onClick={reset}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}