import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit2, Save, X, Link2, Package, Users, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchAllMatches,
  deleteMatch,
  updateMatch,
  ManualMatch,
} from '@/lib/matchingStore';

interface MatchManagementProps {
  products: { id: string; name: string; percentage: number }[];
  clients: { id: string; name: string }[];
  onRefresh?: () => void;
}

export const MatchManagement = ({ products, clients, onRefresh }: MatchManagementProps) => {
  const [matches, setMatches] = useState<ManualMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadMatches = async () => {
    setLoading(true);
    const data = await fetchAllMatches();
    setMatches(data);
    setLoading(false);
  };

  useEffect(() => {
    loadMatches();
  }, []);

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

  const productMatches = matches.filter((m) => m.matchType === 'product');
  const clientMatches = matches.filter((m) => m.matchType === 'client');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Matches CSV Guardados</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={loadMatches} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {matches.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No hay matches guardados. Se crearán automáticamente al importar CSV.
        </p>
      ) : (
        <>
          {/* Product Matches */}
          {productMatches.length > 0 && (
            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <span className="font-medium">Productos ({productMatches.length})</span>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre CSV</TableHead>
                      <TableHead>Producto Asignado</TableHead>
                      <TableHead className="w-24 text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productMatches.map((match) => (
                      <TableRow key={match.id}>
                        <TableCell className="font-mono text-sm">{match.csvName}</TableCell>
                        <TableCell>
                          {editingId === match.id ? (
                            <Select value={editValue} onValueChange={setEditValue}>
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {products.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name} ({p.percentage}%)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="secondary">{match.matchedName}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {editingId === match.id ? (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleSaveEdit(match)}
                              >
                                <Save className="h-3.5 w-3.5 text-primary" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setEditingId(null)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleEdit(match)}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => handleDelete(match)}
                                disabled={deleting === match.id}
                              >
                                {deleting === match.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          {/* Client Matches */}
          {clientMatches.length > 0 && (
            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="font-medium">Clientes ({clientMatches.length})</span>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre CSV</TableHead>
                      <TableHead>Cliente Asignado</TableHead>
                      <TableHead className="w-24 text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientMatches.map((match) => (
                      <TableRow key={match.id}>
                        <TableCell className="font-mono text-sm">{match.csvName}</TableCell>
                        <TableCell>
                          {editingId === match.id ? (
                            <Select value={editValue} onValueChange={setEditValue}>
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {clients.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline">{match.matchedName}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {editingId === match.id ? (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleSaveEdit(match)}
                              >
                                <Save className="h-3.5 w-3.5 text-primary" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setEditingId(null)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleEdit(match)}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => handleDelete(match)}
                                disabled={deleting === match.id}
                              >
                                {deleting === match.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
};
