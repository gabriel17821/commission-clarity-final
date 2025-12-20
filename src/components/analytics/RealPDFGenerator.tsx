import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, Loader2, BarChart3, Users, Package, TrendingUp, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { RealAnalyticsResult } from '@/hooks/useRealAnalytics';
import { formatNumber } from '@/lib/formatters';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';

interface RealPDFGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analytics: RealAnalyticsResult;
  viewMode: 'personal' | 'general';
  sellerName?: string;
}

export function RealPDFGenerator({ 
  open, 
  onOpenChange, 
  analytics,
  viewMode,
  sellerName
}: RealPDFGeneratorProps) {
  const [generating, setGenerating] = useState(false);
  const [sections, setSections] = useState({
    summary: true,
    monthlyTrend: true,
    clients: true,
    products: true,
    sellers: true,
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
      const primaryColor: [number, number, number] = [99, 102, 241];
      const textColor: [number, number, number] = [31, 41, 55];
      const mutedColor: [number, number, number] = [107, 114, 128];
      const successColor: [number, number, number] = [16, 185, 129];

      // Header
      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, pageWidth, 45, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('Reporte de Ventas', 20, 22);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      const subtitle = viewMode === 'personal' && sellerName 
        ? `Vendedor: ${sellerName}` 
        : 'Resumen General del Negocio';
      doc.text(subtitle, 20, 32);
      
      doc.setFontSize(10);
      doc.text(`Generado: ${format(new Date(), "d 'de' MMMM, yyyy", { locale: es })}`, 20, 40);

      yPos = 55;

      // Summary Section - GROWTH FOCUS
      if (sections.summary) {
        doc.setTextColor(...primaryColor);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Resumen de Crecimiento', 20, yPos);
        yPos += 12;

        // Main growth boxes
        const boxWidth = (pageWidth - 50) / 2;
        const boxHeight = 35;

        // Current Month Sales
        doc.setFillColor(249, 250, 251);
        doc.roundedRect(20, yPos, boxWidth, boxHeight, 3, 3, 'F');
        
        doc.setTextColor(...mutedColor);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text('VENTAS ESTE MES', 25, yPos + 8);
        
        doc.setTextColor(...textColor);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(`$${formatNumber(analytics.currentMonthSales)}`, 25, yPos + 20);
        
        const salesGrowthText = `${analytics.monthlyGrowth >= 0 ? '+' : ''}${analytics.monthlyGrowth.toFixed(1)}% vs mes anterior`;
        doc.setFontSize(9);
        if (analytics.monthlyGrowth >= 0) {
          doc.setTextColor(...successColor);
        } else {
          doc.setTextColor(239, 68, 68);
        }
        doc.text(salesGrowthText, 25, yPos + 30);

        // Current Month Commission
        const x2 = 20 + boxWidth + 10;
        doc.setFillColor(240, 253, 244);
        doc.roundedRect(x2, yPos, boxWidth, boxHeight, 3, 3, 'F');
        
        doc.setTextColor(...mutedColor);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text('COMISIÓN ESTE MES', x2 + 5, yPos + 8);
        
        doc.setTextColor(...successColor);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text(`$${formatNumber(analytics.currentMonthCommission)}`, x2 + 5, yPos + 20);
        
        const commGrowthText = `${analytics.commissionGrowth >= 0 ? '+' : ''}${analytics.commissionGrowth.toFixed(1)}% vs mes anterior`;
        doc.setFontSize(9);
        if (analytics.commissionGrowth >= 0) {
          doc.setTextColor(...successColor);
        } else {
          doc.setTextColor(239, 68, 68);
        }
        doc.text(commGrowthText, x2 + 5, yPos + 30);

        yPos += boxHeight + 10;

        // Accumulated totals row
        const smallBoxWidth = (pageWidth - 60) / 3;
        const smallBoxHeight = 22;

        const accumulatedData = [
          { label: 'Total Acumulado', value: `$${formatNumber(analytics.totalSales)}` },
          { label: 'Comisión Total', value: `$${formatNumber(analytics.totalCommission)}` },
          { label: 'Facturas', value: String(analytics.invoiceCount) },
        ];

        accumulatedData.forEach((item, idx) => {
          const x = 20 + idx * (smallBoxWidth + 10);
          doc.setFillColor(249, 250, 251);
          doc.roundedRect(x, yPos, smallBoxWidth, smallBoxHeight, 2, 2, 'F');
          
          doc.setTextColor(...mutedColor);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.text(item.label, x + 5, yPos + 8);
          
          doc.setTextColor(...textColor);
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text(item.value, x + 5, yPos + 18);
        });

        yPos += smallBoxHeight + 15;
      }

      // Monthly Trend Table
      if (sections.monthlyTrend && analytics.last12Months.length > 0) {
        if (yPos > pageHeight - 100) {
          doc.addPage();
          yPos = 20;
        }

        doc.setTextColor(...primaryColor);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Evolución Mensual', 20, yPos);
        yPos += 8;

        autoTable(doc, {
          startY: yPos,
          head: [['Mes', 'Ventas', 'Comisión', 'Facturas']],
          body: analytics.last12Months.map(m => [
            m.monthLabel,
            `$${formatNumber(m.sales)}`,
            `$${formatNumber(m.commission)}`,
            String(m.invoiceCount)
          ]),
          theme: 'striped',
          headStyles: { fillColor: primaryColor, textColor: [255, 255, 255] },
          styles: { fontSize: 9, cellPadding: 3 },
          columnStyles: {
            1: { halign: 'right' },
            2: { halign: 'right' },
            3: { halign: 'right' }
          }
        });

        yPos = (doc as any).lastAutoTable.finalY + 15;
      }

      // Clients Section
      if (sections.clients && analytics.clientMetrics.length > 0) {
        if (yPos > pageHeight - 80) {
          doc.addPage();
          yPos = 20;
        }

        doc.setTextColor(...primaryColor);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Ranking de Clientes', 20, yPos);
        yPos += 8;

        autoTable(doc, {
          startY: yPos,
          head: [['#', 'Cliente', 'Facturas', 'Total', 'Comisión', 'Este Mes', 'Tendencia']],
          body: analytics.clientMetrics.slice(0, 15).map((client, idx) => [
            String(idx + 1),
            client.name,
            String(client.invoiceCount),
            `$${formatNumber(client.totalSales)}`,
            `$${formatNumber(client.totalCommission)}`,
            `$${formatNumber(client.currentMonthSales)}`,
            `${client.trend >= 0 ? '+' : ''}${client.trend.toFixed(1)}%`
          ]),
          theme: 'striped',
          headStyles: { fillColor: primaryColor, textColor: [255, 255, 255] },
          styles: { fontSize: 9, cellPadding: 3 },
          columnStyles: {
            0: { cellWidth: 10 },
            3: { halign: 'right' },
            4: { halign: 'right' },
            5: { halign: 'right' },
            6: { halign: 'right' }
          }
        });

        yPos = (doc as any).lastAutoTable.finalY + 15;
      }

      // Products Section
      if (sections.products && analytics.productMetrics.length > 0) {
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
          head: [['Producto', 'Facturas', 'Total', 'Comisión', 'Prom/Fact', 'Tendencia']],
          body: analytics.productMetrics.slice(0, 15).map(product => [
            product.name,
            String(product.invoiceCount),
            `$${formatNumber(product.totalSales)}`,
            `$${formatNumber(product.totalCommission)}`,
            `$${formatNumber(product.avgPerInvoice)}`,
            `${product.trend >= 0 ? '+' : ''}${product.trend.toFixed(1)}%`
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

      // Sellers Section (only in general view)
      if (sections.sellers && viewMode === 'general' && analytics.sellerMetrics.length > 0) {
        if (yPos > pageHeight - 80) {
          doc.addPage();
          yPos = 20;
        }

        doc.setTextColor(...primaryColor);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Desempeño por Vendedor', 20, yPos);
        yPos += 8;

        autoTable(doc, {
          startY: yPos,
          head: [['#', 'Vendedor', 'Facturas', 'Ventas', 'Comisión', 'Este Mes', 'Crecimiento']],
          body: analytics.sellerMetrics.map((seller, idx) => [
            String(idx + 1),
            seller.name,
            String(seller.invoiceCount),
            `$${formatNumber(seller.totalSales)}`,
            `$${formatNumber(seller.totalCommission)}`,
            `$${formatNumber(seller.currentMonthSales)}`,
            `${seller.growth >= 0 ? '+' : ''}${seller.growth.toFixed(1)}%`
          ]),
          theme: 'striped',
          headStyles: { fillColor: primaryColor, textColor: [255, 255, 255] },
          styles: { fontSize: 9, cellPadding: 3 },
          columnStyles: {
            0: { cellWidth: 10 },
            3: { halign: 'right' },
            4: { halign: 'right' },
            5: { halign: 'right' },
            6: { halign: 'right' }
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
      const filePrefix = viewMode === 'personal' && sellerName 
        ? `reporte_${sellerName.toLowerCase().replace(/\s+/g, '_')}`
        : 'reporte_general';
      const fileName = `${filePrefix}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
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
            Exportar Reporte PDF
          </DialogTitle>
          <DialogDescription>
            {viewMode === 'personal' && sellerName 
              ? `Reporte de ${sellerName}` 
              : 'Reporte general del negocio'
            }
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
                  <p className="font-medium text-sm">Resumen de Crecimiento</p>
                  <p className="text-xs text-muted-foreground">KPIs y comparativa mes a mes</p>
                </div>
              </div>

              <div 
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  sections.monthlyTrend ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                }`}
                onClick={() => toggleSection('monthlyTrend')}
              >
                <Checkbox checked={sections.monthlyTrend} />
                <BarChart3 className="h-4 w-4 text-violet-500" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Evolución Mensual</p>
                  <p className="text-xs text-muted-foreground">Tabla de últimos 12 meses</p>
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
                  <p className="font-medium text-sm">Ranking de Clientes</p>
                  <p className="text-xs text-muted-foreground">Top 15 clientes con tendencias</p>
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
                  <p className="text-xs text-muted-foreground">Rendimiento por producto</p>
                </div>
              </div>

              {viewMode === 'general' && (
                <div 
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    sections.sellers ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                  }`}
                  onClick={() => toggleSection('sellers')}
                >
                  <Checkbox checked={sections.sellers} />
                  <UserCheck className="h-4 w-4 text-amber-500" />
                  <div className="flex-1">
                    <p className="font-medium text-sm">Desempeño Vendedores</p>
                    <p className="text-xs text-muted-foreground">Comparativa entre vendedores</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <p className="text-muted-foreground">
              El reporte incluirá datos basados en las facturas guardadas en el sistema.
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
                Descargar PDF
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
