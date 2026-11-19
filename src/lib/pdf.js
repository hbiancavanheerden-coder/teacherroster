// Real PDF generation (downloaded file), loaded on demand to keep the main bundle small.
export async function tablePDF({ filename, title, subtitle, head, body, landscape = false, columnStyles }) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(11, 17, 36);
  doc.text(title, 40, 48);
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 135);
    doc.text(subtitle, 40, 66);
  }
  autoTable(doc, {
    head: [head],
    body,
    startY: subtitle ? 80 : 64,
    styles: { fontSize: 9, cellPadding: 5, lineColor: [227, 231, 240], lineWidth: 0.5, textColor: [11, 17, 36] },
    headStyles: { fillColor: [0, 119, 214], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 251] },
    columnStyles,
    margin: { left: 40, right: 40 },
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 135);
      doc.text(`Generated ${new Date().toLocaleString('en-ZA')} · StaffBoard`, 40, doc.internal.pageSize.getHeight() - 20);
      doc.text(`Page ${doc.internal.getNumberOfPages()}`, w - 80, doc.internal.pageSize.getHeight() - 20);
    },
  });
  doc.save(filename);
}
