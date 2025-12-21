import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Upload, Download, FileText, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { parse, format } from 'date-fns';
import { formatNumber } from '@/lib/formatters';

interface Product {
  id: string;
  name: string;
  percentage: number;
}

interface Client {
  id: string;
  name: string;
}

interface ImportedLine {
  productName: string;
  quantity: number;
  unitPrice: number;
  productId?: string;
  error?: string;
}

interface ImportedInvoice {
  ncfSuffix: string;
  invoiceDate: Date;
  clientName: string;
  clientId?: string;
  lines: ImportedLine[];
  errors: string[];
  total: number;
}

interface CSVInvoiceImporterProps {
  products: Product[];
  clients: Client[];
  onImport: (data: {
    ncfSuffix: string;
    invoiceDate: Date;
    clientId?: string;
    lines: { productId: string; quantity: number; unitPrice: number }[];
  }) => void;
  onBulkImport?: (invoices: {
    ncfSuffix: string;
    invoiceDate: Date;
    clientId?: string;
    lines: { productId: string; quantity: number; unitPrice: number }[];
  }[]) => Promise<void>;
}

// Header detection patterns
const HEADER_PATTERNS = [
  /^ncf[-_]?suffix$/i,
  /^ncf$/i,
  /^fecha$/i,
  /^date$/i,
  /^cliente$/i,
  /^client$/i,
  /^producto$/i,
  /^product$/i,
  /^cantidad$/i,
  /^qty$/i,
  /^quantity$/i,
  /^precio[-_]?unitario$/i,
  /^unit[-_]?price$/i,
  /^price$/i,
];

function isHeaderRow(parts: string[]): boolean {
  // If more than half of the cells match header patterns, it's a header row
  const matches = parts.filter(p => 
    HEADER_PATTERNS.some(pattern => pattern.test(p.trim()))
  ).length;
  return matches >= 3;
}

function parseDate(dateStr: string): Date | null {
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  
  // Try multiple date formats
  const formats = [
    'yyyy-MM-dd',
    'dd/MM/yyyy',
    'MM/dd/yyyy',
    'd/M/yyyy',
    'dd-MM-yyyy',
    'MM-dd-yyyy',
    'yyyy/MM/dd',
  ];
  
  for (const fmt of formats) {
    try {
      const parsed = parse(trimmed, fmt, new Date());
      if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 1900 && parsed.getFullYear() < 2100) {
        return parsed;
      }
    } catch {
      continue;
    }
  }
  
  return null;
}

