import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Users, Search, User, Phone, Mail, MapPin, Trash2, Edit2, Check, X, Plus, Building } from 'lucide-react';
import { Client } from '@/hooks/useClients';
import { toast } from 'sonner';

const PROVINCE_OPTIONS = [
  'Azua',
  'Bahoruco',
  'Barahona',
  'Dajabón',
  'Distrito Nacional',
  'Duarte',
  'El Seibo',
  'Elías Piña',
  'Espaillat',
  'Hato Mayor',
  'Hermanas Mirabal',
  'Independencia',
  'La Altagracia',
  'La Romana',
  'La Vega',
  'María Trinidad Sánchez',
  'Monseñor Nouel',
  'Monte Cristi',
  'Monte Plata',
  'Pedernales',
  'Peravia',
  'Puerto Plata',
  'Samaná',
  'San Cristóbal',
  'San José de Ocoa',
  'San Juan',
  'San Pedro de Macorís',
  'Sánchez Ramírez',
  'Santiago',
  'Santiago Rodríguez',
  'Santo Domingo',
  'Valverde',
];

interface ClientCatalogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  onAddClient: (name: string, phone?: string, email?: string, address?: string, notes?: string, province?: string) => Promise<Client | null>;
  onUpdateClient: (id: string, updates: Partial<Client>) => Promise<boolean>;
  onDeleteClient: (id: string) => Promise<boolean>;
}

export function ClientCatalogDialog({
  open,
  onOpenChange,
  clients,
  onAddClient,
  onUpdateClient,
  onDeleteClient,
}: ClientCatalogDialogProps) {
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editProvince, setEditProvince] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newProvince, setNewProvince] = useState('');
  const [loading, setLoading] = useState(false);

  const filteredClients = useMemo(() => {
    return clients.filter(c => 
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.toLowerCase().includes(search.toLowerCase()) ||
      c.province?.toLowerCase().includes(search.toLowerCase())
    );
  }, [clients, search]);

  // Group by province
  const groupedByProvince = useMemo(() => {
    const groups: Record<string, Client[]> = {};
    filteredClients.forEach(client => {
      const province = client.province || 'Sin Provincia';
      if (!groups[province]) groups[province] = [];
      groups[province].push(client);
    });
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === 'Sin Provincia') return 1;
      if (b === 'Sin Provincia') return -1;
      return a.localeCompare(b);
    });
  }, [filteredClients]);

  const handleStartEdit = (client: Client) => {
    setEditingId(client.id);
    setEditName(client.name);
    setEditPhone(client.phone || '');
    setEditEmail(client.email || '');
    setEditAddress(client.address || '');
    setEditProvince(client.province || '');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditPhone('');
    setEditEmail('');
    setEditAddress('');
    setEditProvince('');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setLoading(true);
    const success = await onUpdateClient(editingId, {
      name: editName.trim(),
      phone: editPhone.trim() || null,
      email: editEmail.trim() || null,
      address: editAddress.trim() || null,
      province: editProvince || null,
    });
    setLoading(false);
    if (success) {
      handleCancelEdit();
    }
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setLoading(true);
    const client = await onAddClient(
      newName.trim(),
      newPhone.trim() || undefined,
      newEmail.trim() || undefined,
      newAddress.trim() || undefined,
      undefined,
      newProvince || undefined
    );
    setLoading(false);
    if (client) {
      setNewName('');
      setNewPhone('');
      setNewEmail('');
      setNewAddress('');
      setNewProvince('');
      setShowAddForm(false);
      toast.success('Cliente agregado');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
            Catálogo de Clientes
            <span className="ml-auto text-sm font-normal text-muted-foreground">
              {clients.length} cliente{clients.length !== 1 ? 's' : ''}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente o provincia..."
              className="pl-9"
            />
          </div>
          <Button onClick={() => setShowAddForm(!showAddForm)} variant={showAddForm ? 'secondary' : 'default'} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nuevo
          </Button>
        </div>

        {showAddForm && (
          <form onSubmit={handleAddClient} className="p-4 bg-muted/50 rounded-lg mb-4 space-y-3">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <User className="h-4 w-4" />
              Nuevo Cliente
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nombre *</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nombre del cliente"
                  className="h-9"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Provincia</Label>
                <Select value={newProvince} onValueChange={setNewProvince}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Seleccionar provincia" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVINCE_OPTIONS.map(prov => (
                      <SelectItem key={prov} value={prov}>{prov}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Teléfono</Label>
                <Input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="809-000-0000"
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="cliente@email.com"
                  className="h-9"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Dirección</Label>
                <Input
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="Dirección completa"
                  className="h-9"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={loading || !newName.trim()}>
                {loading ? 'Guardando...' : 'Agregar Cliente'}
              </Button>
            </div>
          </form>
        )}

        <ScrollArea className="flex-1 min-h-0 -mx-6 px-6" style={{ maxHeight: 'calc(85vh - 280px)' }}>
          {groupedByProvince.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No hay clientes</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedByProvince.map(([province, provinceClients]) => (
                <div key={province}>
                  <div className="flex items-center gap-2 mb-2 text-sm font-medium text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {province}
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{provinceClients.length}</span>
                  </div>
                  <div className="space-y-2">
                    {provinceClients.map((client) => (
                      <div
                        key={client.id}
                        className="group p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        {editingId === client.id ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label className="text-xs">Nombre</Label>
                                <Input
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Provincia</Label>
                                <Select value={editProvince || "__none__"} onValueChange={(val) => setEditProvince(val === "__none__" ? "" : val)}>
                                  <SelectTrigger className="h-8 text-sm">
                                    <SelectValue placeholder="Sin provincia" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">Sin provincia</SelectItem>
                                    {PROVINCE_OPTIONS.map(prov => (
                                      <SelectItem key={prov} value={prov}>{prov}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Teléfono</Label>
                                <Input
                                  value={editPhone}
                                  onChange={(e) => setEditPhone(e.target.value)}
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Email</Label>
                                <Input
                                  value={editEmail}
                                  onChange={(e) => setEditEmail(e.target.value)}
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div className="col-span-2 space-y-1">
                                <Label className="text-xs">Dirección</Label>
                                <Input
                                  value={editAddress}
                                  onChange={(e) => setEditAddress(e.target.value)}
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                                <X className="h-3.5 w-3.5 mr-1" />
                                Cancelar
                              </Button>
                              <Button size="sm" onClick={handleSaveEdit} disabled={loading}>
                                <Check className="h-3.5 w-3.5 mr-1" />
                                Guardar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <User className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{client.name}</p>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                {client.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {client.phone}
                                  </span>
                                )}
                                {client.email && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    {client.email}
                                  </span>
                                )}
                                {client.address && (
                                  <span className="flex items-center gap-1">
                                    <Building className="h-3 w-3" />
                                    {client.address}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleStartEdit(client)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta acción eliminará el cliente "{client.name}" permanentemente.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => onDeleteClient(client.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
