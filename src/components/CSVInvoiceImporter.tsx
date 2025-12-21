import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Upload, Download, FileText, AlertCircle, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { parse, format } from 'date-fns';
import { formatCurrency } from '@/lib/formatters';

interface Product {
  id: string;
  name: string;
  percentage: number;
}

interface Client {
  id: string;
  name: string;
}

interface ParsedRow {
  lineNumber: number;
  ncfSuffix: string;
  fecha: string;
  cliente: string;
  producto: string;
  cantidad: string;
  precioUnitario: string;
  isValid: boolean;
  errors: string[];
  // Resolved values (only if valid)
  resolvedDate?: Date;
  resolvedQuantity?: number;
  resolvedUnitPrice?: number;
  resolvedProductId?: string;
  resolvedClientId?: string;
}

interface GroupedInvoice {
  ncfSuffix: string;
  date: Date;
  clientName: string;
  clientId?: string;
  rows: ParsedRow[];
  hasErrors: boolean;
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

// Simple date parser - tries common formats
function parseDate(str: string): Date | null {
  const trimmed = str.trim();
  if (!trimmed) return null;

  const formats = [
    'yyyy-MM-dd',
    'dd/MM/yyyy',
    'MM/dd/yyyy',
    'd/M/yyyy',
    'dd-MM-yyyy',
  ];

  for (const fmt of formats) {
    try {
      const d = parse(trimmed, fmt, new Date());
      if (!isNaN(d.getTime()) && d.getFullYear() > 1900 && d.getFullYear() < 2100) {
        return d;
      }
    } catch {
      continue;
    }
  }
  return null;
}

// Match product by exact or partial name (case insensitive)
function matchProduct(name: string, products: Product[]): Product | undefined {
  const normalized = name.toLowerCase().trim();
  return products.find(p => {
    const pName = p.name.toLowerCase().trim();
    return pName === normalized || pName.includes(normalized) || normalized.includes(pName);
  });
}

// Match client by exact or partial name (case insensitive)
function matchClient(name: string, clients: Client[]): Client | undefined {
  const normalized = name.toLowerCase().trim();
  return clients.find(c => {
    const cName = c.name.toLowerCase().trim();
    return cName === normalized || cName.includes(normalized) || normalized.includes(cName);
  });
}

export const CSVInvoiceImporter = ({ products, clients, onImport, onBulkImport }: CSVInvoiceImporterProps) => {
  const [open, setOpen] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[] | null>(null);
  const [groupedInvoices, setGroupedInvoices] = useState<GroupedInvoice[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const template = `NCF_SUFFIX,FECHA,CLIENTE,PRODUCTO,CANTIDAD,PRECIO_UNITARIO
0001,2024-01-15,Farmacia Central,Producto A,10,150.00
0001,2024-01-15,Farmacia Central,Producto B,5,200.50
0002,2024-01-16,Farmacia Norte,Producto A,8,150.00
0002,2024-01-16,Farmacia Norte,Producto C,3,300.00`;

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'template_facturas.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('Template descargado');
  };

  /**
   * STRICT PARSER: Reads exactly 6 columns per row.
   * Does NOT calculate, infer, or concatenate anything.
   * Simply reads text and marks invalid rows.
   */
  const parseCSVStrict = (text: string): ParsedRow[] => {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
    const rows: ParsedRow[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Split by comma - exactly 6 columns expected
      const parts = line.split(',').map(p => p.trim());

      // Check if this is a header row (skip it)
      const isHeader = parts.some(p => 
        /^(ncf|suffix|fecha|date|cliente|client|producto|product|cantidad|qty|quantity|precio|price)$/i.test(p)
      );
      if (isHeader) continue;

      const errors: string[] = [];
      
      // Require exactly 6 columns
      if (parts.length < 6) {
        errors.push(`Faltan columnas (tiene ${parts.length}, necesita 6)`);
      }

      const [ncfSuffix, fecha, cliente, producto, cantidad, precioUnitario] = parts;

      // Validate each field (raw text validation only)
      if (!ncfSuffix || ncfSuffix.length === 0) {
        errors.push('NCF vacío');
      }
      if (!fecha || fecha.length === 0) {
        errors.push('Fecha vacía');
      }
      if (!producto || producto.length === 0) {
        errors.push('Producto vacío');
      }
      if (!cantidad || cantidad.length === 0) {
        errors.push('Cantidad vacía');
      }
      if (!precioUnitario || precioUnitario.length === 0) {
        errors.push('Precio vacío');
      }

      const row: ParsedRow = {
        lineNumber: i + 1,
        ncfSuffix: ncfSuffix || '',
        fecha: fecha || '',
        cliente: cliente || '',
        producto: producto || '',
        cantidad: cantidad || '',
        precioUnitario: precioUnitario || '',
        isValid: errors.length === 0,
        errors
      };

      // Only resolve values if no basic errors
      if (row.isValid) {
        // Parse date
        const parsedDate = parseDate(row.fecha);
        if (!parsedDate) {
          row.errors.push('Fecha inválida');
          row.isValid = false;
        } else {
          row.resolvedDate = parsedDate;
        }

        // Parse quantity (must be a positive number)
        const qty = parseFloat(row.cantidad.replace(/[^\d.-]/g, ''));
        if (isNaN(qty) || qty <= 0) {
          row.errors.push('Cantidad debe ser número > 0');
          row.isValid = false;
        } else {
          row.resolvedQuantity = qty;
        }

        // Parse price (must be a positive number)
        const price = parseFloat(row.precioUnitario.replace(/[^\d.-]/g, ''));
        if (isNaN(price) || price <= 0) {
          row.errors.push('Precio debe ser número > 0');
          row.isValid = false;
        } else {
          row.resolvedUnitPrice = price;
        }

        // Match product
        const matchedProduct = matchProduct(row.producto, products);
        if (!matchedProduct) {
          row.errors.push('Producto no encontrado');
          row.isValid = false;
        } else {
          row.resolvedProductId = matchedProduct.id;
        }

        // Match client (optional - just for display)
        const matchedClient = matchClient(row.cliente, clients);
        if (matchedClient) {
          row.resolvedClientId = matchedClient.id;
        }
      }

      rows.push(row);
    }

    return rows;
  };

  const groupRowsByNCF = (rows: ParsedRow[]): GroupedInvoice[] => {
    const groups = new Map<string, GroupedInvoice>();

    for (const row of rows) {
      // Normalize NCF to 4 digits
      const ncf = row.ncfSuffix.replace(/\D/g, '').slice(-4).padStart(4, '0');
      if (!ncf || ncf === '0000') continue;

      if (!groups.has(ncf)) {
        groups.set(ncf, {
          ncfSuffix: ncf,
          date: row.resolvedDate || new Date(),
          clientName: row.cliente,
          clientId: row.resolvedClientId,
          rows: [],
          hasErrors: false,
          total: 0
        });
      }

      const group = groups.get(ncf)!;
      group.rows.push(row);
      
      if (!row.isValid) {
        group.hasErrors = true;
      } else if (row.resolvedQuantity && row.resolvedUnitPrice) {
        group.total += row.resolvedQuantity * row.resolvedUnitPrice;
      }
    }

    return Array.from(groups.values()).sort((a, b) => a.ncfSuffix.localeCompare(b.ncfSuffix));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      const text = event.target?.result as string;
      const rows = parseCSVStrict(text);
      setParsedRows(rows);

      if (rows.length === 0) {
        toast.error('No se encontraron datos en el archivo');
        setGroupedInvoices(null);
      } else {
        const groups = groupRowsByNCF(rows);
        setGroupedInvoices(groups);
        
        const validCount = rows.filter(r => r.isValid).length;
        const invalidCount = rows.filter(r => !r.isValid).length;
        
        if (invalidCount > 0) {
          toast.warning(`${validCount} filas válidas, ${invalidCount} con errores`);
        } else {
          toast.success(`${validCount} filas procesadas correctamente`);
        }
      }
      setLoading(false);
    };

    reader.onerror = () => {
      toast.error('Error al leer el archivo');
      setLoading(false);
    };

    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!groupedInvoices || groupedInvoices.length === 0) return;

