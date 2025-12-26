import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Client {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  province?: string | null;
  created_at: string;
}

export const useClients = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast.error('Error al cargar los clientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const addClient = async (name: string, phone?: string, email?: string, address?: string, notes?: string): Promise<Client | null> => {
    try {
      // Always save names in UPPERCASE for consistent matching
      const normalizedName = name.toUpperCase().trim();
      
      const { data, error } = await supabase
        .from('clients')
        .insert([{ name: normalizedName, phone, email, address, notes }])
        .select()
        .single();

      if (error) throw error;

      setClients(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      toast.success(`Cliente "${name}" agregado`);
      return data;
    } catch (error) {
      console.error('Error adding client:', error);
      toast.error('Error al agregar el cliente');
      return null;
    }
  };

  const updateClient = async (id: string, updates: Partial<Client>): Promise<boolean> => {
    try {
      // Normalize name to UPPERCASE if provided
      const normalizedUpdates = {
        ...updates,
        ...(updates.name && { name: updates.name.toUpperCase().trim() }),
      };
      
      const { error } = await supabase
        .from('clients')
        .update(normalizedUpdates)
        .eq('id', id);

      if (error) throw error;

      setClients(prev =>
        prev.map(c => (c.id === id ? { ...c, ...updates } : c))
      );
      toast.success('Cliente actualizado');
      return true;
    } catch (error) {
      console.error('Error updating client:', error);
      toast.error('Error al actualizar el cliente');
      return false;
    }
  };

  const deleteClient = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('clients').delete().eq('id', id);

      if (error) throw error;

      setClients(prev => prev.filter(c => c.id !== id));
      toast.success('Cliente eliminado');
      return true;
    } catch (error) {
      console.error('Error deleting client:', error);
      toast.error('Error al eliminar el cliente');
      return false;
    }
  };

  return {
    clients,
    loading,
    addClient,
    updateClient,
    deleteClient,
    refetch: fetchClients,
  };
};
