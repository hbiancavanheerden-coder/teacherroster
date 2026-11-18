// Real PDF generation (downloaded file), loaded on demand to keep the main bundle small.
export async function tablePDF({ filename, title, subtitle, head, body, landscape = false, columnStyles }) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 38, 56);
  doc.text(title, 40, 48);
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(111, 103, 86);
    doc.text(subtitle, 40, 66);
  }
  autoTable(doc, {
    head: [head],
    body,
    startY: subtitle ? 80 : 64,
    styles: { fontSize: 9, cellPadding: 5, lineColor: [226, 215, 191], lineWidth: 0.5, textColor: [30, 38, 56] },
    headStyles: { fillColor: [30, 38, 56], textColor: [246, 241, 230], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [251, 247, 238] },
    columnStyles,
    margin: { left: 40, right: 40 },
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.setTextColor(140, 131, 112);
      doc.text(`Generated ${new Date().toLocaleString('en-ZA')} · Staffboard`, 40, doc.internal.pageSize.getHeight() - 20);
      doc.text(`Page ${doc.internal.getNumberOfPages()}`, w - 80, doc.internal.pageSize.getHeight() - 20);
    },
  });
  doc.save(filename);
}
