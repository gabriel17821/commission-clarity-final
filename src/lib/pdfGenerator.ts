import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Invoice } from '@/hooks/useInvoices';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Types for breakdown PDF
interface ProductEntry {
  ncf: string;
  date: string;
  amount: number;
}

interface ProductBreakdown {
  name: string;
  percentage: number;
  entries: ProductEntry[];
  totalAmount: number;
  totalCommission: number;
}

interface BreakdownData {
  month: string;
  products: ProductBreakdown[];
  rest: {
    entries: ProductEntry[];
    totalAmount: number;
    totalCommission: number;
  };
  grandTotal: number;
  sellerName?: string;
}

// Parse date correctly
const parseDate = (dateString: string): Date => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(dateString);
};

// Generate breakdown PDF with light grey design for printing
export const generateBreakdownPdf = async (data: BreakdownData, selectedMonth: string): Promise<void> => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let yPos = 20;

  // Colors - Light greys for printing (no pure black)
  const colors = {
    darkGrey: '#404040',
    mediumGrey: '#666666',
    lightGrey: '#888888',
    veryLightGrey: '#e5e5e5',
    background: '#f8f8f8',
    border: '#d0d0d0',
    success: '#2d8a4e',
  };

  // Header - Light grey background instead of dark
  doc.setFillColor(colors.veryLightGrey);
  doc.roundedRect(margin, yPos - 5, pageWidth - 2 * margin, 35, 4, 4, 'F');
  doc.setDrawColor(colors.border);
  doc.roundedRect(margin, yPos - 5, pageWidth - 2 * margin, 35, 4, 4, 'S');
  
  doc.setTextColor(colors.darkGrey);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('DESGLOSE MENSUAL DE COMISIONES', pageWidth / 2, yPos + 5, { align: 'center' });
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.mediumGrey);
  doc.text(data.month.toUpperCase(), pageWidth / 2, yPos + 14, { align: 'center' });
  
  // Seller name
  if (data.sellerName) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.darkGrey);
    doc.text(`Vendedor: ${data.sellerName}`, pageWidth / 2, yPos + 22, { align: 'center' });
  }
  
  yPos = data.sellerName ? 62 : 55;

  // Summary Box
  doc.setFillColor(colors.background);
  doc.setDrawColor(colors.border);
  doc.roundedRect(margin, yPos - 5, pageWidth - 2 * margin, 22, 3, 3, 'FD');
  
  doc.setTextColor(colors.lightGrey);
  doc.setFontSize(9);
  doc.text('RESUMEN', margin + 5, yPos + 2);
  
  const productCount = data.products.length + (data.rest.totalAmount > 0 ? 1 : 0);
  // Count unique invoices by NCF
  const uniqueNcfs = new Set<string>();
  data.products.forEach(p => p.entries.forEach(e => uniqueNcfs.add(e.ncf)));
  data.rest.entries.forEach(e => uniqueNcfs.add(e.ncf));
  const invoiceCount = uniqueNcfs.size;
  
  // Calculate products with variable commissions
  const variableProductCount = data.products.length;
  const hasRest = data.rest.totalAmount > 0;
  
  doc.setTextColor(colors.darkGrey);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  
  const summaryText = hasRest 
    ? `${variableProductCount} productos con comisiones variables + resto de facturas al 25%  •  ${invoiceCount} facturas`
    : `${variableProductCount} productos con comisiones variables  •  ${invoiceCount} facturas`;
  
  doc.text(summaryText, margin + 5, yPos + 10);
  
  doc.setTextColor(colors.success);
  doc.setFontSize(12);
  doc.text(`Total: $${formatNumber(data.grandTotal)}`, pageWidth - margin - 5, yPos + 8, { align: 'right' });
  
  yPos += 30;

  // Products breakdown
  doc.setTextColor(colors.darkGrey);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('DESGLOSE POR PRODUCTO', margin, yPos);
  yPos += 8;

  // Table for each product
  for (const product of data.products) {
    if (yPos > 245) {
      doc.addPage();
      yPos = 20;
    }

    // Product header - light grey box
    doc.setFillColor(colors.veryLightGrey);
    doc.setDrawColor(colors.border);
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 9, 2, 2, 'FD');
    doc.setTextColor(colors.darkGrey);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(product.name, margin + 4, yPos + 6);
    doc.text(`${product.percentage}%`, pageWidth - margin - 4, yPos + 6, { align: 'right' });
    yPos += 12;

    // Product entries table
    const tableData = product.entries.map(entry => [
      format(parseDate(entry.date), 'd MMM yyyy', { locale: es }),
      entry.ncf,
      `$${formatNumber(entry.amount)}`,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Fecha', 'NCF', 'Monto']],
      body: tableData,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        textColor: colors.mediumGrey,
        lineColor: colors.border,
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: colors.background,
        textColor: colors.darkGrey,
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: '#fafafa',
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 30, halign: 'right' },
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 3;

    // Subtotal and commission line
    doc.setDrawColor(colors.border);
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 4;

    doc.setTextColor(colors.mediumGrey);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:', pageWidth - margin - 45, yPos);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.darkGrey);
    doc.text(`$${formatNumber(product.totalAmount)}`, pageWidth - margin, yPos, { align: 'right' });
    yPos += 5;

    doc.setTextColor(colors.success);
    doc.setFont('helvetica', 'bold');
    doc.text(`Comisión (${product.percentage}%):`, pageWidth - margin - 45, yPos);
    doc.text(`$${formatNumber(product.totalCommission)}`, pageWidth - margin, yPos, { align: 'right' });
    yPos += 12;
  }

  // Rest of products
  if (data.rest.totalAmount > 0) {
    if (yPos > 245) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFillColor(colors.veryLightGrey);
    doc.setDrawColor(colors.border);
    doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 9, 2, 2, 'FD');
    doc.setTextColor(colors.darkGrey);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Resto de Productos', margin + 4, yPos + 6);
    doc.text('25%', pageWidth - margin - 4, yPos + 6, { align: 'right' });
    yPos += 12;

    const restTableData = data.rest.entries.map(entry => [
      format(parseDate(entry.date), 'd MMM yyyy', { locale: es }),
      entry.ncf,
      `$${formatNumber(entry.amount)}`,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Fecha', 'NCF', 'Monto']],
      body: restTableData,
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        textColor: colors.mediumGrey,
        lineColor: colors.border,
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: colors.background,
        textColor: colors.darkGrey,
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: '#fafafa',
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 30, halign: 'right' },
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 3;

    doc.setDrawColor(colors.border);
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 4;

    doc.setTextColor(colors.mediumGrey);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:', pageWidth - margin - 45, yPos);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(colors.darkGrey);
    doc.text(`$${formatNumber(data.rest.totalAmount)}`, pageWidth - margin, yPos, { align: 'right' });
    yPos += 5;

    doc.setTextColor(colors.success);
    doc.setFont('helvetica', 'bold');
    doc.text('Comisión (25%):', pageWidth - margin - 45, yPos);
    doc.text(`$${formatNumber(data.rest.totalCommission)}`, pageWidth - margin, yPos, { align: 'right' });
    yPos += 12;
  }

  // Grand Total Section
  if (yPos > 235) {
    doc.addPage();
    yPos = 20;
  }

  yPos += 5;
  
  // Total box with light border
  doc.setFillColor(colors.background);
  doc.setDrawColor(colors.success);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 25, 3, 3, 'FD');
  
  doc.setTextColor(colors.mediumGrey);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('COMISIÓN TOTAL DEL MES', margin + 8, yPos + 10);
  
  doc.setTextColor(colors.success);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(`$${formatNumber(data.grandTotal)}`, pageWidth - margin - 8, yPos + 16, { align: 'right' });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setTextColor(colors.lightGrey);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Página ${i} de ${pageCount}  •  ${data.month}  •  Generado: ${format(new Date(), "d MMM yyyy", { locale: es })}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    );
  }

  // Download
  doc.save(`desglose-${selectedMonth}.pdf`);
};

