import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, X, Download } from 'lucide-react';
import { Client } from '@/hooks/useClients';
import { Product } from '@/hooks/useProducts';
import { AnalyticsInsert } from '@/hooks/useAnalytics';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

interface ExcelImporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (items: AnalyticsInsert[]) => Promise<{ success: number; failed: number }>;
  clients: Client[];
  products: Product[];
}

interface ParsedRow {
  client_name?: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  sale_date: string;
  commission_percentage: number;
  isValid: boolean;
  errors: string[];
}

export function ExcelImporter({ open, onOpenChange, onImport, clients, products }: ExcelImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    
    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const parsed: ParsedRow[] = jsonData.map((row: any) => {
        const errors: string[] = [];
        
        // Validate required fields
        if (!row['Producto'] && !row['producto'] && !row['Product']) {
          errors.push('Producto requerido');
        }
        if (!row['Cantidad'] && !row['cantidad'] && !row['Quantity']) {
          errors.push('Cantidad requerida');
        }
        if (!row['Precio'] && !row['precio'] && !row['Price'] && !row['Precio Unitario']) {
          errors.push('Precio requerido');
        }

        const quantity = Number(row['Cantidad'] || row['cantidad'] || row['Quantity'] || 0);
        const unitPrice = Number(row['Precio'] || row['precio'] || row['Price'] || row['Precio Unitario'] || 0);
        const commissionPercentage = Number(row['Comision'] || row['comision'] || row['Commission'] || row['Porcentaje'] || 15);

        // Parse date
        let saleDate = new Date().toISOString().split('T')[0];
        const dateValue = row['Fecha'] || row['fecha'] || row['Date'];
        if (dateValue) {
          if (typeof dateValue === 'number') {
            // Excel date serial number
            const excelDate = new Date((dateValue - 25569) * 86400 * 1000);
            saleDate = excelDate.toISOString().split('T')[0];
          } else if (typeof dateValue === 'string') {
            const parsed = new Date(dateValue);
            if (!isNaN(parsed.getTime())) {
              saleDate = parsed.toISOString().split('T')[0];
            }
          }
        }

        return {
          client_name: row['Cliente'] || row['cliente'] || row['Client'] || '',
          product_name: row['Producto'] || row['producto'] || row['Product'] || '',
          quantity,
          unit_price: unitPrice,
          sale_date: saleDate,
          commission_percentage: commissionPercentage,
          isValid: errors.length === 0,
          errors,
        };
      });

      setParsedData(parsed);
      setStep('preview');
    } catch (error) {
      console.error('Error parsing Excel:', error);
      toast.error('Error al leer el archivo Excel');
    }
  };

  const handleImport = async () => {
    const validRows = parsedData.filter(row => row.isValid);
    if (validRows.length === 0) {
      toast.error('No hay filas válidas para importar');
      return;
    }

    setImporting(true);

    const items: AnalyticsInsert[] = validRows.map(row => {
      const client = clients.find(c => 
        c.name.toLowerCase() === row.client_name?.toLowerCase()
      );
      const product = products.find(p => 
        p.name.toLowerCase() === row.product_name.toLowerCase()
      );

      const totalAmount = row.quantity * row.unit_price;
      const commissionAmount = totalAmount * (row.commission_percentage / 100);

      return {
        client_id: client?.id || null,
        product_id: product?.id || null,
        product_name: row.product_name,
        quantity: row.quantity,
        unit_price: row.unit_price,
        total_amount: totalAmount,
        commission_percentage: row.commission_percentage,
        commission_amount: commissionAmount,
        sale_date: row.sale_date,
      };
    });

    const importResult = await onImport(items);
    setResult(importResult);
    setStep('result');
    setImporting(false);
  };

  const downloadTemplate = () => {
    const template = [
      {
        'Cliente': 'Nombre del Cliente',
        'Producto': 'Nombre del Producto',
        'Cantidad': 10,
        'Precio Unitario': 100,
        'Fecha': '2024-01-15',
        'Porcentaje': 15
      }
    ];
    
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
    XLSX.writeFile(wb, 'plantilla_importacion.xlsx');
  };

  const reset = () => {
    setFile(null);
    setParsedData([]);
    setStep('upload');
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar desde Excel
          </DialogTitle>
          <DialogDescription>
            Importa datos de ventas masivamente desde un archivo Excel
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-6 py-4">
            <div 
              className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">Arrastra tu archivo aquí</p>
              <p className="text-muted-foreground text-sm mb-4">o haz clic para seleccionar</p>
              <p className="text-xs text-muted-foreground">Soporta: .xlsx, .xls, .csv</p>
            </div>

            <div className="flex items-center justify-center gap-4">
              <Button variant="outline" onClick={downloadTemplate} className="gap-2">
                <Download className="h-4 w-4" />
                Descargar Plantilla
              </Button>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
              <p className="font-medium">Columnas esperadas:</p>
              <ul className="text-muted-foreground space-y-1">
                <li>• <strong>Cliente</strong> - Nombre del cliente (opcional)</li>
                <li>• <strong>Producto</strong> - Nombre del producto (requerido)</li>
                <li>• <strong>Cantidad</strong> - Cantidad vendida (requerido)</li>
                <li>• <strong>Precio Unitario</strong> - Precio por unidad (requerido)</li>
                <li>• <strong>Fecha</strong> - Fecha de venta (opcional, formato: YYYY-MM-DD)</li>
                <li>• <strong>Porcentaje</strong> - Porcentaje de comisión (opcional, default: 15%)</li>
              </ul>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="flex-1 overflow-hidden flex flex-col space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{file?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {parsedData.filter(r => r.isValid).length} de {parsedData.length} filas válidas
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={reset}>
                Cambiar archivo
              </Button>
            </div>

            <div className="flex-1 overflow-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="text-left py-2 px-3 font-medium">Estado</th>
                    <th className="text-left py-2 px-3 font-medium">Cliente</th>
                    <th className="text-left py-2 px-3 font-medium">Producto</th>
                    <th className="text-right py-2 px-3 font-medium">Cantidad</th>
                    <th className="text-right py-2 px-3 font-medium">Precio</th>
                    <th className="text-left py-2 px-3 font-medium">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedData.slice(0, 100).map((row, idx) => (
                    <tr key={idx} className={`border-t ${row.isValid ? '' : 'bg-rose-500/5'}`}>
                      <td className="py-2 px-3">
                        {row.isValid ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <div className="flex items-center gap-1">
                            <AlertCircle className="h-4 w-4 text-rose-500" />
                            <span className="text-xs text-rose-500">{row.errors[0]}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3">{row.client_name || '-'}</td>
                      <td className="py-2 px-3">{row.product_name}</td>
                      <td className="py-2 px-3 text-right">{row.quantity}</td>
                      <td className="py-2 px-3 text-right">${row.unit_price}</td>
                      <td className="py-2 px-3">{row.sale_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedData.length > 100 && (
                <p className="text-center py-2 text-sm text-muted-foreground">
                  Mostrando 100 de {parsedData.length} filas
                </p>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={importing || parsedData.filter(r => r.isValid).length === 0}
                className="gap-2"
              >
                {importing ? 'Importando...' : 'Importar Datos'}
              </Button>
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div className="py-8 text-center space-y-6">
            <div className="h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
            
            <div>
              <h3 className="text-2xl font-bold mb-2">Importación Completada</h3>
              <p className="text-muted-foreground">
                Se importaron {result.success} registros exitosamente
              </p>
              {result.failed > 0 && (
                <p className="text-rose-500 mt-1">
                  {result.failed} registros fallaron
                </p>
              )}
            </div>

            <Button onClick={handleClose} className="w-full max-w-xs">
              Cerrar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
