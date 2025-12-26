import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings2, Plus, Pencil, Trash2, Save, X, Package, ChevronDown, ChevronRight, Layers, Tag } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Product {
  id: string;
  name: string;
  percentage: number;
  color: string;
  is_default: boolean;
  category?: string | null;
}

interface ProductCatalogDialogProps {
  products: Product[];
  onUpdateProduct: (id: string, updates: Partial<Product>) => Promise<boolean>;
  onDeleteProduct: (id: string) => void;
  onAddProduct: (name: string, percentage: number) => Promise<any>;
  trigger?: React.ReactNode;
}

const DEFAULT_CATEGORIES = [
  'Azetabio',
  'Vitalis',
  'DLS',
];

export const ProductCatalogDialog = ({
  products,
  onUpdateProduct,
  onDeleteProduct,
  onAddProduct,
  trigger,
}: ProductCatalogDialogProps) => {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPercentage, setEditPercentage] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [newName, setNewName] = useState('');
  const [newPercentage, setNewPercentage] = useState('15');
  const [newCategory, setNewCategory] = useState('');
  const [newCustomCategory, setNewCustomCategory] = useState('');
  const [showCustomCategoryInput, setShowCustomCategoryInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('grouped');
  const [showEditCategoryInput, setShowEditCategoryInput] = useState(false);
  const [editCustomCategory, setEditCustomCategory] = useState('');

  // Get all unique categories from products (including custom ones)
  const allCategories = useMemo(() => {
    const productCategories = products
      .map(p => p.category)
      .filter((c): c is string => !!c);
    const uniqueCategories = [...new Set([...DEFAULT_CATEGORIES, ...productCategories])];
    return uniqueCategories.sort();
  }, [products]);

  // Group products by category
  const groupedProducts = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    
    products.forEach(product => {
      const cat = product.category || 'Sin categoría';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(product);
    });
    
    // Sort categories alphabetically, but put "Sin categoría" last
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === 'Sin categoría') return 1;
      if (b === 'Sin categoría') return -1;
      return a.localeCompare(b);
    });
    
    return { groups, sortedKeys };
  }, [products]);

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    setEditName(product.name);
    setEditPercentage(product.percentage.toString());
    setEditCategory(product.category || '');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setLoading(true);
    await onUpdateProduct(editingId, {
      name: editName.trim(),
      percentage: parseFloat(editPercentage) || 0,
      category: editCategory.trim() || null,
    });
    setLoading(false);
    setEditingId(null);
  };

  const handleAddCustomCategory = () => {
    if (newCustomCategory.trim()) {
      setNewCategory(newCustomCategory.trim());
      setNewCustomCategory('');
      setShowCustomCategoryInput(false);
    }
  };

  const handleAddEditCustomCategory = () => {
    if (editCustomCategory.trim()) {
      setEditCategory(editCustomCategory.trim());
      setEditCustomCategory('');
      setShowEditCategoryInput(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setLoading(true);
    const product = await onAddProduct(newName.trim(), parseFloat(newPercentage) || 15);
    if (product && newCategory.trim()) {
      await onUpdateProduct(product.id, { category: newCategory.trim() });
    }
    setLoading(false);
    setNewName('');
    setNewPercentage('15');
    setNewCategory('');
  };

  const handleDelete = (id: string) => {
    if (window.confirm('¿Eliminar este producto?')) {
      onDeleteProduct(id);
    }
  };

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const renderProduct = (product: Product) => (
    <div
      key={product.id}
      className="flex items-center gap-2 p-3 rounded-xl bg-card border border-border/50 hover:border-border transition-colors"
    >
      {editingId === product.id ? (
        <>
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="flex-1 h-9"
            placeholder="Nombre"
            autoFocus
          />
          <div className="relative w-20">
            <Input
              type="number"
              value={editPercentage}
              onChange={(e) => setEditPercentage(e.target.value)}
              className="h-9 pr-6"
              min="0"
              max="100"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
          </div>
          <div className="flex items-center gap-1">
            <select
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
              className="h-9 px-2 rounded-md border border-border bg-background text-sm min-w-[90px]"
            >
              <option value="">Sin categoría</option>
              {allCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <Popover open={showEditCategoryInput} onOpenChange={setShowEditCategoryInput}>
              <PopoverTrigger asChild>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="icon" 
                  className="h-9 w-9 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowEditCategoryInput(true);
                  }}
                  title="Nueva categoría"
                >
                  <Tag className="h-3.5 w-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3" align="end" onClick={(e) => e.stopPropagation()}>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Nueva categoría</Label>
                  <div className="flex gap-2">
                    <Input
                      value={editCustomCategory}
                      onChange={(e) => setEditCustomCategory(e.target.value)}
                      placeholder="Nombre de la categoría"
                      className="flex-1"
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') handleAddEditCustomCategory();
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <Button size="sm" onClick={handleAddEditCustomCategory} disabled={!editCustomCategory.trim()}>
                      Usar
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <Button size="icon" variant="ghost" onClick={handleSaveEdit} disabled={loading} className="h-9 w-9 text-success">
            <Save className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setEditingId(null)} className="h-9 w-9">
            <X className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <>
          <span className="flex-1 font-medium text-foreground">{product.name}</span>
          {product.category && (
            <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground text-xs">
              {product.category}
            </span>
          )}
          <span className="px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-bold">
            {product.percentage}%
          </span>
          <Button size="icon" variant="ghost" onClick={() => handleEdit(product)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => handleDelete(product.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="secondary" size="sm" className="gap-2 bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground border-0">
            <Settings2 className="h-4 w-4" />
            <span className="hidden sm:inline">Catálogo</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Catálogo de Productos
            </DialogTitle>
            <div className="flex gap-1">
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="h-7 px-2"
              >
                Lista
              </Button>
              <Button
                variant={viewMode === 'grouped' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grouped')}
                className="h-7 px-2 gap-1"
              >
                <Layers className="h-3.5 w-3.5" />
                Agrupado
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Add new product form */}
          <form onSubmit={handleAdd} className="p-4 rounded-xl bg-muted/40 border border-border/50 space-y-3">
            <Label className="text-sm font-medium">Agregar nuevo producto</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nombre del producto"
                className="flex-1 min-w-[150px]"
              />
              <div className="relative w-20">
                <Input
                  type="number"
                  value={newPercentage}
                  onChange={(e) => setNewPercentage(e.target.value)}
                  placeholder="15"
                  className="pr-6"
                  min="0"
                  max="100"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
              </div>
              <div className="flex items-center gap-1">
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="h-10 px-2 rounded-md border border-border bg-background text-sm min-w-[100px]"
                >
                  <option value="">Categoría</option>
                  {allCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <Popover open={showCustomCategoryInput} onOpenChange={setShowCustomCategoryInput}>
                  <PopoverTrigger asChild>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon" 
                      className="h-10 w-10 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowCustomCategoryInput(true);
                      }}
                      title="Agregar nueva categoría"
                    >
                      <Tag className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3" align="end" onClick={(e) => e.stopPropagation()}>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Nueva categoría</Label>
                      <div className="flex gap-2">
                        <Input
                          value={newCustomCategory}
                          onChange={(e) => setNewCustomCategory(e.target.value)}
                          placeholder="Nombre de la categoría"
                          className="flex-1"
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddCustomCategory();
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Button type="button" size="sm" onClick={handleAddCustomCategory} disabled={!newCustomCategory.trim()}>
                          Usar
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <Button type="submit" size="icon" disabled={loading || !newName.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </form>

          {/* Products list */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground">
              Productos ({products.length})
            </Label>
            
            {viewMode === 'list' ? (
              <div className="space-y-2">
                {products.map(renderProduct)}
              </div>
            ) : (
              <div className="space-y-2">
                {groupedProducts.sortedKeys.map(category => {
                  const categoryProducts = groupedProducts.groups[category];
                  const isExpanded = expandedCategories[category] !== false; // Default expanded
                  
                  return (
                    <Collapsible key={category} open={isExpanded} onOpenChange={() => toggleCategory(category)}>
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/60 border border-border/50 cursor-pointer hover:bg-muted transition-colors">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="font-semibold text-foreground flex-1">{category}</span>
                          <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded">
                            {categoryProducts.length} productos
                          </span>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pl-4 pt-2 space-y-2">
                        {categoryProducts.map(renderProduct)}
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            )}

            {products.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No hay productos. Agrega uno arriba.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};