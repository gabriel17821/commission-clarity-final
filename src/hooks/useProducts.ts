import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Product {
  id: string;
  name: string;
  percentage: number;
  color: string;
  is_default: boolean;
}

const COLORS = ['#10b981', '#f59e0b', '#6366f1', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#06b6d4'];

export const useProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (error) {
      toast.error('Error al cargar productos');
      console.error(error);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const addProduct = async (name: string, percentage: number) => {
    const color = COLORS[products.length % COLORS.length];
    const { data, error } = await supabase
      .from('products')
      .insert({ name, percentage, color, is_default: false })
      .select()
      .single();
    
    if (error) {
      toast.error('Error al agregar producto');
      console.error(error);
      return null;
    }
    
    setProducts([...products, data]);
    toast.success('Producto agregado');
    return data;
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    const { error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id);
    
    if (error) {
      toast.error('Error al actualizar producto');
      console.error(error);
      return false;
    }
    
    setProducts(products.map(p => p.id === id ? { ...p, ...updates } : p));
    toast.success('Producto actualizado');
    return true;
  };

  const deleteProduct = async (id: string) => {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    
    if (error) {
      toast.error('Error al eliminar producto');
      console.error(error);
      return false;
    }
    
    setProducts(products.filter(p => p.id !== id));
    toast.success('Producto eliminado');
    return true;
  };

  const bulkAddProducts = async (productsToAdd: { name: string; percentage: number }[]) => {
    const COLORS = ['#10b981', '#f59e0b', '#6366f1', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#06b6d4'];
    
    const records = productsToAdd.map((p, idx) => ({
      name: p.name,
      percentage: p.percentage,
      color: COLORS[(products.length + idx) % COLORS.length],
      is_default: false
    }));

    const { data, error } = await supabase
      .from('products')
      .insert(records)
      .select();
    
    if (error) {
      toast.error('Error al importar productos');
      console.error(error);
      throw error;
    }
    
    setProducts([...products, ...(data || [])]);
  };

  return { products, loading, addProduct, updateProduct, deleteProduct, bulkAddProducts, refetch: fetchProducts };
};
