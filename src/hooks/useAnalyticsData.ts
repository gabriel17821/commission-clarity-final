import { useMemo } from 'react';
import { parseISO, isWithinInterval, format } from 'date-fns';
import { Invoice } from '@/hooks/useInvoices';
import { Client } from '@/hooks/useClients';
import { Product } from '@/hooks/useProducts';
import { Seller } from '@/hooks/useSellers';
import { normalizeProvinceName } from '@/lib/dominicanProvinces';

export type ProductStatus = 'healthy' | 'watch' | 'danger';

export interface ProductMetrics {
  name: string;
  soldUnits: number;
  giftedUnits: number;
  netRevenue: number;
  giftValue: number;
  marginImpact: number;
  status: ProductStatus;
  trend: number;
  clients: { id: string; name: string; units: number; revenue: number }[];
  dailyData: { date: string; sold: number; gifted: number; revenue: number }[];
}

export interface SellerMetrics {
  id: string;
  name: string;
  netRevenue: number;
  giftedUnits: number;
  soldUnits: number;
  giftPercentage: number;
  correctCommission: number;
  status: ProductStatus;
  productsData: { name: string; sold: number; gifted: number; revenue: number }[];
  clientsServed: { id: string; name: string; revenue: number }[];
}

export interface ClientMetrics {
  id: string;
  name: string;
  province: string | null;
  totalRevenue: number;
  totalUnits: number;
  invoiceCount: number;
  avgTicket: number;
  status: ProductStatus;
  productsData: { name: string; quantity: number; revenue: number }[];
  monthlyData: { month: string; revenue: number; units: number }[];
}

export interface ProvinceMetrics {
  name: string;
  sales: number;
  units: number;
  clientCount: number;
  topProducts: { name: string; revenue: number }[];
  topClients: { id: string; name: string; revenue: number }[];
  giftPercentage: number;
}

export interface AnalyticsResult {
  productMetrics: ProductMetrics[];
  sellerMetrics: SellerMetrics[];
  clientMetrics: ClientMetrics[];
  provinceMetrics: Map<string, ProvinceMetrics>;
  totalNetRevenue: number;
  totalGiftValue: number;
  totalSoldUnits: number;
  totalGiftedUnits: number;
  anomalies: string[];
}

// Helper functions
export const getUnitPrice = (p: any) => Number(p.unit_price ?? 0);
export const getNetAmount = (p: any) => Number(p.net_amount ?? p.amount ?? 0);
export const getGrossAmount = (p: any) => {
  const gross = Number(p.gross_amount ?? 0);
  return gross > 0 ? gross : Number(p.amount ?? 0);
};
export const inferSoldUnits = (p: any) => {
  const explicit = Number(p.quantity_sold ?? 0);
  if (explicit > 0) return explicit;
  const price = getUnitPrice(p);
  const net = getNetAmount(p);
  return price > 0 ? net / price : 0;
};
export const inferGiftedUnits = (p: any) => {
  const explicit = Number(p.quantity_free ?? 0);
  if (explicit > 0) return explicit;
  const price = getUnitPrice(p);
  const giftMoney = Math.max(0, getGrossAmount(p) - getNetAmount(p));
  return price > 0 ? giftMoney / price : 0;
};

interface UseAnalyticsDataParams {
  invoices: Invoice[];
  clients: Client[];
  products: Product[];
  sellers: Seller[];
  dateRange: { from: Date; to: Date };
  selectedProvince?: string | null;
  selectedSeller?: string | null;
}

