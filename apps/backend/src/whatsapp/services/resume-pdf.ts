import PDFDocument from "pdfkit";
import type { ResumeData } from "@flowdesk/shared";

function safeLine(doc: InstanceType<typeof PDFDocument>, text: string, opts?: { bold?: boolean; size?: number }) {
  if (opts?.bold) doc.font("Helvetica-Bold");
  else doc.font("Helvetica");
  if (opts?.size) doc.fontSize(opts.size);
  doc.text(text, { align: "left" });
  doc.moveDown(0.3);
}

export function buildResumePdf(data: ResumeData, documentLabel = "documento"): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font("Helvetica-Bold").fontSize(20).text(data.nome || documentLabel, { align: "center" });
    doc.moveDown(0.5);
    doc.font("Helvetica").fontSize(10).text(
      [data.cidadeBairro, data.telefone, data.email].filter(Boolean).join("  |  "),
      { align: "center" },
    );
    doc.moveDown(1);

    safeLine(doc, "DADOS PESSOAIS", { bold: true, size: 12 });
    if (data.idade) safeLine(doc, `Idade / Nascimento: ${data.idade}`);
    if (data.estadoCivil) safeLine(doc, `Estado civil: ${data.estadoCivil}`);
    if (data.cnh) safeLine(doc, `CNH: ${data.cnh}`);

    safeLine(doc, "ESCOLARIDADE", { bold: true, size: 12 });
    safeLine(doc, `${data.escolaridadeNivel} — ${data.escolaridadeCurso}`);

    if (data.experiencias.length) {
      safeLine(doc, "EXPERIÊNCIA PROFISSIONAL", { bold: true, size: 12 });
      for (const exp of data.experiencias) {
        safeLine(doc, `${exp.cargo} — ${exp.empresa}`, { bold: true });
        safeLine(doc, exp.periodo);
        safeLine(doc, exp.atividades);
        doc.moveDown(0.4);
      }
    }

    if (data.cursos) {
      safeLine(doc, "CURSOS E QUALIFICAÇÕES", { bold: true, size: 12 });
      safeLine(doc, data.cursos);
    }

    if (data.objetivo) {
      safeLine(doc, "OBJETIVO PROFISSIONAL", { bold: true, size: 12 });
      safeLine(doc, data.objetivo);
    }

    doc.end();
  });
}

export function resumePdfFilename(data: ResumeData, documentLabel = "documento"): string {
  const base = (data.nome || documentLabel)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return `${base || documentLabel.replace(/\s+/g, "_").toLowerCase()}.pdf`;
}