interface ProductSummary {
  name: string;
  totalAmount: number;
  totalCommission: number;
  percentage: number;
  count: number;
}

export const generateMonthlyPDF = (invoices: Invoice[], monthLabel: string) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Light grey color palette for printing
  const colors = {
    darkGrey: '#404040',
    mediumGrey: '#666666',
    lightGrey: '#888888',
    veryLightGrey: '#e5e5e5',
    background: '#f8f8f8',
    border: '#d0d0d0',
    success: '#2d8a4e',
  };
  
  // Header - light background
  doc.setFillColor(colors.veryLightGrey);
  doc.roundedRect(10, 10, pageWidth - 20, 30, 3, 3, 'F');
  doc.setDrawColor(colors.border);
  doc.roundedRect(10, 10, pageWidth - 20, 30, 3, 3, 'S');
  
  doc.setTextColor(colors.darkGrey);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Reporte Mensual de Comisiones', pageWidth / 2, 22, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(colors.mediumGrey);
  doc.text(monthLabel.toUpperCase(), pageWidth / 2, 32, { align: 'center' });
  
  // Calculate totals
  const totalSales = invoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);
  const totalCommission = invoices.reduce((sum, inv) => sum + Number(inv.total_commission), 0);
  const totalRestCommission = invoices.reduce((sum, inv) => sum + Number(inv.rest_commission), 0);
  
  // Product breakdown
  const productMap = new Map<string, ProductSummary>();
  
  invoices.forEach(invoice => {
    invoice.products?.forEach(p => {
      const existing = productMap.get(p.product_name);
      if (existing) {
        existing.totalAmount += Number(p.amount);
        existing.totalCommission += Number(p.commission);
        existing.count += 1;
      } else {
        productMap.set(p.product_name, {
          name: p.product_name,
          totalAmount: Number(p.amount),
          totalCommission: Number(p.commission),
          percentage: Number(p.percentage),
          count: 1,
        });
      }
    });
  });
  
  const productSummaries = Array.from(productMap.values()).sort((a, b) => b.totalCommission - a.totalCommission);
  
  let yPos = 52;
  
  // Summary Cards
  const cardWidth = 55;
  const cardHeight = 28;
  const cardSpacing = 8;
  const startX = (pageWidth - (cardWidth * 3 + cardSpacing * 2)) / 2;
  
  // Card 1 - Invoices
  doc.setFillColor(colors.background);
  doc.roundedRect(startX, yPos, cardWidth, cardHeight, 3, 3, 'F');
  doc.setDrawColor(colors.border);
  doc.roundedRect(startX, yPos, cardWidth, cardHeight, 3, 3, 'S');
  
  doc.setTextColor(colors.lightGrey);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('FACTURAS', startX + cardWidth/2, yPos + 10, { align: 'center' });
  doc.setTextColor(colors.darkGrey);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(String(invoices.length), startX + cardWidth/2, yPos + 22, { align: 'center' });
  
  // Card 2 - Sales
  const card2X = startX + cardWidth + cardSpacing;
  doc.setFillColor(colors.background);
  doc.roundedRect(card2X, yPos, cardWidth, cardHeight, 3, 3, 'F');
  doc.setDrawColor(colors.border);
  doc.roundedRect(card2X, yPos, cardWidth, cardHeight, 3, 3, 'S');
  
  doc.setTextColor(colors.lightGrey);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('VENTAS', card2X + cardWidth/2, yPos + 10, { align: 'center' });
  doc.setTextColor(colors.darkGrey);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`$${formatNumber(totalSales)}`, card2X + cardWidth/2, yPos + 22, { align: 'center' });
  
  // Card 3 - Commission
  const card3X = card2X + cardWidth + cardSpacing;
  doc.setFillColor(colors.background);
  doc.roundedRect(card3X, yPos, cardWidth, cardHeight, 3, 3, 'F');
  doc.setDrawColor(colors.success);
  doc.setLineWidth(0.5);
  doc.roundedRect(card3X, yPos, cardWidth, cardHeight, 3, 3, 'S');
  
  doc.setTextColor(colors.lightGrey);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('TU COMISIÓN', card3X + cardWidth/2, yPos + 10, { align: 'center' });
  doc.setTextColor(colors.success);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`$${formatNumber(totalCommission)}`, card3X + cardWidth/2, yPos + 22, { align: 'center' });
  
  yPos += cardHeight + 15;
  
  // Category Breakdown
  doc.setTextColor(colors.darkGrey);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Desglose por Categoría', 14, yPos);
  
  yPos += 5;
  
  const productRows = productSummaries.map(p => [
    p.name,
    `${p.percentage}%`,
    String(p.count),
    `$${formatNumber(p.totalAmount)}`,
    `$${formatCurrency(p.totalCommission)}`
  ]);
  
  if (totalRestCommission > 0) {
    const restAmount = invoices.reduce((sum, inv) => sum + Number(inv.rest_amount), 0);
    const restPercentage = invoices[0]?.rest_percentage || 25;
    const restCount = invoices.filter(i => i.rest_amount > 0).length;
    productRows.push([
      'Resto de Productos',
      `${restPercentage}%`,
      String(restCount),
      `$${formatNumber(restAmount)}`,
      `$${formatCurrency(totalRestCommission)}`
    ]);
  }
  
  autoTable(doc, {
    startY: yPos,
    head: [['Categoría', '%', 'Facturas', 'Monto', 'Comisión']],
    body: productRows,
    theme: 'plain',
    styles: {
      fontSize: 8,
      cellPadding: 4,
      textColor: colors.mediumGrey,
    },
    headStyles: {
      fillColor: colors.veryLightGrey,
      textColor: colors.darkGrey,
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: '#fafafa',
    },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 35, halign: 'right' },
      4: { cellWidth: 35, halign: 'right', textColor: colors.success, fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
  });
  
  yPos = (doc as any).lastAutoTable.finalY + 12;
  
  // Invoice Details
  doc.setTextColor(colors.darkGrey);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Detalle de Facturas', 14, yPos);
  
  yPos += 5;
  
  const invoiceRows = invoices.map((inv, idx) => [
    String(idx + 1),
    inv.ncf,
    format(parseDate(inv.invoice_date || inv.created_at), 'dd/MM/yyyy', { locale: es }),
    `$${formatNumber(inv.total_amount)}`,
    `$${formatCurrency(inv.total_commission)}`
  ]);
  
  autoTable(doc, {
    startY: yPos,
    head: [['#', 'NCF', 'Fecha', 'Factura', 'Comisión']],
    body: invoiceRows,
    theme: 'plain',
    styles: {
      fontSize: 7,
      cellPadding: 3,
      textColor: colors.mediumGrey,
    },
    headStyles: {
      fillColor: colors.veryLightGrey,
      textColor: colors.darkGrey,
      fontStyle: 'bold',
      fontSize: 7,
    },
    alternateRowStyles: {
      fillColor: '#fafafa',
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 25, halign: 'center' },
      3: { cellWidth: 32, halign: 'right' },
      4: { cellWidth: 28, halign: 'right', textColor: colors.success },
    },
    margin: { left: 14, right: 14 },
  });
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setTextColor(colors.lightGrey);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Página ${i} de ${pageCount}  •  ${monthLabel}  •  Generado: ${format(new Date(), "d MMM yyyy", { locale: es })}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    );
  }
  
  doc.save(`reporte-${monthLabel.toLowerCase().replace(' ', '-')}.pdf`);
};
