import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { loadConfig } from "./env.js";
import { listSystemPrinters, printRawBuffer } from "./printers.js";

const POLL_INTERVAL_MS = 3_000;
const REDETECT_EVERY_N_POLLS = 10;

function log(...args) {
  console.log(`[${new Date().toLocaleTimeString("pt-BR")}]`, ...args);
}

async function pollOnce(config, printers) {
  const url = new URL(`${config.apiBaseUrl}/businesses/${config.businessId}/printer/agent/poll`);
  if (printers) url.searchParams.set("printers", printers.join(","));

  const res = await fetch(url, {
    headers: { "X-Agent-Token": config.agentToken },
  });
  if (!res.ok) {
    throw new Error(`Falha ao consultar fila de impressão (HTTP ${res.status}).`);
  }
  const data = await res.json();
  return Array.isArray(data.jobs) ? data.jobs : [];
}

async function ackJob(config, jobId, status, error) {
  const url = `${config.apiBaseUrl}/businesses/${config.businessId}/printer/agent/ack`;
  await fetch(url, {
    method: "POST",
    headers: { "X-Agent-Token": config.agentToken, "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, status, error }),
  }).catch((err) => log("Falha ao confirmar job", jobId, err.message || err));
}

async function printJob(config, job, detectedPrinters) {
  const printerName = job.printerName || config.printerName || detectedPrinters[0];
  const tmpFile = join(tmpdir(), `flowdesk-print-${randomUUID()}.bin`);
  try {
    const buffer = Buffer.from(job.payloadBase64, "base64");
    writeFileSync(tmpFile, buffer);
    await printRawBuffer(printerName, tmpFile);
    log(`Cupom impresso em "${printerName}" (job ${job.id}).`);
    await ackJob(config, job.id, "done");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`Erro ao imprimir job ${job.id}:`, message);
    await ackJob(config, job.id, "error", message);
  } finally {
    unlinkSync(tmpFile);
  }
}

async function main() {
  const config = loadConfig();
  log("Agente de impressão do FlowDeskIA iniciado.");
  log(`Negócio: ${config.businessId} | Backend: ${config.apiBaseUrl}`);

  let detectedPrinters = await listSystemPrinters();
  if (detectedPrinters.length === 0) {
    log("Aviso: nenhuma impressora detectada no sistema operacional.");
  } else {
    log("Impressoras detectadas:", detectedPrinters.join(", "));
  }

  let iteration = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    iteration += 1;
    try {
      if (iteration % REDETECT_EVERY_N_POLLS === 1) {
        detectedPrinters = await listSystemPrinters();
      }
      const jobs = await pollOnce(config, detectedPrinters);
      for (const job of jobs) {
        await printJob(config, job, detectedPrinters);
      }
    } catch (err) {
      log("Erro ao consultar o backend:", err instanceof Error ? err.message : err);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

main().catch((err) => {
  console.error("Falha fatal no agente de impressão:", err instanceof Error ? err.message : err);
  process.exit(1);
});
