import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pencil, AlertTriangle } from 'lucide-react';

interface EditGlobalPercentageDialogProps {
  productName: string;
  currentPercentage: number;
  invoiceCount: number;
  month: string;
  onUpdate: (newPercentage: number) => Promise<boolean>;
}

export const EditGlobalPercentageDialog = ({
  productName,
  currentPercentage,
  invoiceCount,
  month,
  onUpdate,
}: EditGlobalPercentageDialogProps) => {
  const [open, setOpen] = useState(false);
  const [percentage, setPercentage] = useState(currentPercentage.toString());
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newPercentage = parseFloat(percentage);
    if (isNaN(newPercentage) || newPercentage < 0 || newPercentage > 100) return;
    
    setLoading(true);
    const success = await onUpdate(newPercentage);
    setLoading(false);
    
    if (success) {
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          title="Editar porcentaje global"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5 text-primary" />
            Editar Porcentaje Global
          </DialogTitle>
          <DialogDescription>
            Cambiar el porcentaje de <strong>{productName}</strong> en todas las facturas de {month}.
          </DialogDescription>
        </DialogHeader>
        
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-600">Esto afectará {invoiceCount} factura{invoiceCount !== 1 ? 's' : ''}</p>
            <p className="text-amber-600/80 mt-1">
              Las comisiones de todas las facturas con este producto serán recalculadas.
            </p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="global-percentage">Nuevo Porcentaje (%)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="global-percentage"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
                className="flex-1"
                autoFocus
              />
              <span className="text-muted-foreground font-medium">%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Porcentaje actual: <span className="font-medium">{currentPercentage}%</span>
            </p>
          </div>
          
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading || !percentage}
              className="gap-2"
            >
              {loading ? 'Actualizando...' : 'Actualizar Todo'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
