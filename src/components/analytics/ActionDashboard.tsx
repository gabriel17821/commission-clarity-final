import { useMemo, useState, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Package, Users, MapPin, DollarSign, TrendingUp, TrendingDown,
  AlertTriangle, ChevronRight, X, RotateCcw, Gift, BarChart3
} from 'lucide-react';
import { parseISO, isWithinInterval, format, subDays, startOfWeek, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { Invoice } from '@/hooks/useInvoices';
import { Client } from '@/hooks/useClients';
import { Product } from '@/hooks/useProducts';
import { Seller } from '@/hooks/useSellers';
import { formatNumber } from '@/lib/formatters';
import { normalizeProvinceName } from '@/lib/dominicanProvinces';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';

interface ActionDashboardProps {
  invoices: Invoice[];
  clients: Client[];
  products: Product[];
  sellers: Seller[];
  dateRange: { from: Date; to: Date };
}

type ProductStatus = 'healthy' | 'watch' | 'danger';

interface ProductMetrics {
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

interface SellerMetrics {
  id: string;
  name: string;
  netRevenue: number;
  giftPercentage: number;
  correctCommission: number;
  status: ProductStatus;
}

const PROVINCE_COORDS: Record<string, [number, number]> = {
  'Distrito Nacional': [-69.9312, 18.4861],
  'Santo Domingo': [-69.8549, 18.4804],
  'Santiago': [-70.6970, 19.4517],
  'La Vega': [-70.5290, 19.2220],
  'Puerto Plata': [-70.6930, 19.7934],
  'San Cristóbal': [-70.1066, 18.4166],
  'Duarte': [-70.0270, 19.3040],
  'La Romana': [-68.9728, 18.4274],
  'San Pedro de Macorís': [-69.3063, 18.4533],
  'Espaillat': [-70.2785, 19.6282],
  'Azua': [-70.7285, 18.4551],
  'Barahona': [-71.1003, 18.2006],
  'Peravia': [-70.3323, 18.2760],
  'San Juan': [-71.2296, 18.8072],
  'Monseñor Nouel': [-70.4182, 18.9179],
  'Monte Plata': [-69.7840, 18.8076],
  'Sánchez Ramírez': [-70.1520, 19.0570],
  'Valverde': [-71.0828, 19.5870],
  'María Trinidad Sánchez': [-69.8520, 19.3820],
  'Samaná': [-69.3323, 19.2058],
  'La Altagracia': [-68.5241, 18.6168],
  'El Seibo': [-69.0403, 18.7654],
  'Hato Mayor': [-69.2561, 18.7635],
  'Monte Cristi': [-71.6513, 19.8649],
  'Dajabón': [-71.7082, 19.5490],
  'Santiago Rodríguez': [-71.3397, 19.4716],
  'Elías Piña': [-71.7003, 18.8760],
  'Baoruco': [-71.4185, 18.4880],
  'Independencia': [-71.8570, 18.4842],
  'Pedernales': [-71.7451, 18.0370],
  'Hermanas Mirabal': [-70.2108, 19.3727],
  'San José de Ocoa': [-70.5050, 18.5465]
};

export function ActionDashboard({ invoices, clients, products, sellers, dateRange }: ActionDashboardProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  
  const [selectedProduct, setSelectedProduct] = useState<ProductMetrics | null>(null);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [selectedSeller, setSelectedSeller] = useState<string>('all');

  // Helper functions
  const getUnitPrice = (p: any) => Number(p.unit_price ?? 0);
  const getNetAmount = (p: any) => Number(p.net_amount ?? p.amount ?? 0);
  const getGrossAmount = (p: any) => {
    const gross = Number(p.gross_amount ?? 0);
    return gross > 0 ? gross : Number(p.amount ?? 0);
  };
  const inferSoldUnits = (p: any) => {
    const explicit = Number(p.quantity_sold ?? 0);
    if (explicit > 0) return explicit;
    const price = getUnitPrice(p);
    const net = getNetAmount(p);
    return price > 0 ? net / price : 0;
  };
  const inferGiftedUnits = (p: any) => {
    const explicit = Number(p.quantity_free ?? 0);
    if (explicit > 0) return explicit;
    const price = getUnitPrice(p);
    const giftMoney = Math.max(0, getGrossAmount(p) - getNetAmount(p));
    return price > 0 ? giftMoney / price : 0;
  };

  // Calculate metrics
  const analytics = useMemo(() => {
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
    if (selectedSeller !== 'all') {
      filteredInvoices = filteredInvoices.filter(inv => inv.seller_id === selectedSeller);
    }

    // Product metrics
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

        // Track by client
        if (inv.client_id) {
          const clientData = existing.clients.get(inv.client_id) || { units: 0, revenue: 0 };
          clientData.units += sold;
          clientData.revenue += net;
          existing.clients.set(inv.client_id, clientData);
        }

        // Track by day
        const dayData = existing.dailyData.get(invDate) || { sold: 0, gifted: 0, revenue: 0 };
        dayData.sold += sold;
        dayData.gifted += gifted;
        dayData.revenue += net;
        existing.dailyData.set(invDate, dayData);

        productMap.set(prod.product_name, existing);
      });
    });

    // Convert to array with status
    const productMetrics: ProductMetrics[] = Array.from(productMap.entries()).map(([name, data]) => {
      const totalUnits = data.soldUnits + data.giftedUnits;
      const giftPercent = totalUnits > 0 ? (data.giftedUnits / totalUnits) * 100 : 0;
      const marginImpact = (data.netRevenue + data.giftValue) > 0 
        ? (data.giftValue / (data.netRevenue + data.giftValue)) * 100 
        : 0;

      let status: ProductStatus = 'healthy';
      if (giftPercent > 30 || marginImpact > 25) status = 'danger';
      else if (giftPercent > 15 || marginImpact > 10) status = 'watch';

      // Build clients list
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

      // Build daily data
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

    // Seller metrics
    const sellerMetrics: SellerMetrics[] = sellers.map(seller => {
      const sellerInvoices = filteredInvoices.filter(inv => inv.seller_id === seller.id);
      let netRevenue = 0;
      let soldUnits = 0;
      let giftedUnits = 0;
      let correctCommission = 0;

      sellerInvoices.forEach(inv => {
        inv.products?.forEach(prod => {
          const net = getNetAmount(prod);
          netRevenue += net;
          soldUnits += inferSoldUnits(prod);
          giftedUnits += inferGiftedUnits(prod);
          correctCommission += (net * Number(prod.percentage ?? 0) / 100);
        });
      });

      const totalUnits = soldUnits + giftedUnits;
      const giftPercentage = totalUnits > 0 ? (giftedUnits / totalUnits) * 100 : 0;

      let status: ProductStatus = 'healthy';
      if (giftPercentage > 30) status = 'danger';
      else if (giftPercentage > 15) status = 'watch';

      return {
        id: seller.id,
        name: seller.name,
        netRevenue,
        giftPercentage,
        correctCommission,
        status
      };
    }).filter(s => s.netRevenue > 0).sort((a, b) => b.netRevenue - a.netRevenue);

    // Province metrics for map
    const provinceMetrics = new Map<string, { sales: number; clients: number }>();
    clients.forEach(client => {
      const provinceName = client.province ? normalizeProvinceName(client.province) : null;
      if (!provinceName) return;
      
      const clientInvoices = filteredInvoices.filter(inv => inv.client_id === client.id);
      const clientSales = clientInvoices.reduce((sum, inv) => {
        return sum + (inv.products || []).reduce((pSum, p) => pSum + getNetAmount(p), 0);
      }, 0);

      const existing = provinceMetrics.get(provinceName) || { sales: 0, clients: 0 };
      existing.sales += clientSales;
      if (clientSales > 0) existing.clients += 1;
      provinceMetrics.set(provinceName, existing);
    });

    // Totals
    const totalNetRevenue = productMetrics.reduce((sum, p) => sum + p.netRevenue, 0);
    const totalGiftValue = productMetrics.reduce((sum, p) => sum + p.giftValue, 0);
    const totalSoldUnits = productMetrics.reduce((sum, p) => sum + p.soldUnits, 0);
    const totalGiftedUnits = productMetrics.reduce((sum, p) => sum + p.giftedUnits, 0);

    // Anomalies
    const anomalies: string[] = [];
    const giftRatio = (totalSoldUnits + totalGiftedUnits) > 0 
      ? (totalGiftedUnits / (totalSoldUnits + totalGiftedUnits)) * 100 
      : 0;
    
    if (giftRatio > 20) {
      anomalies.push(`Alto % de regalos: ${giftRatio.toFixed(0)}% de unidades son regaladas`);
    }
    if (totalGiftValue > 5000) {
      anomalies.push(`Pérdida por ofertas: RD$${formatNumber(totalGiftValue)} en el período`);
    }

    const dangerProducts = productMetrics.filter(p => p.status === 'danger');
    if (dangerProducts.length > 0) {
      anomalies.push(`${dangerProducts.length} producto(s) afectan el margen significativamente`);
    }

    return {
      productMetrics,
      sellerMetrics,
      provinceMetrics,
      totalNetRevenue,
      totalGiftValue,
      totalSoldUnits,
      totalGiftedUnits,
      anomalies
    };
  }, [invoices, clients, products, sellers, dateRange, selectedProvince, selectedSeller]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [-70.1627, 18.7357],
      zoom: 7,
      minZoom: 6,
      maxZoom: 10,
      pitch: 0,
      bearing: 0
    });

    map.current.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'top-right'
    );

    return () => {
      markersRef.current.forEach(m => m.remove());
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update markers when data changes
  useEffect(() => {
    if (!map.current) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const maxSales = Math.max(...Array.from(analytics.provinceMetrics.values()).map(p => p.sales), 1);

    analytics.provinceMetrics.forEach((data, provinceName) => {
      if (!data.clients) return;
      const coords = PROVINCE_COORDS[provinceName];
      if (!coords) return;

      const intensity = Math.min(data.sales / maxSales, 1);
      const size = 20 + (intensity * 24);
      const isSelected = selectedProvince === provinceName;

      const el = document.createElement('div');
      el.style.cssText = `
        width: ${size}px;
        height: ${size}px;
        background: ${isSelected 
          ? 'linear-gradient(135deg, hsl(45, 93%, 47%), hsl(45, 93%, 37%))' 
          : `linear-gradient(135deg, hsl(142, 76%, ${55 - intensity * 20}%), hsl(142, 76%, ${45 - intensity * 15}%))`};
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 600;
        font-size: ${Math.max(9, size * 0.4)}px;
        transition: transform 0.2s;
      `;
      el.textContent = data.clients.toString();
      el.title = `${provinceName}: ${data.clients} clientes, RD$${formatNumber(data.sales)}`;
      
      el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.2)'; });
      el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)'; });
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedProvince(prev => prev === provinceName ? null : provinceName);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(coords)
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [analytics.provinceMetrics, selectedProvince]);

  const getStatusBadge = (status: ProductStatus) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">🟢 Saludable</Badge>;
      case 'watch':
        return <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30">🟡 Vigilar</Badge>;
      case 'danger':
        return <Badge className="bg-rose-500/15 text-rose-700 border-rose-500/30">🔴 Daña margen</Badge>;
    }
  };

  const handleResetFilters = () => {
    setSelectedProvince(null);
    setSelectedSeller('all');
    map.current?.flyTo({ center: [-70.1627, 18.7357], zoom: 7, duration: 600 });
  };

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select value={selectedSeller} onValueChange={setSelectedSeller}>
            <SelectTrigger className="w-40 h-9">
              <Users className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {sellers.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(selectedProvince || selectedSeller !== 'all') && (
            <Button variant="ghost" size="sm" onClick={handleResetFilters} className="gap-1">
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
          )}
        </div>

        {selectedProvince && (
          <Badge variant="secondary" className="gap-1">
            <MapPin className="h-3 w-3" />
            {selectedProvince}
            <button onClick={() => setSelectedProvince(null)} className="ml-1 hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}
      </div>

      {/* Anomalies Alert */}
      {analytics.anomalies.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="py-3 px-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                {analytics.anomalies.map((anomaly, i) => (
                  <p key={i} className="text-sm text-amber-800">{anomaly}</p>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Layout: Map + Content */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Map */}
        <Card className="lg:col-span-1 overflow-hidden">
          <CardHeader className="py-3 px-4 border-b">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Zonas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div ref={mapContainer} className="h-64" />
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <Card className="lg:col-span-2">
          <CardContent className="py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-emerald-500/10">
                <DollarSign className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
                <p className="text-xl font-bold">RD${formatNumber(analytics.totalNetRevenue)}</p>
                <p className="text-xs text-muted-foreground">Ingreso Neto</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-violet-500/10">
                <Package className="h-5 w-5 mx-auto text-violet-600 mb-1" />
                <p className="text-xl font-bold">{formatNumber(analytics.totalSoldUnits)}</p>
                <p className="text-xs text-muted-foreground">Unidades Vendidas</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-amber-500/10">
                <Gift className="h-5 w-5 mx-auto text-amber-600 mb-1" />
                <p className="text-xl font-bold">{formatNumber(analytics.totalGiftedUnits)}</p>
                <p className="text-xs text-muted-foreground">Unidades Regaladas</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-rose-500/10">
                <TrendingDown className="h-5 w-5 mx-auto text-rose-600 mb-1" />
                <p className="text-xl font-bold">RD${formatNumber(analytics.totalGiftValue)}</p>
                <p className="text-xs text-muted-foreground">Pérdida Ofertas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Products Table - MAIN ELEMENT */}
      <Card>
        <CardHeader className="py-3 px-4 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Productos
            <Badge variant="outline" className="ml-2">{analytics.productMetrics.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left py-3 px-4 font-medium">Producto</th>
                  <th className="text-right py-3 px-3 font-medium">Vendidas</th>
                  <th className="text-right py-3 px-3 font-medium">Regaladas</th>
                  <th className="text-right py-3 px-3 font-medium">Ingreso Neto</th>
                  <th className="text-right py-3 px-3 font-medium">Impacto</th>
                  <th className="text-center py-3 px-3 font-medium">Estado</th>
                  <th className="py-3 px-3"></th>
                </tr>
              </thead>
              <tbody>
                {analytics.productMetrics.slice(0, 20).map((product) => (
                  <tr 
                    key={product.name} 
                    className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => setSelectedProduct(product)}
                  >
                    <td className="py-3 px-4 font-medium truncate max-w-48">{product.name}</td>
                    <td className="py-3 px-3 text-right tabular-nums">{formatNumber(product.soldUnits)}</td>
                    <td className="py-3 px-3 text-right tabular-nums text-amber-600">
                      {product.giftedUnits > 0 ? formatNumber(product.giftedUnits) : '-'}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-medium">RD${formatNumber(product.netRevenue)}</td>
                    <td className="py-3 px-3 text-right">
                      {product.marginImpact > 0 && (
                        <span className={product.marginImpact > 15 ? 'text-rose-600 font-medium' : 'text-muted-foreground'}>
                          -{product.marginImpact.toFixed(0)}%
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">{getStatusBadge(product.status)}</td>
                    <td className="py-3 px-3">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Sellers Summary */}
      <Card>
        <CardHeader className="py-3 px-4 border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Vendedores
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {analytics.sellerMetrics.map((seller) => (
              <div 
                key={seller.id} 
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    {seller.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{seller.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {seller.giftPercentage > 0 ? `${seller.giftPercentage.toFixed(0)}% regalado` : 'Sin regalos'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm">RD${formatNumber(seller.netRevenue)}</p>
                  {getStatusBadge(seller.status)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Product Detail Sheet */}
      <Sheet open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedProduct && (
            <>
              <SheetHeader className="pb-4 border-b">
                <SheetTitle className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <span className="block">{selectedProduct.name}</span>
                    <span className="text-sm font-normal text-muted-foreground">Detalle del producto</span>
                  </div>
                </SheetTitle>
              </SheetHeader>

              <div className="space-y-6 py-6">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-emerald-500/10 text-center">
                    <p className="text-lg font-bold">{formatNumber(selectedProduct.soldUnits)}</p>
                    <p className="text-xs text-muted-foreground">Vendidas</p>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-500/10 text-center">
                    <p className="text-lg font-bold">{formatNumber(selectedProduct.giftedUnits)}</p>
                    <p className="text-xs text-muted-foreground">Regaladas</p>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-500/10 text-center">
                    <p className="text-lg font-bold">RD${formatNumber(selectedProduct.netRevenue)}</p>
                    <p className="text-xs text-muted-foreground">Ingreso Neto</p>
                  </div>
                  <div className="p-3 rounded-lg bg-rose-500/10 text-center">
                    <p className="text-lg font-bold">-{selectedProduct.marginImpact.toFixed(0)}%</p>
                    <p className="text-xs text-muted-foreground">Impacto Margen</p>
                  </div>
                </div>

                {/* Temporal Chart */}
                {selectedProduct.dailyData.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Evolución Temporal
                    </h4>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={selectedProduct.dailyData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis 
                            dataKey="date" 
                            tick={{ fontSize: 10 }} 
                            tickFormatter={(val) => format(new Date(val), 'dd/MM')}
                          />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip 
                            formatter={(value: number, name: string) => [
                              formatNumber(value),
                              name === 'sold' ? 'Vendidas' : name === 'gifted' ? 'Regaladas' : 'Ingreso'
                            ]}
                            labelFormatter={(label) => format(new Date(label), 'dd MMM yyyy', { locale: es })}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="sold" 
                            stackId="1"
                            stroke="hsl(var(--chart-1))" 
                            fill="hsl(var(--chart-1))" 
                            fillOpacity={0.6}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="gifted" 
                            stackId="1"
                            stroke="hsl(var(--chart-2))" 
                            fill="hsl(var(--chart-2))" 
                            fillOpacity={0.6}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Clients who bought */}
                {selectedProduct.clients.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Clientes ({selectedProduct.clients.length})
                    </h4>
                    <ScrollArea className="h-48">
                      <div className="space-y-2">
                        {selectedProduct.clients.map((client, i) => (
                          <div 
                            key={client.id} 
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-5">{i + 1}</span>
                              <span className="font-medium text-sm truncate max-w-40">{client.name}</span>
                            </div>
                            <div className="text-right text-sm">
                              <span className="font-medium">RD${formatNumber(client.revenue)}</span>
                              <span className="text-muted-foreground ml-2">({formatNumber(client.units)}u)</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
