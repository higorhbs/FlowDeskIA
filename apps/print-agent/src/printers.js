import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { copyFileSync } from "node:fs";

const execFileAsync = promisify(execFile);

export function isWindows() {
  return process.platform === "win32";
}

/** Lista os nomes das impressoras instaladas no sistema operacional. */
export async function listSystemPrinters() {
  try {
    if (isWindows()) {
      const { stdout } = await execFileAsync("powershell", [
        "-NoProfile",
        "-Command",
        "Get-Printer | Select-Object -ExpandProperty Name",
      ]);
      return stdout
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
    }

    const { stdout } = await execFileAsync("lpstat", ["-p"]);
    return stdout
      .split("\n")
      .map((line) => {
        const match = line.match(/^printer\s+(\S+)/);
        return match ? match[1] : null;
      })
      .filter((name) => Boolean(name));
  } catch {
    return [];
  }
}

/**
 * Envia bytes crus (ESC/POS) para uma impressora do sistema operacional.
 * mac/linux: usa o CUPS (`lp -o raw`), já presente no SO.
 * Windows: exige que a impressora esteja compartilhada com esse nome
 * (Painel de Controle > Dispositivos e Impressoras > Propriedades >
 * Compartilhamento), e grava diretamente no caminho de rede da impressora.
 */
export async function printRawBuffer(printerName, tmpFilePath) {
  if (!printerName?.trim()) {
    throw new Error("Nenhuma impressora selecionada. Configure FLOWDESK_PRINTER_NAME ou selecione no painel.");
  }

  if (isWindows()) {
    copyFileSync(tmpFilePath, `\\\\localhost\\${printerName}`);
    return;
  }

  await execFileAsync("lp", ["-d", printerName, "-o", "raw", tmpFilePath]);
}
