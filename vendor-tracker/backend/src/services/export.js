const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

async function generateExcel(summaryData, date) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Reporte de Vendedores');

  // Título
  sheet.mergeCells('A1:F1');
  sheet.getCell('A1').value = `Reporte de Actividad - ${date}`;
  sheet.getCell('A1').font = { size: 16, bold: true };
  sheet.getCell('A1').alignment = { horizontal: 'center' };

  // Encabezados
  sheet.addRow([]);
  const headerRow = sheet.addRow([
    'Vendedor', 'Estado', 'Puntos GPS', 'Visitas', 'Distancia (km)', 'ID'
  ]);
  headerRow.font = { bold: true };
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  });

  // Datos
  summaryData.forEach(vendor => {
    sheet.addRow([
      vendor.name,
      vendor.active ? 'Activo' : 'Inactivo',
      vendor.totalLocations,
      vendor.totalVisits,
      vendor.distanceKm,
      vendor.vendorId,
    ]);
  });

  // Ajustar ancho de columnas
  sheet.columns.forEach(col => { col.width = 18; });

  // Fila de totales
  sheet.addRow([]);
  const totalRow = sheet.addRow([
    'TOTALES',
    '',
    summaryData.reduce((s, v) => s + v.totalLocations, 0),
    summaryData.reduce((s, v) => s + v.totalVisits, 0),
    Math.round(summaryData.reduce((s, v) => s + v.distanceKm, 0) * 100) / 100,
    '',
  ]);
  totalRow.font = { bold: true };

  return await workbook.xlsx.writeBuffer();
}

async function generatePDF(summaryData, date) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    // Título
    doc.fontSize(20).font('Helvetica-Bold')
      .text(`Reporte de Actividad`, { align: 'center' });
    doc.fontSize(14).font('Helvetica')
      .text(`Fecha: ${date}`, { align: 'center' });
    doc.moveDown(2);

    // Tabla
    const tableTop = doc.y;
    const headers = ['Vendedor', 'Estado', 'GPS', 'Visitas', 'Km'];
    const colWidths = [150, 80, 60, 60, 80];
    let x = 50;

    // Encabezados
    doc.fontSize(10).font('Helvetica-Bold');
    headers.forEach((header, i) => {
      doc.text(header, x, tableTop, { width: colWidths[i] });
      x += colWidths[i];
    });

    doc.moveTo(50, tableTop + 15).lineTo(530, tableTop + 15).stroke();

    // Filas
    doc.font('Helvetica').fontSize(9);
    let y = tableTop + 25;

    summaryData.forEach(vendor => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      x = 50;
      const row = [
        vendor.name,
        vendor.active ? 'Activo' : 'Inactivo',
        String(vendor.totalLocations),
        String(vendor.totalVisits),
        String(vendor.distanceKm),
      ];
      row.forEach((cell, i) => {
        doc.text(cell, x, y, { width: colWidths[i] });
        x += colWidths[i];
      });
      y += 18;
    });

    // Totales
    y += 10;
    doc.moveTo(50, y).lineTo(530, y).stroke();
    y += 10;
    doc.font('Helvetica-Bold');
    x = 50;
    const totals = [
      'TOTALES',
      '',
      String(summaryData.reduce((s, v) => s + v.totalLocations, 0)),
      String(summaryData.reduce((s, v) => s + v.totalVisits, 0)),
      String(Math.round(summaryData.reduce((s, v) => s + v.distanceKm, 0) * 100) / 100),
    ];
    totals.forEach((cell, i) => {
      doc.text(cell, x, y, { width: colWidths[i] });
      x += colWidths[i];
    });

    doc.end();
  });
}

module.exports = { generateExcel, generatePDF };
