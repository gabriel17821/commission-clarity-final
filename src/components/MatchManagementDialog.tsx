import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit2, Save, X, Link2, Package, Users, Loader2, RefreshCw, Search, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  fetchAllMatches,
  deleteMatch,
  updateMatch,
  ManualMatch,
} from '@/lib/matchingStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface MatchManagementDialogProps {
  products: { id: string; name: string; percentage: number }[];
  clients: { id: string; name: string }[];
  onRefresh?: () => void;
  trigger?: React.ReactNode;
}

export const MatchManagementDialog = ({ products, clients, onRefresh, trigger }: MatchManagementDialogProps) => {
  const [open, setOpen] = useState(false);
  const [matches, setMatches] = useState<ManualMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loadMatches = async () => {
    setLoading(true);
    const data = await fetchAllMatches();
    setMatches(data);
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      loadMatches();
    }
  }, [open]);

  const handleDelete = async (match: ManualMatch) => {
    setDeleting(match.id);
    const success = await deleteMatch(match.id);
    if (success) {
      setMatches((prev) => prev.filter((m) => m.id !== match.id));
      toast.success(`Match eliminado: ${match.csvName}`);
      onRefresh?.();
    } else {
      toast.error('Error al eliminar el match');
    }
    setDeleting(null);
  };

  const handleEdit = (match: ManualMatch) => {
    setEditingId(match.id);
    setEditValue(match.matchedId);
  };

  const handleSaveEdit = async (match: ManualMatch) => {
    const items = match.matchType === 'product' ? products : clients;
    const item = items.find((i) => i.id === editValue);
    
    if (!item) {
      toast.error('Selecciona un elemento válido');
      return;
    }

    const success = await updateMatch(match.id, {
      matchedId: item.id,
      matchedName: item.name,
    });

    if (success) {
      setMatches((prev) =>
        prev.map((m) =>
          m.id === match.id
            ? { ...m, matchedId: item.id, matchedName: item.name }
            : m
        )
      );
      toast.success('Match actualizado');
      setEditingId(null);
      onRefresh?.();
    } else {
      toast.error('Error al actualizar');
    }
  };

  const productMatches = matches.filter((m) => 
    m.matchType === 'product' && 
    (searchTerm === '' || m.csvName.toLowerCase().includes(searchTerm.toLowerCase()) || m.matchedName.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  const clientMatches = matches.filter((m) => 
    m.matchType === 'client' && 
    (searchTerm === '' || m.csvName.toLowerCase().includes(searchTerm.toLowerCase()) || m.matchedName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const productOptions = products.map(p => ({
    value: p.id,
    label: p.name,
    sublabel: `${p.percentage}%`
  }));

  const clientOptions = clients.map(c => ({
    value: c.id,
    label: c.name
  }));

  const renderMatchTable = (matchList: ManualMatch[], type: 'product' | 'client') => {
    const options = type === 'product' ? productOptions : clientOptions;
    
    return (
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Nombre en CSV</TableHead>
              <TableHead className="w-[40%]">{type === 'product' ? 'Producto' : 'Cliente'} Asignado</TableHead>
              <TableHead className="w-[20%] text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {matchList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                  {searchTerm ? 'No se encontraron matches' : 'No hay matches guardados'}
                </TableCell>
              </TableRow>
            ) : (
              matchList.map((match) => (
                <TableRow key={match.id}>
                  <TableCell className="font-mono text-sm">{match.csvName}</TableCell>
                  <TableCell>
                    {editingId === match.id ? (
                      <SearchableSelect
                        options={options}
                        value={editValue}
                        onValueChange={setEditValue}
                        placeholder="Buscar..."
                        searchPlaceholder="Escribir para buscar..."
                        className="w-full"
                      />
                    ) : (
                      <Badge variant={type === 'product' ? 'secondary' : 'outline'}>
                        {match.matchedName}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {editingId === match.id ? (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleSaveEdit(match)}
                        >
                          <Save className="h-4 w-4 text-primary" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(match)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleDelete(match)}
                          disabled={deleting === match.id}
                        >
                          {deleting === match.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="h-4 w-4" />
            Gestionar Matches
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Gestión de Matches CSV
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3 py-3 border-b">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar matches..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" size="sm" onClick={loadMatches} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="products" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="products" className="gap-2">
                <Package className="h-4 w-4" />
                Productos ({productMatches.length})
              </TabsTrigger>
              <TabsTrigger value="clients" className="gap-2">
                <Users className="h-4 w-4" />
                Clientes ({clientMatches.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="products" className="flex-1 overflow-auto mt-4">
              {renderMatchTable(productMatches, 'product')}
            </TabsContent>
            
            <TabsContent value="clients" className="flex-1 overflow-auto mt-4">
              {renderMatchTable(clientMatches, 'client')}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};
