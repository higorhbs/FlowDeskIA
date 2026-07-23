import PDFDocument from 'pdfkit'

const STATUS_LABELS = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  NO_SHOW: 'Não compareceu',
}

const PERIOD_LABELS = {
  day: 'Relatório do Dia',
  week: 'Relatório da Semana',
  month: 'Relatório do Mês',
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function fmtDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtTime(iso) {
  const d = new Date(iso)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function buildReportPdf({ period, business, appointments, priceById, priceByName, from, to }) {
  const isRestaurant = business?.type === 'RESTAURANT'
  const itemPlural = isRestaurant ? 'pedidos' : 'agendamentos'
  const itemPluralLabel = isRestaurant ? 'Pedidos' : 'Agendamentos'
  const itemColumnLabel = isRestaurant ? 'Item' : 'Serviço'
  const emptyLabel = isRestaurant ? 'Nenhum pedido no período.' : 'Nenhum agendamento no período.'

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 })
    const chunks = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const counts = { PENDING: 0, CONFIRMED: 0, COMPLETED: 0, CANCELLED: 0, NO_SHOW: 0 }
    let revenue = 0
    for (const a of appointments) {
      counts[a.status] = (counts[a.status] ?? 0) + 1
      if (a.status === 'COMPLETED' || a.status === 'CONFIRMED') {
        const price = priceById.get(a.serviceId) ?? priceByName.get(a.serviceName) ?? 0
        revenue += price
      }
    }

    doc.fillColor('#111827').fontSize(20).text(business.name || 'Relatório', { continued: false })
    doc.moveDown(0.2)
    doc.fillColor('#4b5563').fontSize(14).text(PERIOD_LABELS[period] ?? 'Relatório')
    doc.moveDown(0.2)
    doc.fillColor('#6b7280').fontSize(10).text(`Período: ${fmtDate(from)} a ${fmtDate(to)}`)
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`)

    doc.moveDown(1)
    doc.moveTo(48, doc.y).lineTo(547, doc.y).strokeColor('#e5e7eb').stroke()
    doc.moveDown(0.8)

    doc.fillColor('#111827').fontSize(13).text('Resumo')
    doc.moveDown(0.4)
    doc.fillColor('#374151').fontSize(11)
    doc.text(`Total de ${itemPlural}: ${appointments.length}`)
    doc.text(`Concluídos: ${counts.COMPLETED}   ·   Confirmados: ${counts.CONFIRMED}   ·   Pendentes: ${counts.PENDING}`)
    doc.text(`Cancelados: ${counts.CANCELLED}   ·   Não compareceu: ${counts.NO_SHOW}`)
    doc.moveDown(0.3)
    doc.fillColor('#065f46').fontSize(12).text(`Receita estimada: ${BRL.format(revenue)}`)

    doc.moveDown(1)
    doc.fillColor('#111827').fontSize(13).text(itemPluralLabel)
    doc.moveDown(0.5)

    if (!appointments.length) {
      doc.fillColor('#9ca3af').fontSize(11).text(emptyLabel)
    } else {
      const cols = [48, 130, 250, 400, 480]
      doc.fillColor('#6b7280').fontSize(9)
      doc.text('Data', cols[0], doc.y, { continued: false })
      const headerY = doc.y - doc.currentLineHeight()
      doc.text('Hora', cols[1], headerY)
      doc.text('Cliente', cols[2], headerY)
      doc.text(itemColumnLabel, cols[3], headerY)
      doc.moveDown(0.2)
      doc.moveTo(48, doc.y).lineTo(547, doc.y).strokeColor('#e5e7eb').stroke()
      doc.moveDown(0.4)

      doc.fillColor('#374151').fontSize(9.5)
      for (const a of appointments) {
        if (doc.y > 760) {
          doc.addPage()
          doc.fillColor('#374151').fontSize(9.5)
        }
        const rowY = doc.y
        doc.text(fmtDate(a.scheduledAt), cols[0], rowY, { width: 78 })
        doc.text(fmtTime(a.scheduledAt), cols[1], rowY, { width: 40 })
        doc.text(a.customerName || a.customerPhone || '-', cols[2], rowY, { width: 140, ellipsis: true })
        doc.text(a.serviceName || '-', cols[3], rowY, { width: 100, ellipsis: true })
        doc.text(STATUS_LABELS[a.status] ?? a.status, cols[4], rowY, { width: 70 })
        doc.moveDown(0.6)
      }
    }

    doc.end()
  })
}
