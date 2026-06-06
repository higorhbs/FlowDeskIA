import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function apiFail(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { error: err.message, ...(err.code ? { code: err.code } : {}) },
      { status: err.status },
    );
  }
  const message = err instanceof Error ? err.message : "Erro interno.";
  return NextResponse.json({ error: message }, { status: 500 });
}

export function requireJsonField(value: unknown, message: string): string {
  if (typeof value !== "string" || !value.trim()) throw new ApiError(message, 400);
  return value.trim();
}
