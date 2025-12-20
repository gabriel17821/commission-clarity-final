import { useMemo } from 'react';
import { Invoice, InvoiceProduct } from '@/hooks/useInvoices';
import { Client } from '@/hooks/useClients';
import { Product } from '@/hooks/useProducts';
import { Seller } from '@/hooks/useSellers';
import { parseISO, format, subMonths, startOfMonth, endOfMonth, isWithinInterval, isSameMonth } from 'date-fns';

export interface MonthlyData {
  month: string;
  monthLabel: string;
  sales: number;
  commission: number;
  invoiceCount: number;
}

export interface ClientMetrics {
  id: string;
  name: string;
  totalSales: number;
  totalCommission: number;
  invoiceCount: number;
  products: Set<string>;
  productCount: number;
  trend: number;
  currentMonthSales: number;
  previousMonthSales: number;
}

export interface ProductMetrics {
  name: string;
  totalSales: number;
  totalCommission: number;
  invoiceCount: number;
  clients: Set<string>;
  clientCount: number;
  trend: number;
  avgPerInvoice: number;
}

export interface SellerMetrics {
  id: string;
  name: string;
  totalSales: number;
  totalCommission: number;
  invoiceCount: number;
  clientCount: number;
  currentMonthSales: number;
  previousMonthSales: number;
  growth: number;
  avgPerInvoice: number;
}

export interface RealAnalyticsResult {
  // General KPIs
  totalSales: number;
  totalCommission: number;
  invoiceCount: number;
  avgTicket: number;
  
  // Growth metrics
  currentMonthSales: number;
  previousMonthSales: number;
  monthlyGrowth: number;
  currentMonthCommission: number;
  previousMonthCommission: number;
  commissionGrowth: number;
  
  // Time series
  monthlyData: MonthlyData[];
  last12Months: MonthlyData[];
  
  // By entity
  clientMetrics: ClientMetrics[];
  productMetrics: ProductMetrics[];
  sellerMetrics: SellerMetrics[];
  
  // Active seller specific
  activeSellerMetrics: SellerMetrics | null;
  
  // Alerts
  decliningClients: ClientMetrics[];
  growingClients: ClientMetrics[];
  decliningProducts: ProductMetrics[];
  growingProducts: ProductMetrics[];
}

