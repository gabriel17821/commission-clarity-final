/**
 * Store for persisting manual product/client matches
 * Uses Supabase for permanent global storage
 */

import { supabase } from '@/integrations/supabase/client';

export interface ManualMatch {
  id: string;
  csvName: string;      // Name from CSV (normalized)
  matchedId: string;    // ID of matched product/client
  matchedName: string;  // Name of matched product/client
  matchType: 'product' | 'client';
}

function normalizeForStorage(name: string): string {
  return (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Fetch all matches from DB
export async function fetchAllMatches(): Promise<ManualMatch[]> {
  const { data, error } = await supabase
    .from('csv_matches')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching matches:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    csvName: row.csv_name,
    matchedId: row.matched_id,
    matchedName: row.matched_name,
    matchType: row.match_type,
  }));
}

// Fetch product matches
export async function getProductMatches(): Promise<ManualMatch[]> {
  const { data, error } = await supabase
    .from('csv_matches')
    .select('*')
    .eq('match_type', 'product');

  if (error) {
    console.error('Error fetching product matches:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    csvName: row.csv_name,
    matchedId: row.matched_id,
    matchedName: row.matched_name,
    matchType: 'product' as const,
  }));
}

// Fetch client matches
export async function getClientMatches(): Promise<ManualMatch[]> {
  const { data, error } = await supabase
    .from('csv_matches')
    .select('*')
    .eq('match_type', 'client');

  if (error) {
    console.error('Error fetching client matches:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    csvName: row.csv_name,
    matchedId: row.matched_id,
    matchedName: row.matched_name,
    matchType: 'client' as const,
  }));
}

// Save product match
export async function saveProductMatch(csvName: string, productId: string, productName: string): Promise<boolean> {
  const key = normalizeForStorage(csvName);
  
  const { error } = await supabase
    .from('csv_matches')
    .upsert({
      match_type: 'product',
      csv_name: key,
      matched_id: productId,
      matched_name: productName,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'match_type,csv_name',
    });

  if (error) {
    console.error('Error saving product match:', error);
    return false;
  }
  return true;
}

// Save client match
export async function saveClientMatch(csvName: string, clientId: string, clientName: string): Promise<boolean> {
  const key = normalizeForStorage(csvName);
  
  const { error } = await supabase
    .from('csv_matches')
    .upsert({
      match_type: 'client',
      csv_name: key,
      matched_id: clientId,
      matched_name: clientName,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'match_type,csv_name',
    });

  if (error) {
    console.error('Error saving client match:', error);
    return false;
  }
  return true;
}

// Find saved product match
export async function findSavedProductMatch(csvName: string): Promise<ManualMatch | undefined> {
  const key = normalizeForStorage(csvName);
  
  const { data, error } = await supabase
    .from('csv_matches')
    .select('*')
    .eq('match_type', 'product')
    .eq('csv_name', key)
    .maybeSingle();

  if (error || !data) {
    return undefined;
  }

  return {
    id: data.id,
    csvName: data.csv_name,
    matchedId: data.matched_id,
    matchedName: data.matched_name,
    matchType: 'product',
  };
}

// Find saved client match
export async function findSavedClientMatch(csvName: string): Promise<ManualMatch | undefined> {
  const key = normalizeForStorage(csvName);
  
  const { data, error } = await supabase
    .from('csv_matches')
    .select('*')
    .eq('match_type', 'client')
    .eq('csv_name', key)
    .maybeSingle();

  if (error || !data) {
    return undefined;
  }

  return {
    id: data.id,
    csvName: data.csv_name,
    matchedId: data.matched_id,
    matchedName: data.matched_name,
    matchType: 'client',
  };
}

// Delete a match
export async function deleteMatch(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('csv_matches')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting match:', error);
    return false;
  }
  return true;
}

// Update a match
export async function updateMatch(id: string, updates: { matchedId: string; matchedName: string }): Promise<boolean> {
  const { error } = await supabase
    .from('csv_matches')
    .update({
      matched_id: updates.matchedId,
      matched_name: updates.matchedName,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating match:', error);
    return false;
  }
  return true;
}

// Clear all matches (optional)
export async function clearAllMatches(): Promise<boolean> {
  const { error } = await supabase
    .from('csv_matches')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (error) {
    console.error('Error clearing matches:', error);
    return false;
  }
  return true;
}
