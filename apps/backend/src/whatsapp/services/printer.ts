import { connect as connectSocket } from "node:net";
import { buildOrderReceiptLines, normalizePrinterConfig, type PrinterConfig } from "@flowdesk/shared";
import { createPrintJob } from "@flowdesk/firebase";

const CONNECT_TIMEOUT_MS = 5_000;

// ESC/POS: inicializa impressora e seleciona página de código CP860 (Português/Brasil)
const ESC_INIT = Buffer.from([0x1b, 0x40]);
const ESC_CODEPAGE_CP860 = Buffer.from([0x1b, 0x74, 0x03]);
const FEED = Buffer.from([0x0a, 0x0a, 0x0a, 0x0a]);

function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function buildEscPosBuffer(lines: string[]): Buffer {
  const body = lines.map((line) => stripAccents(line)).join("\n");
  return Buffer.concat([
    ESC_INIT,
    ESC_CODEPAGE_CP860,
    Buffer.from(`${body}\n`, "ascii"),
    FEED,
  ]);
}

export interface PrintResult {
  ok: boolean;
  error?: string;
}

function sendToPrinter(cfg: PrinterConfig, buffer: Buffer): Promise<PrintResult> {
  return new Promise((resolve) => {
    if (!cfg.ip.trim()) {
      resolve({ ok: false, error: "IP da impressora não configurado." });
      return;
    }

    const socket = connectSocket({ host: cfg.ip.trim(), port: cfg.port });
    let settled = false;

    function finish(result: PrintResult) {
      if (settled) return;
      settled = true;
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    }

    socket.setTimeout(CONNECT_TIMEOUT_MS);
    socket.once("timeout", () => finish({ ok: false, error: "Tempo esgotado ao conectar na impressora." }));
    socket.once("error", (err) => finish({ ok: false, error: err.message || "Falha ao conectar na impressora." }));
    socket.once("connect", () => {
      socket.write(buffer, (err) => {
        if (err) {
          finish({ ok: false, error: err.message || "Falha ao enviar dados para a impressora." });
          return;
        }
        socket.end();
        finish({ ok: true });
      });
    });
  });
}

async function enqueueAgentPrintJob(
  businessId: string,
  buffer: Buffer,
  printerName?: string,
): Promise<PrintResult> {
  try {
    await createPrintJob(businessId, buffer.toString("base64"), printerName);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Falha ao enfileirar impressão." };
  }
}

async function dispatchPrint(
  businessId: string,
  cfg: PrinterConfig,
  buffer: Buffer,
): Promise<PrintResult> {
  for (let i = 0; i < cfg.copies; i++) {
    const result =
      cfg.connectionType === "usb"
        ? await enqueueAgentPrintJob(businessId, buffer, cfg.agentPrinterName)
        : await sendToPrinter(cfg, buffer);
    if (!result.ok) return result;
  }
  return { ok: true };
}

export async function printOrderReceipt(
  business: { id: string; name: string; printerConfig?: PrinterConfig | null },
  order: Parameters<typeof buildOrderReceiptLines>[0],
): Promise<PrintResult> {
  const cfg = normalizePrinterConfig(business.printerConfig);
  if (!cfg.enabled) return { ok: false, error: "Impressão automática desativada." };
  if (cfg.connectionType === "usb" && !cfg.agentToken) {
    return { ok: false, error: "Agente local de impressão ainda não pareado." };
  }

  const lines = buildOrderReceiptLines(order, business.name);
  const buffer = buildEscPosBuffer(lines);
  return dispatchPrint(business.id, cfg, buffer);
}

export async function printTestReceipt(
  business: { id: string; name: string; printerConfig?: PrinterConfig | null },
): Promise<PrintResult> {
  const cfg = normalizePrinterConfig(business.printerConfig);
  const lines = [
    business.name.toUpperCase(),
    "TESTE DE IMPRESSAO",
    "------------------------------",
    cfg.connectionType === "usb"
      ? `Impressora local: ${cfg.agentPrinterName || "(nenhuma selecionada)"}`
      : `Impressora configurada em ${cfg.ip || "(sem IP)"}:${cfg.port}`,
    "Se você está lendo isso no papel,",
    "a impressão automática de pedidos",
    "está funcionando corretamente!",
    "------------------------------",
    new Date().toLocaleString("pt-BR"),
  ];
  return dispatchPrint(business.id, cfg, buildEscPosBuffer(lines));
}