export function useRealAnalytics(
  invoices: Invoice[],
  clients: Client[],
  products: Product[],
  sellers: Seller[],
  activeSellerId?: string | null
): RealAnalyticsResult {
  return useMemo(() => {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const previousMonthStart = startOfMonth(subMonths(now, 1));
    const previousMonthEnd = endOfMonth(subMonths(now, 1));
    
    // Filter invoices by active seller if applicable
    const filteredInvoices = activeSellerId 
      ? invoices.filter(inv => inv.seller_id === activeSellerId)
      : invoices;
    
    // Basic totals
    const totalSales = filteredInvoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);
    const totalCommission = filteredInvoices.reduce((sum, inv) => sum + Number(inv.total_commission), 0);
    const invoiceCount = filteredInvoices.length;
    const avgTicket = invoiceCount > 0 ? totalSales / invoiceCount : 0;
    
    // Current vs previous month
    const currentMonthInvoices = filteredInvoices.filter(inv => {
      const date = parseISO(inv.invoice_date);
      return isWithinInterval(date, { start: currentMonthStart, end: currentMonthEnd });
    });
    
    const previousMonthInvoices = filteredInvoices.filter(inv => {
      const date = parseISO(inv.invoice_date);
      return isWithinInterval(date, { start: previousMonthStart, end: previousMonthEnd });
    });
    
    const currentMonthSales = currentMonthInvoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);
    const previousMonthSales = previousMonthInvoices.reduce((sum, inv) => sum + Number(inv.total_amount), 0);
    const monthlyGrowth = previousMonthSales > 0 
      ? ((currentMonthSales - previousMonthSales) / previousMonthSales) * 100 
      : (currentMonthSales > 0 ? 100 : 0);
    
    const currentMonthCommission = currentMonthInvoices.reduce((sum, inv) => sum + Number(inv.total_commission), 0);
    const previousMonthCommission = previousMonthInvoices.reduce((sum, inv) => sum + Number(inv.total_commission), 0);
    const commissionGrowth = previousMonthCommission > 0 
      ? ((currentMonthCommission - previousMonthCommission) / previousMonthCommission) * 100 
      : (currentMonthCommission > 0 ? 100 : 0);
    
    // Generate last 12 months data
    const monthsMap = new Map<string, MonthlyData>();
    
    for (let i = 11; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthKey = format(monthDate, 'yyyy-MM');
      const monthLabel = format(monthDate, 'MMM yy');
      monthsMap.set(monthKey, {
        month: monthKey,
        monthLabel,
        sales: 0,
        commission: 0,
        invoiceCount: 0
      });
    }
    
    filteredInvoices.forEach(inv => {
      const monthKey = format(parseISO(inv.invoice_date), 'yyyy-MM');
      const existing = monthsMap.get(monthKey);
      if (existing) {
        existing.sales += Number(inv.total_amount);
        existing.commission += Number(inv.total_commission);
        existing.invoiceCount += 1;
      }
    });
    
    const last12Months = Array.from(monthsMap.values());
    
    // Client metrics
    const clientMap = new Map<string, ClientMetrics>();
    
    filteredInvoices.forEach(inv => {
      if (!inv.client_id) return;
      const client = clients.find(c => c.id === inv.client_id);
      if (!client) return;
      
      const existing = clientMap.get(inv.client_id) || {
        id: inv.client_id,
        name: client.name,
        totalSales: 0,
        totalCommission: 0,
        invoiceCount: 0,
        products: new Set<string>(),
        productCount: 0,
        trend: 0,
        currentMonthSales: 0,
        previousMonthSales: 0
      };
      
      existing.totalSales += Number(inv.total_amount);
      existing.totalCommission += Number(inv.total_commission);
      existing.invoiceCount += 1;
      
      const invDate = parseISO(inv.invoice_date);
      if (isWithinInterval(invDate, { start: currentMonthStart, end: currentMonthEnd })) {
        existing.currentMonthSales += Number(inv.total_amount);
      } else if (isWithinInterval(invDate, { start: previousMonthStart, end: previousMonthEnd })) {
        existing.previousMonthSales += Number(inv.total_amount);
      }
      
      // Track products from invoice
      inv.products?.forEach(p => {
        if (p.amount > 0) existing.products.add(p.product_name);
      });
      
      clientMap.set(inv.client_id, existing);
    });
    
    const clientMetrics = Array.from(clientMap.values()).map(c => ({
      ...c,
      productCount: c.products.size,
      trend: c.previousMonthSales > 0 
        ? ((c.currentMonthSales - c.previousMonthSales) / c.previousMonthSales) * 100
        : (c.currentMonthSales > 0 ? 100 : 0)
    })).sort((a, b) => b.totalSales - a.totalSales);
    
    // Product metrics (from invoice_products)
    const productMap = new Map<string, ProductMetrics>();
    
    filteredInvoices.forEach(inv => {
      const invDate = parseISO(inv.invoice_date);
      const isCurrentMonth = isWithinInterval(invDate, { start: currentMonthStart, end: currentMonthEnd });
      const isPreviousMonth = isWithinInterval(invDate, { start: previousMonthStart, end: previousMonthEnd });
      
      inv.products?.forEach(p => {
        if (p.amount <= 0) return;
        
        const existing = productMap.get(p.product_name) || {
          name: p.product_name,
          totalSales: 0,
          totalCommission: 0,
          invoiceCount: 0,
          clients: new Set<string>(),
          clientCount: 0,
          trend: 0,
          avgPerInvoice: 0,
          currentMonthSales: 0,
          previousMonthSales: 0
        };
        
        existing.totalSales += Number(p.amount);
        existing.totalCommission += Number(p.commission);
        existing.invoiceCount += 1;
        if (inv.client_id) existing.clients.add(inv.client_id);
        
        if (isCurrentMonth) {
          (existing as any).currentMonthSales = ((existing as any).currentMonthSales || 0) + Number(p.amount);
        } else if (isPreviousMonth) {
          (existing as any).previousMonthSales = ((existing as any).previousMonthSales || 0) + Number(p.amount);
        }
        
        productMap.set(p.product_name, existing);
      });
      
      // Also add "Resto" if rest_amount > 0
      if (inv.rest_amount > 0) {
        const restName = 'Resto General';
        const existing = productMap.get(restName) || {
          name: restName,
          totalSales: 0,
          totalCommission: 0,
          invoiceCount: 0,
          clients: new Set<string>(),
          clientCount: 0,
          trend: 0,
          avgPerInvoice: 0,
          currentMonthSales: 0,
          previousMonthSales: 0
        };
        
        existing.totalSales += Number(inv.rest_amount);
        existing.totalCommission += Number(inv.rest_commission);
        existing.invoiceCount += 1;
        if (inv.client_id) existing.clients.add(inv.client_id);
        
        if (isCurrentMonth) {
          (existing as any).currentMonthSales = ((existing as any).currentMonthSales || 0) + Number(inv.rest_amount);
        } else if (isPreviousMonth) {
          (existing as any).previousMonthSales = ((existing as any).previousMonthSales || 0) + Number(inv.rest_amount);
        }
        
        productMap.set(restName, existing);
      }
    });
    
    const productMetrics = Array.from(productMap.values()).map(p => {
      const prev = (p as any).previousMonthSales || 0;
      const curr = (p as any).currentMonthSales || 0;
      return {
        ...p,
        clientCount: p.clients.size,
        avgPerInvoice: p.invoiceCount > 0 ? p.totalSales / p.invoiceCount : 0,
        trend: prev > 0 ? ((curr - prev) / prev) * 100 : (curr > 0 ? 100 : 0)
      };
    }).sort((a, b) => b.totalSales - a.totalSales);
    
    // Seller metrics
    const sellerMap = new Map<string, SellerMetrics>();
    
    invoices.forEach(inv => {
      if (!inv.seller_id) return;
      const seller = sellers.find(s => s.id === inv.seller_id);
      if (!seller) return;
      
      const existing = sellerMap.get(inv.seller_id) || {
        id: inv.seller_id,
        name: seller.name,
        totalSales: 0,
        totalCommission: 0,
        invoiceCount: 0,
        clientCount: 0,
        currentMonthSales: 0,
        previousMonthSales: 0,
        growth: 0,
        avgPerInvoice: 0,
        clients: new Set<string>()
      };
      
      existing.totalSales += Number(inv.total_amount);
      existing.totalCommission += Number(inv.total_commission);
      existing.invoiceCount += 1;
      
      if (inv.client_id) (existing as any).clients.add(inv.client_id);
      
      const invDate = parseISO(inv.invoice_date);
      if (isWithinInterval(invDate, { start: currentMonthStart, end: currentMonthEnd })) {
        existing.currentMonthSales += Number(inv.total_amount);
      } else if (isWithinInterval(invDate, { start: previousMonthStart, end: previousMonthEnd })) {
        existing.previousMonthSales += Number(inv.total_amount);
      }
      
      sellerMap.set(inv.seller_id, existing);
    });
    
    const sellerMetrics = Array.from(sellerMap.values()).map(s => ({
      ...s,
      clientCount: (s as any).clients?.size || 0,
      avgPerInvoice: s.invoiceCount > 0 ? s.totalSales / s.invoiceCount : 0,
      growth: s.previousMonthSales > 0 
        ? ((s.currentMonthSales - s.previousMonthSales) / s.previousMonthSales) * 100
        : (s.currentMonthSales > 0 ? 100 : 0)
    })).sort((a, b) => b.totalSales - a.totalSales);
    
    // Active seller metrics
    const activeSellerMetrics = activeSellerId 
      ? sellerMetrics.find(s => s.id === activeSellerId) || null
      : null;
    
    // Alerts
    const decliningClients = clientMetrics.filter(c => c.trend < -10).slice(0, 5);
    const growingClients = clientMetrics.filter(c => c.trend > 10).slice(0, 5);
    const decliningProducts = productMetrics.filter(p => p.trend < -10).slice(0, 5);
    const growingProducts = productMetrics.filter(p => p.trend > 10).slice(0, 5);
    
    return {
      totalSales,
      totalCommission,
      invoiceCount,
      avgTicket,
      currentMonthSales,
      previousMonthSales,
      monthlyGrowth,
      currentMonthCommission,
      previousMonthCommission,
      commissionGrowth,
      monthlyData: last12Months,
      last12Months,
      clientMetrics,
      productMetrics,
      sellerMetrics,
      activeSellerMetrics,
      decliningClients,
      growingClients,
      decliningProducts,
      growingProducts
    };
  }, [invoices, clients, products, sellers, activeSellerId]);
}