function cleanNumber(value: string): number {
  // Remove any non-numeric characters except dots and minus
  const cleaned = value.replace(/[^\d.-]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function normalizeNCF(ncf: string): string {
  // Extract just the numeric suffix (last 4 digits)
  const digits = ncf.replace(/\D/g, '');
  if (digits.length === 0) return '';
  return digits.slice(-4).padStart(4, '0');
}

export const CSVInvoiceImporter = ({ products, clients, onImport, onBulkImport }: CSVInvoiceImporterProps) => {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<ImportedInvoice[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const template = `NCF_SUFFIX,FECHA,CLIENTE,PRODUCTO,CANTIDAD,PRECIO_UNITARIO
0001,2024-01-15,Farmacia Central,Producto A,10,150.00
0001,2024-01-15,Farmacia Central,Producto B,5,200.50
0002,2024-01-16,Farmacia Norte,Producto A,8,150.00
0002,2024-01-16,Farmacia Norte,Producto C,3,300.00
0003,2024-01-17,Farmacia Sur,Producto B,12,200.50`;

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'template_facturas.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('Template descargado');
  };

  const parseCSV = (text: string): ImportedInvoice[] | null => {
    // Normalize line endings and split
    const rawLines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
    
    if (rawLines.length < 2) {
      toast.error('El archivo CSV debe tener al menos una fila de datos');
      return null;
    }

    // Process all lines, filtering out empty lines and header rows
    const dataLines: { parts: string[]; lineNumber: number }[] = [];
    let firstHeaderFound = false;
    
    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i].trim();
      if (!line) continue; // Skip empty lines
      
      const parts = line.split(',').map(p => p.trim());
      
      // Skip header rows (including repeated ones in the middle)
      if (isHeaderRow(parts)) {
        firstHeaderFound = true;
        continue;
      }
      
      // Skip if we haven't found any header yet and this doesn't look like data
      if (!firstHeaderFound && i === 0) {
        // Assume first row is header if it exists
        firstHeaderFound = true;
        continue;
      }
      
      // Only include rows with enough columns
      if (parts.length >= 6) {
        dataLines.push({ parts, lineNumber: i + 1 });
      }
    }

    if (dataLines.length === 0) {
      toast.error('No se encontraron datos válidos en el archivo');
      return null;
    }

    // Group lines by NCF suffix
    const invoiceMap = new Map<string, {
      ncfSuffix: string;
      invoiceDate: Date;
      clientName: string;
      clientId?: string;
      lines: ImportedLine[];
      errors: string[];
    }>();

    for (const { parts, lineNumber } of dataLines) {
      const [ncfRaw, fechaRaw, clienteRaw, productoRaw, cantidadRaw, precioRaw] = parts;
      
      // Normalize NCF
      const ncfSuffix = normalizeNCF(ncfRaw);
      if (!ncfSuffix) {
        continue; // Skip rows without valid NCF
      }

      // Parse product data first (required for every row)
      const cantidad = cleanNumber(cantidadRaw);
      const precio = cleanNumber(precioRaw);
      const producto = productoRaw.trim();

      if (!producto) {
        continue; // Skip rows without product name
      }

      // Create or get invoice entry
      if (!invoiceMap.has(ncfSuffix)) {
        // Parse date
        const invoiceDate = parseDate(fechaRaw) || new Date();
        
        // Match client
        const clientName = clienteRaw.trim();
        const matchedClient = clients.find(c => {
          const clientLower = c.name.toLowerCase();
          const inputLower = clientName.toLowerCase();
          return clientLower === inputLower || 
                 clientLower.includes(inputLower) || 
                 inputLower.includes(clientLower);
        });

        invoiceMap.set(ncfSuffix, {
          ncfSuffix,
          invoiceDate,
          clientName,
          clientId: matchedClient?.id,
          lines: [],
          errors: []
        });
      }

      const invoice = invoiceMap.get(ncfSuffix)!;

      // Validate quantity
      if (cantidad <= 0) {
        invoice.errors.push(`Línea ${lineNumber}: Cantidad inválida "${cantidadRaw}"`);
        continue;
      }

      // Validate price
      if (precio <= 0) {
        invoice.errors.push(`Línea ${lineNumber}: Precio inválido "${precioRaw}"`);
        continue;
      }

      // Match product
      const matchedProduct = products.find(p => {
        const prodLower = p.name.toLowerCase();
        const inputLower = producto.toLowerCase();
        return prodLower === inputLower || 
               prodLower.includes(inputLower) || 
               inputLower.includes(prodLower);
      });

      invoice.lines.push({
        productName: producto,
        quantity: cantidad,
        unitPrice: precio,
        productId: matchedProduct?.id,
        error: matchedProduct ? undefined : 'Producto no encontrado en catálogo'
      });
    }

    // Convert to array and calculate totals
    const invoices: ImportedInvoice[] = Array.from(invoiceMap.values())
      .filter(inv => inv.lines.length > 0) // Only include invoices with products
      .map(inv => ({
        ...inv,
        total: inv.lines.reduce((sum, l) => sum + (l.quantity * l.unitPrice), 0)
      }))
      .sort((a, b) => a.ncfSuffix.localeCompare(b.ncfSuffix)); // Sort by NCF

    if (invoices.length === 0) {
      toast.error('No se encontraron facturas válidas. Verifica el formato del archivo.');
      return null;
    }

    return invoices;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);
      setPreview(parsed);
      setLoading(false);
    };

    reader.onerror = () => {
      toast.error('Error al leer el archivo');
      setLoading(false);
    };

    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!preview || preview.length === 0) return;

    setImporting(true);

    try {
      // If only one invoice, use single import
      if (preview.length === 1) {
        const inv = preview[0];
        const validLines = inv.lines
          .filter(l => l.productId)
          .map(l => ({
            productId: l.productId!,
            quantity: l.quantity,
            unitPrice: l.unitPrice
          }));

        if (validLines.length === 0) {
          toast.error('No hay productos válidos para importar');
          setImporting(false);
          return;
        }

        onImport({
          ncfSuffix: inv.ncfSuffix,
          invoiceDate: inv.invoiceDate,
          clientId: inv.clientId,
          lines: validLines
        });

        toast.success(`Factura B010000${inv.ncfSuffix} importada con ${validLines.length} productos`);
      } else {
        // Multiple invoices - use bulk import if available
        if (onBulkImport) {
          const invoicesToImport = preview
            .filter(inv => inv.lines.some(l => l.productId))
            .map(inv => ({
              ncfSuffix: inv.ncfSuffix,
              invoiceDate: inv.invoiceDate,
              clientId: inv.clientId,
              lines: inv.lines
                .filter(l => l.productId)
                .map(l => ({
                  productId: l.productId!,
                  quantity: l.quantity,
                  unitPrice: l.unitPrice
                }))
            }));

          if (invoicesToImport.length === 0) {
            toast.error('No hay facturas válidas para importar');
            setImporting(false);
            return;
          }

          await onBulkImport(invoicesToImport);
          toast.success(`${invoicesToImport.length} facturas importadas correctamente`);
        } else {
          // Fall back to importing first invoice only
          const inv = preview[0];
          const validLines = inv.lines
            .filter(l => l.productId)
            .map(l => ({
              productId: l.productId!,
              quantity: l.quantity,
              unitPrice: l.unitPrice
            }));

          onImport({
            ncfSuffix: inv.ncfSuffix,
            invoiceDate: inv.invoiceDate,
            clientId: inv.clientId,
            lines: validLines
          });

          toast.success(`Primera factura importada (${preview.length - 1} pendientes)`);
        }
      }

      setOpen(false);
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      toast.error('Error al importar facturas');
      console.error('Import error:', error);
    } finally {
      setImporting(false);
    }
  };

  const resetImport = () => {
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const totalValidProducts = preview?.reduce((sum, inv) => sum + inv.lines.filter(l => l.productId).length, 0) || 0;
  const totalInvalidProducts = preview?.reduce((sum, inv) => sum + inv.lines.filter(l => !l.productId).length, 0) || 0;
  const totalInvoices = preview?.length || 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetImport(); }}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-2 bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-0">
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">Importar CSV</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Importar Facturas desde CSV
          </DialogTitle>
          <DialogDescription>
            Sube un archivo CSV con múltiples facturas. El sistema agrupa automáticamente por NCF.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto">
          {/* Template download */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-dashed">
            <div>
              <p className="text-sm font-medium">Template CSV</p>
              <p className="text-xs text-muted-foreground">Formato: NCF_SUFFIX, FECHA, CLIENTE, PRODUCTO, CANTIDAD, PRECIO</p>
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
              <Download className="h-4 w-4" />
              Descargar
            </Button>
          </div>

          {/* Instructions */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-xs space-y-1">
            <p className="font-semibold text-blue-700 dark:text-blue-400">Instrucciones:</p>
            <ul className="list-disc list-inside text-blue-600 dark:text-blue-300 space-y-0.5">
              <li>Cada fila representa un producto de una factura</li>
              <li>Las filas con el mismo NCF se agrupan en una sola factura</li>
              <li>Los encabezados repetidos se ignoran automáticamente</li>
              <li>Formatos de fecha soportados: YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY</li>
            </ul>
          </div>

          {/* File input */}
          <div className="space-y-2">
            <label 
              htmlFor="csv-file" 
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/20 hover:bg-muted/40 transition-colors"
            >
              {loading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                  <p className="text-sm text-muted-foreground">Procesando archivo...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold">Haz clic para subir</span> o arrastra un archivo
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Archivo CSV</p>
                </div>
              )}
              <input 
                id="csv-file" 
                ref={fileInputRef}
                type="file" 
                accept=".csv,.txt" 
                className="hidden" 
                onChange={handleFileChange}
                disabled={loading}
              />
            </label>
          </div>

          {/* Preview */}
          {preview && preview.length > 0 && (
            <div className="space-y-3">
              {/* Summary */}
              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-primary">
                      {totalInvoices} factura{totalInvoices > 1 ? 's' : ''} detectada{totalInvoices > 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {totalValidProducts} productos válidos
                      {totalInvalidProducts > 0 && (
                        <span className="text-amber-600"> • {totalInvalidProducts} sin match</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">
                      ${formatNumber(preview.reduce((sum, inv) => sum + inv.total, 0))}
                    </p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                </div>
              </div>

              {/* Invoice list */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {preview.map((invoice, idx) => (
                  <div key={idx} className="p-3 bg-card rounded-lg border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-semibold bg-muted px-2 py-1 rounded">
                          B010000{invoice.ncfSuffix}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(invoice.invoiceDate, 'dd/MM/yyyy')}
                        </span>
                      </div>
                      <span className="text-sm font-bold">${formatNumber(invoice.total)}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Cliente:</span>
                      <span className="font-medium truncate flex-1">{invoice.clientName}</span>
                      {invoice.clientId ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                      )}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1">
                      {invoice.lines.map((line, i) => (
                        <span 
                          key={i} 
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            line.productId 
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          }`}
                        >
                          {line.productName} ({line.quantity} × ${formatNumber(line.unitPrice)})
                        </span>
                      ))}
                    </div>

                    {invoice.errors.length > 0 && (
                      <div className="mt-2 text-xs text-destructive">
                        {invoice.errors.map((err, i) => (
                          <p key={i}>{err}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          {preview && preview.length > 0 && (
            <Button 
              onClick={handleImport} 
              disabled={importing || totalValidProducts === 0}
              className="gap-2"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Importar {totalInvoices} factura{totalInvoices > 1 ? 's' : ''}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