export function useAnalyticsData({
  invoices,
  clients,
  products,
  sellers,
  dateRange,
  selectedProvince = null,
  selectedSeller = null
}: UseAnalyticsDataParams): AnalyticsResult {
  return useMemo(() => {
    // Filter invoices by date
    let filteredInvoices = invoices.filter(inv => {
      const invDate = parseISO(inv.invoice_date);
      return isWithinInterval(invDate, { start: dateRange.from, end: dateRange.to });
    });

    // Apply province filter
    if (selectedProvince) {
      const provinceClientIds = new Set(
        clients
          .filter(c => c.province && normalizeProvinceName(c.province) === selectedProvince)
          .map(c => c.id)
      );
      filteredInvoices = filteredInvoices.filter(inv => inv.client_id && provinceClientIds.has(inv.client_id));
    }

    // Apply seller filter
    if (selectedSeller && selectedSeller !== 'all') {
      filteredInvoices = filteredInvoices.filter(inv => inv.seller_id === selectedSeller);
    }

    // ========== PRODUCT METRICS ==========
    const productMap = new Map<string, {
      soldUnits: number;
      giftedUnits: number;
      netRevenue: number;
      giftValue: number;
      clients: Map<string, { units: number; revenue: number }>;
      dailyData: Map<string, { sold: number; gifted: number; revenue: number }>;
    }>();

    filteredInvoices.forEach(inv => {
      const invDate = format(parseISO(inv.invoice_date), 'yyyy-MM-dd');
      
      inv.products?.forEach(prod => {
        const existing = productMap.get(prod.product_name) || {
          soldUnits: 0,
          giftedUnits: 0,
          netRevenue: 0,
          giftValue: 0,
          clients: new Map(),
          dailyData: new Map()
        };

        const sold = inferSoldUnits(prod);
        const gifted = inferGiftedUnits(prod);
        const net = getNetAmount(prod);
        const gift = Math.max(0, getGrossAmount(prod) - net);

        existing.soldUnits += sold;
        existing.giftedUnits += gifted;
        existing.netRevenue += net;
        existing.giftValue += gift;

        if (inv.client_id) {
          const clientData = existing.clients.get(inv.client_id) || { units: 0, revenue: 0 };
          clientData.units += sold;
          clientData.revenue += net;
          existing.clients.set(inv.client_id, clientData);
        }

        const dayData = existing.dailyData.get(invDate) || { sold: 0, gifted: 0, revenue: 0 };
        dayData.sold += sold;
        dayData.gifted += gifted;
        dayData.revenue += net;
        existing.dailyData.set(invDate, dayData);

        productMap.set(prod.product_name, existing);
      });
    });

    const productMetrics: ProductMetrics[] = Array.from(productMap.entries()).map(([name, data]) => {
      const totalUnits = data.soldUnits + data.giftedUnits;
      const giftPercent = totalUnits > 0 ? (data.giftedUnits / totalUnits) * 100 : 0;
      const marginImpact = (data.netRevenue + data.giftValue) > 0 
        ? (data.giftValue / (data.netRevenue + data.giftValue)) * 100 
        : 0;

      let status: ProductStatus = 'healthy';
      if (giftPercent > 30 || marginImpact > 25) status = 'danger';
      else if (giftPercent > 15 || marginImpact > 10) status = 'watch';

      const clientsList = Array.from(data.clients.entries())
        .map(([clientId, clientData]) => {
          const client = clients.find(c => c.id === clientId);
          return {
            id: clientId,
            name: client?.name || 'Desconocido',
            units: clientData.units,
            revenue: clientData.revenue
          };
        })
        .sort((a, b) => b.revenue - a.revenue);

      const dailyData = Array.from(data.dailyData.entries())
        .map(([date, values]) => ({ date, ...values }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        name,
        soldUnits: data.soldUnits,
        giftedUnits: data.giftedUnits,
        netRevenue: data.netRevenue,
        giftValue: data.giftValue,
        marginImpact,
        status,
        trend: 0,
        clients: clientsList,
        dailyData
      };
    }).sort((a, b) => b.netRevenue - a.netRevenue);

    // ========== SELLER METRICS ==========
    const sellerMetrics: SellerMetrics[] = sellers.map(seller => {
      const sellerInvoices = filteredInvoices.filter(inv => inv.seller_id === seller.id);
      let netRevenue = 0;
      let soldUnits = 0;
      let giftedUnits = 0;
      let correctCommission = 0;
      const productDataMap = new Map<string, { sold: number; gifted: number; revenue: number }>();
      const clientServedMap = new Map<string, { revenue: number }>();

      sellerInvoices.forEach(inv => {
        if (inv.client_id) {
          const existing = clientServedMap.get(inv.client_id) || { revenue: 0 };
          existing.revenue += inv.total_amount || 0;
          clientServedMap.set(inv.client_id, existing);
        }

        inv.products?.forEach(prod => {
          const net = getNetAmount(prod);
          const sold = inferSoldUnits(prod);
          const gifted = inferGiftedUnits(prod);
          netRevenue += net;
          soldUnits += sold;
          giftedUnits += gifted;
          correctCommission += (net * Number(prod.percentage ?? 0) / 100);

          const existing = productDataMap.get(prod.product_name) || { sold: 0, gifted: 0, revenue: 0 };
          existing.sold += sold;
          existing.gifted += gifted;
          existing.revenue += net;
          productDataMap.set(prod.product_name, existing);
        });
      });

      const totalUnits = soldUnits + giftedUnits;
      const giftPercentage = totalUnits > 0 ? (giftedUnits / totalUnits) * 100 : 0;

      let status: ProductStatus = 'healthy';
      if (giftPercentage > 30) status = 'danger';
      else if (giftPercentage > 15) status = 'watch';

      const productsData = Array.from(productDataMap.entries())
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.revenue - a.revenue);

      const clientsServed = Array.from(clientServedMap.entries())
        .map(([id, data]) => {
          const client = clients.find(c => c.id === id);
          return { id, name: client?.name || 'Desconocido', revenue: data.revenue };
        })
        .sort((a, b) => b.revenue - a.revenue);

      return {
        id: seller.id,
        name: seller.name,
        netRevenue,
        soldUnits,
        giftedUnits,
        giftPercentage,
        correctCommission,
        status,
        productsData,
        clientsServed
      };
    }).filter(s => s.netRevenue > 0).sort((a, b) => b.netRevenue - a.netRevenue);

    // ========== CLIENT METRICS ==========
    const clientMap = new Map<string, {
      totalRevenue: number;
      totalUnits: number;
      invoiceCount: number;
      products: Map<string, { quantity: number; revenue: number }>;
      monthly: Map<string, { revenue: number; units: number }>;
    }>();

    filteredInvoices.forEach(inv => {
      if (!inv.client_id) return;
      const existing = clientMap.get(inv.client_id) || {
        totalRevenue: 0,
        totalUnits: 0,
        invoiceCount: 0,
        products: new Map(),
        monthly: new Map()
      };

      existing.invoiceCount += 1;
      const monthKey = format(parseISO(inv.invoice_date), 'yyyy-MM');

      inv.products?.forEach(prod => {
        const net = getNetAmount(prod);
        const sold = inferSoldUnits(prod);
        existing.totalRevenue += net;
        existing.totalUnits += sold;

        const prodData = existing.products.get(prod.product_name) || { quantity: 0, revenue: 0 };
        prodData.quantity += sold;
        prodData.revenue += net;
        existing.products.set(prod.product_name, prodData);

        const monthData = existing.monthly.get(monthKey) || { revenue: 0, units: 0 };
        monthData.revenue += net;
        monthData.units += sold;
        existing.monthly.set(monthKey, monthData);
      });

      clientMap.set(inv.client_id, existing);
    });

    const clientMetrics: ClientMetrics[] = Array.from(clientMap.entries())
      .map(([clientId, data]) => {
        const client = clients.find(c => c.id === clientId);
        const avgTicket = data.invoiceCount > 0 ? data.totalRevenue / data.invoiceCount : 0;
        
        let status: ProductStatus = 'healthy';
        if (avgTicket < 1000) status = 'watch';
        if (data.invoiceCount === 1 && data.totalRevenue < 500) status = 'danger';

        const productsData = Array.from(data.products.entries())
          .map(([name, pData]) => ({ name, ...pData }))
          .sort((a, b) => b.revenue - a.revenue);

        const monthlyData = Array.from(data.monthly.entries())
          .map(([month, mData]) => ({ month, ...mData }))
          .sort((a, b) => a.month.localeCompare(b.month));

        return {
          id: clientId,
          name: client?.name || 'Desconocido',
          province: client?.province || null,
          totalRevenue: data.totalRevenue,
          totalUnits: data.totalUnits,
          invoiceCount: data.invoiceCount,
          avgTicket,
          status,
          productsData,
          monthlyData
        };
      })
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    // ========== PROVINCE METRICS ==========
    const provinceMap = new Map<string, {
      sales: number;
      units: number;
      clients: Set<string>;
      products: Map<string, number>;
      topClients: Map<string, number>;
      giftedUnits: number;
      soldUnits: number;
    }>();

    clients.forEach(client => {
      const provinceName = client.province ? normalizeProvinceName(client.province) : null;
      if (!provinceName) return;
      
      const clientInvoices = filteredInvoices.filter(inv => inv.client_id === client.id);
      let clientSales = 0;
      let clientUnits = 0;
      let clientGifted = 0;
      let clientSold = 0;

      clientInvoices.forEach(inv => {
        (inv.products || []).forEach(p => {
          const net = getNetAmount(p);
          const sold = inferSoldUnits(p);
          const gifted = inferGiftedUnits(p);
          clientSales += net;
          clientUnits += sold + gifted;
          clientSold += sold;
          clientGifted += gifted;

          const existing = provinceMap.get(provinceName) || {
            sales: 0,
            units: 0,
            clients: new Set(),
            products: new Map(),
            topClients: new Map(),
            giftedUnits: 0,
            soldUnits: 0
          };

          const prodRevenue = existing.products.get(p.product_name) || 0;
          existing.products.set(p.product_name, prodRevenue + net);
          provinceMap.set(provinceName, existing);
        });
      });

      if (clientSales > 0) {
        const existing = provinceMap.get(provinceName) || {
          sales: 0,
          units: 0,
          clients: new Set(),
          products: new Map(),
          topClients: new Map(),
          giftedUnits: 0,
          soldUnits: 0
        };

        existing.sales += clientSales;
        existing.units += clientUnits;
        existing.clients.add(client.id);
        existing.topClients.set(client.id, (existing.topClients.get(client.id) || 0) + clientSales);
        existing.soldUnits += clientSold;
        existing.giftedUnits += clientGifted;

        provinceMap.set(provinceName, existing);
      }
    });

    const provinceMetrics = new Map<string, ProvinceMetrics>();
    provinceMap.forEach((data, name) => {
      const totalUnits = data.soldUnits + data.giftedUnits;
      const topProducts = Array.from(data.products.entries())
        .map(([pName, revenue]) => ({ name: pName, revenue }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      const topClients = Array.from(data.topClients.entries())
        .map(([id, revenue]) => {
          const client = clients.find(c => c.id === id);
          return { id, name: client?.name || 'Desconocido', revenue };
        })
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      provinceMetrics.set(name, {
        name,
        sales: data.sales,
        units: data.units,
        clientCount: data.clients.size,
        topProducts,
        topClients,
        giftPercentage: totalUnits > 0 ? (data.giftedUnits / totalUnits) * 100 : 0
      });
    });

    // ========== TOTALS ==========
    const totalNetRevenue = productMetrics.reduce((sum, p) => sum + p.netRevenue, 0);
    const totalGiftValue = productMetrics.reduce((sum, p) => sum + p.giftValue, 0);
    const totalSoldUnits = productMetrics.reduce((sum, p) => sum + p.soldUnits, 0);
    const totalGiftedUnits = productMetrics.reduce((sum, p) => sum + p.giftedUnits, 0);

    // ========== ANOMALIES ==========
    const anomalies: string[] = [];
    const giftRatio = (totalSoldUnits + totalGiftedUnits) > 0 
      ? (totalGiftedUnits / (totalSoldUnits + totalGiftedUnits)) * 100 
      : 0;
    
    if (giftRatio > 20) {
      anomalies.push(`Alto % de regalos: ${giftRatio.toFixed(0)}% de unidades son regaladas`);
    }
    if (totalGiftValue > 5000) {
      anomalies.push(`Pérdida por ofertas: RD$${totalGiftValue.toLocaleString()} en el período`);
    }
    const dangerProducts = productMetrics.filter(p => p.status === 'danger');
    if (dangerProducts.length > 0) {
      anomalies.push(`${dangerProducts.length} producto(s) afectan el margen significativamente`);
    }

    return {
      productMetrics,
      sellerMetrics,
      clientMetrics,
      provinceMetrics,
      totalNetRevenue,
      totalGiftValue,
      totalSoldUnits,
      totalGiftedUnits,
      anomalies
    };
  }, [invoices, clients, products, sellers, dateRange, selectedProvince, selectedSeller]);
}
