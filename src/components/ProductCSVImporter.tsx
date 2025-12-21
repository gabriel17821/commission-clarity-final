import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Upload, Download, FileSpreadsheet, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ProductCSVImporterProps {
  onBulkImport: (products: { name: string; percentage: number }[]) => Promise<void>;
  existingProducts: string[];
}

interface ParsedProduct {
  name: string;
  percentage: number;
  isNew: boolean;
  lineNumber: number;
  error?: string;
}

export const ProductCSVImporter = ({ onBulkImport, existingProducts }: ProductCSVImporterProps) => {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<ParsedProduct[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const template = `PRODUCTO
Producto A
Producto B
Producto C
Medicamento XYZ
Suplemento ABC`;

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'template_productos.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('Template descargado');
  };

  const parseCSV = (text: string): ParsedProduct[] | null => {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
    
    if (lines.length < 2) {
      toast.error('El archivo debe tener al menos un producto');
      return null;
    }

    const existingLower = existingProducts.map(p => p.toLowerCase().trim());
    const parsed: ParsedProduct[] = [];
    const seenNames = new Set<string>();

    // Skip header row (first line)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Take first column only (in case there are commas)
      const name = line.split(',')[0].trim();
      if (!name) continue;

      const nameLower = name.toLowerCase();

      // Check for duplicates in this import
      if (seenNames.has(nameLower)) {
        parsed.push({
          name,
          percentage: 25,
          isNew: false,
          lineNumber: i + 1,
          error: 'Duplicado en el archivo'
        });
        continue;
      }

      seenNames.add(nameLower);

      // Check if already exists in database
      const isNew = !existingLower.includes(nameLower);

      parsed.push({
        name,
        percentage: 25,
        isNew,
        lineNumber: i + 1
      });
    }

    if (parsed.length === 0) {
      toast.error('No se encontraron productos válidos');
      return null;
    }

    return parsed;
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
    if (!preview) return;

    const newProducts = preview.filter(p => p.isNew && !p.error);
    
    if (newProducts.length === 0) {
      toast.error('No hay productos nuevos para importar');
      return;
    }

    setImporting(true);
    try {
      await onBulkImport(newProducts.map(p => ({ name: p.name, percentage: p.percentage })));
      toast.success(`${newProducts.length} productos importados con 25% de comisión`);
      setOpen(false);
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      toast.error('Error al importar productos');
      console.error(error);
    } finally {
      setImporting(false);
    }
  };

  const resetImport = () => {
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const newCount = preview?.filter(p => p.isNew && !p.error).length || 0;
  const existingCount = preview?.filter(p => !p.isNew).length || 0;
  const errorCount = preview?.filter(p => p.error).length || 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetImport(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="h-4 w-4" />
          Importar Productos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Productos desde CSV
          </DialogTitle>
          <DialogDescription>
            Importa una lista de productos. Todos tendrán 25% de comisión por defecto.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-y-auto">
          {/* Template download */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-dashed">
            <div>
              <p className="text-sm font-medium">Template CSV</p>
              <p className="text-xs text-muted-foreground">Una columna: PRODUCTO</p>
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
              <Download className="h-4 w-4" />
              Descargar
            </Button>
          </div>

          {/* File input */}
          <div className="space-y-2">
            <label 
              htmlFor="products-csv-file" 
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
                    <span className="font-semibold">Haz clic para subir</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Archivo CSV</p>
                </div>
              )}
              <input 
                id="products-csv-file" 
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
                <p className="text-sm font-semibold text-primary">
                  {newCount} producto{newCount !== 1 ? 's' : ''} nuevo{newCount !== 1 ? 's' : ''} para importar
                </p>
                {existingCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {existingCount} ya existe{existingCount !== 1 ? 'n' : ''} (se ignorarán)
                  </p>
                )}
                {errorCount > 0 && (
                  <p className="text-xs text-destructive">
                    {errorCount} con errores
                  </p>
                )}
              </div>

              {/* Product list */}
              <div className="max-h-60 overflow-y-auto space-y-1 border rounded-lg p-2">
                {preview.map((product, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-2 rounded text-sm ${
                      product.error 
                        ? 'bg-destructive/10 text-destructive' 
                        : product.isNew 
                          ? 'bg-success/10' 
                          : 'bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {product.error ? (
                        <AlertCircle className="h-4 w-4" />
                      ) : product.isNew ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        <span className="text-xs">(existe)</span>
                      )}
                      <span>{product.name}</span>
                    </div>
                    {product.isNew && !product.error && (
                      <span className="text-xs font-medium">25%</span>
                    )}
                    {product.error && (
                      <span className="text-xs">{product.error}</span>
                    )}
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
            disabled={importing || !preview || newCount === 0}
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
                Importar {newCount} producto{newCount !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
