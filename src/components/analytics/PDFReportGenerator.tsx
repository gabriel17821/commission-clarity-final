import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, Loader2, BarChart3, Users, Package, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AnalyticsData } from '@/hooks/useAnalytics';
import { Client } from '@/hooks/useClients';
import { Product } from '@/hooks/useProducts';
import { formatNumber } from '@/lib/formatters';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

interface PDFReportGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: AnalyticsData[];
  clients: Client[];
  products: Product[];
  kpis: {
    totalSales: number;
    salesChange: number;
    totalCommission: number;
    commissionChange: number;
    totalUnits: number;
    unitsChange: number;
    activeClients: number;
    clientsChange: number;
    avgTicket: number;
  };
  clientAnalytics: any[];
  productAnalytics: any[];
}

export function PDFReportGenerator({ 
  open, 
  onOpenChange, 
  data, 
  clients, 
  products, 
  kpis,
  clientAnalytics,
  productAnalytics 
}: PDFReportGeneratorProps) {
  const [generating, setGenerating] = useState(false);
  const [sections, setSections] = useState({
    summary: true,
    clients: true,
    products: true,
    trends: true,
  });
  const [reportType, setReportType] = useState<'executive' | 'detailed'>('executive');

  const toggleSection = (key: keyof typeof sections) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const generatePDF = async () => {
    setGenerating(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPos = 20;

      // Colors
      const primaryColor: [number, number, number] = [99, 102, 241]; // Indigo
      const textColor: [number, number, number] = [31, 41, 55];
      const mutedColor: [number, number, number] = [107, 114, 128];
      const successColor: [number, number, number] = [16, 185, 129];

      // Header
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('Reporte de Análisis', 20, 25);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generado: ${format(new Date(), "d 'de' MMMM, yyyy", { locale: es })}`, 20, 35);

      yPos = 55;

      // Summary Section
      if (sections.summary) {
        doc.setTextColor(...primaryColor);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Resumen Ejecutivo', 20, yPos);
        yPos += 10;

        // KPI Boxes
        const kpiData = [
          { label: 'Ventas Totales', value: `$${formatNumber(kpis.totalSales)}`, change: kpis.salesChange },
          { label: 'Comisión Total', value: `$${formatNumber(kpis.totalCommission)}`, change: kpis.commissionChange },
          { label: 'Unidades Vendidas', value: formatNumber(kpis.totalUnits), change: kpis.unitsChange },
          { label: 'Clientes Activos', value: String(kpis.activeClients), change: kpis.clientsChange },
        ];

        const boxWidth = (pageWidth - 50) / 2;
        const boxHeight = 25;

        kpiData.forEach((kpi, idx) => {
          const x = 20 + (idx % 2) * (boxWidth + 10);
          const y = yPos + Math.floor(idx / 2) * (boxHeight + 5);

          // Box background
          doc.setFillColor(249, 250, 251);
          doc.roundedRect(x, y, boxWidth, boxHeight, 3, 3, 'F');

          // Label
          doc.setTextColor(...mutedColor);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.text(kpi.label, x + 5, y + 8);

          // Value
          doc.setTextColor(...textColor);
          doc.setFontSize(14);
          doc.setFont('helvetica', 'bold');
          doc.text(kpi.value, x + 5, y + 18);

          // Change indicator
          const changeText = `${kpi.change > 0 ? '+' : ''}${kpi.change.toFixed(1)}%`;
          doc.setFontSize(9);
          if (kpi.change > 0) {
            doc.setTextColor(...successColor);
          } else if (kpi.change < 0) {
            doc.setTextColor(239, 68, 68);
          } else {
            doc.setTextColor(...mutedColor);
          }
          doc.text(changeText, x + boxWidth - 25, y + 18);
        });

        yPos += (boxHeight + 5) * 2 + 15;
      }

      // Clients Section
      if (sections.clients && clientAnalytics.length > 0) {
        if (yPos > pageHeight - 80) {
          doc.addPage();
          yPos = 20;
        }

        doc.setTextColor(...primaryColor);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Top Clientes', 20, yPos);
        yPos += 8;

        autoTable(doc, {
          startY: yPos,
          head: [['#', 'Cliente', 'Transacciones', 'Total Vendido', 'Comisión', 'Tendencia']],
          body: clientAnalytics.slice(0, 10).map((client, idx) => [
            String(idx + 1),
            client.name,
            String(client.transactions),
            `$${formatNumber(client.total)}`,
            `$${formatNumber(client.commission)}`,
            `${client.trend > 0 ? '+' : ''}${client.trend.toFixed(1)}%`
          ]),
          theme: 'striped',
          headStyles: { fillColor: primaryColor, textColor: [255, 255, 255] },
          styles: { fontSize: 9, cellPadding: 3 },
          columnStyles: {
            0: { cellWidth: 10 },
            3: { halign: 'right' },
            4: { halign: 'right' },
            5: { halign: 'right' }
          }
        });

        yPos = (doc as any).lastAutoTable.finalY + 15;
      }

      // Products Section
      if (sections.products && productAnalytics.length > 0) {
        if (yPos > pageHeight - 80) {
          doc.addPage();
          yPos = 20;
        }

        doc.setTextColor(...primaryColor);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Análisis de Productos', 20, yPos);
        yPos += 8;

        autoTable(doc, {
          startY: yPos,
          head: [['Producto', 'Unidades', 'Precio Prom.', 'Total', 'Comisión DLS', 'Tendencia']],
          body: productAnalytics.slice(0, 15).map(product => [
            product.name,
            String(product.units),
            `$${formatNumber(product.avgPrice)}`,
            `$${formatNumber(product.total)}`,
            `$${formatNumber(product.commission)}`,
            `${product.trend > 0 ? '+' : ''}${product.trend.toFixed(1)}%`
          ]),
          theme: 'striped',
          headStyles: { fillColor: primaryColor, textColor: [255, 255, 255] },
          styles: { fontSize: 9, cellPadding: 3 },
          columnStyles: {
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right' },
            5: { halign: 'right' }
          }
        });

        yPos = (doc as any).lastAutoTable.finalY + 15;
      }

      // Trends Section (if detailed report)
      if (sections.trends && reportType === 'detailed' && data.length > 0) {
        if (yPos > pageHeight - 60) {
          doc.addPage();
          yPos = 20;
        }

        doc.setTextColor(...primaryColor);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Detalle de Transacciones (últimas 50)', 20, yPos);
        yPos += 8;

        autoTable(doc, {
          startY: yPos,
          head: [['Fecha', 'Producto', 'Cantidad', 'Total', 'Comisión']],
          body: data.slice(0, 50).map(row => [
            format(new Date(row.sale_date), 'dd/MM/yyyy'),
            row.product_name,
            String(row.quantity),
            `$${formatNumber(Number(row.total_amount))}`,
            `$${formatNumber(Number(row.commission_amount))}`
          ]),
          theme: 'striped',
          headStyles: { fillColor: primaryColor, textColor: [255, 255, 255] },
          styles: { fontSize: 8, cellPadding: 2 },
          columnStyles: {
            2: { halign: 'right' },
            3: { halign: 'right' },
            4: { halign: 'right' }
          }
        });
      }

      // Footer on all pages
      const totalPages = doc.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setTextColor(...mutedColor);
        doc.setFontSize(8);
        doc.text(
          `Página ${i} de ${totalPages}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }

      // Save
      const fileName = `reporte_analisis_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      doc.save(fileName);
      toast.success('Reporte generado exitosamente');
      onOpenChange(false);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Error al generar el reporte');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Generar Reporte PDF
          </DialogTitle>
          <DialogDescription>
            Configura las secciones a incluir en tu reporte
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>Tipo de Reporte</Label>
            <Select value={reportType} onValueChange={(v: any) => setReportType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="executive">Ejecutivo (Resumen)</SelectItem>
                <SelectItem value="detailed">Detallado (Completo)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label>Secciones a incluir</Label>
            
            <div className="space-y-2">
              <div 
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  sections.summary ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                }`}
                onClick={() => toggleSection('summary')}
              >
                <Checkbox checked={sections.summary} />
                <TrendingUp className="h-4 w-4 text-primary" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Resumen Ejecutivo</p>
                  <p className="text-xs text-muted-foreground">KPIs principales y métricas generales</p>
                </div>
              </div>

              <div 
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  sections.clients ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                }`}
                onClick={() => toggleSection('clients')}
              >
                <Checkbox checked={sections.clients} />
                <Users className="h-4 w-4 text-blue-500" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Análisis de Clientes</p>
                  <p className="text-xs text-muted-foreground">Top clientes y ranking de ventas</p>
                </div>
              </div>

              <div 
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  sections.products ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                }`}
                onClick={() => toggleSection('products')}
              >
                <Checkbox checked={sections.products} />
                <Package className="h-4 w-4 text-emerald-500" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Análisis de Productos</p>
                  <p className="text-xs text-muted-foreground">Rendimiento por producto y comisiones</p>
                </div>
              </div>

              {reportType === 'detailed' && (
                <div 
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    sections.trends ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                  }`}
                  onClick={() => toggleSection('trends')}
                >
                  <Checkbox checked={sections.trends} />
                  <BarChart3 className="h-4 w-4 text-violet-500" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Detalle de Transacciones</p>
                    <p className="text-xs text-muted-foreground">Lista completa de ventas recientes</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="text-muted-foreground">
              El reporte incluirá datos del período seleccionado actualmente en el dashboard.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancelar
          </Button>
          <Button 
            onClick={generatePDF} 
            disabled={generating || !Object.values(sections).some(Boolean)}
            className="flex-1 gap-2"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Generar PDF
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
