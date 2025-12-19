import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AnalyticsData {
  id: string;
  invoice_id: string | null;
  client_id: string | null;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  commission_percentage: number;
  commission_amount: number;
  sale_date: string;
  created_at: string;
}

export interface AnalyticsInsert {
  invoice_id?: string | null;
  client_id?: string | null;
  product_id?: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  commission_percentage: number;
  commission_amount: number;
  sale_date: string;
}

export function useAnalytics() {
  const [data, setData] = useState<AnalyticsData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const { data: analyticsData, error } = await supabase
      .from('analytics_data')
      .select('*')
      .order('sale_date', { ascending: false });

    if (error) {
      console.error('Error fetching analytics data:', error);
    } else {
      setData(analyticsData || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const addAnalyticsData = async (items: AnalyticsInsert[]): Promise<boolean> => {
    const { error } = await supabase.from('analytics_data').insert(items);
    if (error) {
      console.error('Error adding analytics data:', error);
      return false;
    }
    await fetchData();
    return true;
  };

  const deleteAnalyticsData = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('analytics_data').delete().eq('id', id);
    if (error) {
      console.error('Error deleting analytics data:', error);
      return false;
    }
    await fetchData();
    return true;
  };

  const bulkImport = async (items: AnalyticsInsert[]): Promise<{ success: number; failed: number }> => {
    let success = 0;
    let failed = 0;

    // Process in batches of 100
    for (let i = 0; i < items.length; i += 100) {
      const batch = items.slice(i, i + 100);
      const { error } = await supabase.from('analytics_data').insert(batch);
      if (error) {
        console.error('Batch import error:', error);
        failed += batch.length;
      } else {
        success += batch.length;
      }
    }

    await fetchData();
    return { success, failed };
  };

  return {
    data,
    loading,
    addAnalyticsData,
    deleteAnalyticsData,
    bulkImport,
    refetch: fetchData,
  };
}