    // Filter only invoices without errors and with valid rows
    const validInvoices = groupedInvoices
      .filter(inv => !inv.hasErrors && inv.rows.some(r => r.isValid && r.resolvedProductId))
      .map(inv => ({
        ncfSuffix: inv.ncfSuffix,
        invoiceDate: inv.date,
        clientId: inv.clientId,
        lines: inv.rows
          .filter(r => r.isValid && r.resolvedProductId && r.resolvedQuantity && r.resolvedUnitPrice)
          .map(r => ({
            productId: r.resolvedProductId!,
            quantity: r.resolvedQuantity!,
            unitPrice: r.resolvedUnitPrice!
          }))
      }))
      .filter(inv => inv.lines.length > 0);

    if (validInvoices.length === 0) {
      toast.error('No hay facturas válidas para importar');
      return;
    }

    setImporting(true);

    try {
      if (validInvoices.length === 1) {
        const inv = validInvoices[0];
        onImport({
          ncfSuffix: inv.ncfSuffix,
          invoiceDate: inv.invoiceDate,
          clientId: inv.clientId,
          lines: inv.lines
        });
        toast.success(`Factura B010000${inv.ncfSuffix} importada`);
      } else if (onBulkImport) {
        await onBulkImport(validInvoices);
        toast.success(`${validInvoices.length} facturas importadas`);
      } else {
        // Fallback: import first only
        const inv = validInvoices[0];
        onImport({
          ncfSuffix: inv.ncfSuffix,
          invoiceDate: inv.invoiceDate,
          clientId: inv.clientId,
          lines: inv.lines
        });
        toast.success(`Primera factura importada (${validInvoices.length - 1} pendientes)`);
      }

      setOpen(false);
      resetImport();
    } catch (error) {
      toast.error('Error al importar');
      console.error(error);
    } finally {
      setImporting(false);
    }
  };

  const resetImport = () => {
    setParsedRows(null);
    setGroupedInvoices(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validInvoicesCount = groupedInvoices?.filter(inv => !inv.hasErrors && inv.rows.some(r => r.isValid)).length || 0;
  const totalRowsValid = parsedRows?.filter(r => r.isValid).length || 0;
  const totalRowsInvalid = parsedRows?.filter(r => !r.isValid).length || 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetImport(); }}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" className="gap-2 bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-0">
          <Upload className="h-4 w-4" />
          <span className="hidden sm:inline">Importar CSV</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Importar Facturas desde CSV
          </DialogTitle>
          <DialogDescription>
            Parser estricto: 6 columnas exactas (NCF, FECHA, CLIENTE, PRODUCTO, CANTIDAD, PRECIO)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto">
          {/* Template */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-dashed">
            <div>
              <p className="text-sm font-medium">Template CSV</p>
              <p className="text-xs text-muted-foreground">NCF_SUFFIX, FECHA, CLIENTE, PRODUCTO, CANTIDAD, PRECIO_UNITARIO</p>
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
              <Download className="h-4 w-4" />
              Descargar
            </Button>
          </div>

          {/* Instructions */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-xs space-y-1">
            <p className="font-semibold text-blue-700 dark:text-blue-400">Reglas del parser:</p>
            <ul className="list-disc list-inside text-blue-600 dark:text-blue-300 space-y-0.5">
              <li>Cada fila debe tener exactamente 6 columnas separadas por coma</li>
              <li>Los productos deben existir en el catálogo (importar primero si faltan)</li>
              <li>Formatos de fecha: YYYY-MM-DD o DD/MM/YYYY</li>
              <li>Filas con errores se marcan en rojo pero no bloquean el resto</li>
            </ul>
          </div>

          {/* File input */}
          <label 
            htmlFor="csv-invoices" 
            className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-lg cursor-pointer bg-muted/20 hover:bg-muted/40 transition-colors"
          >
            {loading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                <p className="text-sm text-muted-foreground">Procesando...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-4">
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold">Haz clic para subir</span> archivo CSV
                </p>
              </div>
            )}
            <input 
              id="csv-invoices" 
              ref={fileInputRef}
              type="file" 
              accept=".csv,.txt" 
              className="hidden" 
              onChange={handleFileChange}
              disabled={loading}
            />
          </label>

          {/* Results */}
          {groupedInvoices && groupedInvoices.length > 0 && (
            <div className="space-y-3">
              {/* Summary */}
              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-primary">
                    {validInvoicesCount} factura{validInvoicesCount !== 1 ? 's' : ''} lista{validInvoicesCount !== 1 ? 's' : ''} para importar
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {totalRowsValid} filas válidas
                    {totalRowsInvalid > 0 && <span className="text-destructive"> · {totalRowsInvalid} con errores</span>}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={resetImport}>
                  Limpiar
                </Button>
              </div>

              {/* Invoice groups */}
              <div className="max-h-72 overflow-y-auto space-y-3 border rounded-lg p-3">
                {groupedInvoices.map((inv) => (
                  <div 
                    key={inv.ncfSuffix} 
                    className={`p-3 rounded-lg border ${inv.hasErrors ? 'bg-destructive/5 border-destructive/30' : 'bg-card'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {inv.hasErrors ? (
                          <XCircle className="h-4 w-4 text-destructive" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        )}
                        <span className="font-mono font-bold">B010000{inv.ncfSuffix}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(inv.date, 'dd/MM/yyyy')}
                        </span>
                      </div>
                      <span className="text-sm font-semibold">{formatCurrency(inv.total)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{inv.clientName || 'Sin cliente'}</p>
                    
                    {/* Rows */}
                    <div className="space-y-1">
                      {inv.rows.map((row) => (
                        <div 
                          key={row.lineNumber}
                          className={`text-xs p-2 rounded ${row.isValid ? 'bg-muted/50' : 'bg-destructive/10 text-destructive'}`}
                        >
                          <div className="flex justify-between">
                            <span>
                              <span className="text-muted-foreground">L{row.lineNumber}:</span> {row.producto}
                            </span>
                            {row.isValid && (
                              <span>{row.cantidad} × {row.precioUnitario}</span>
                            )}
                          </div>
                          {!row.isValid && (
                            <div className="flex items-start gap-1 mt-1">
                              <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                              <span>{row.errors.join(' · ')}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { setOpen(false); resetImport(); }}>
            Cancelar
          </Button>
          <Button 
            onClick={handleImport} 
            disabled={importing || !groupedInvoices || validInvoicesCount === 0}
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
                Importar {validInvoicesCount} factura{validInvoicesCount !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
