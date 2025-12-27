import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Gift, DollarSign, TrendingDown, Percent, AlertTriangle, 
  Users, Package, Lightbulb, BarChart3, PieChart
} from 'lucide-react';
import { Invoice } from '@/hooks/useInvoices';
import { Product } from '@/hooks/useProducts';
import { Seller } from '@/hooks/useSellers';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RechartsPieChart, Pie, Cell, Legend
} from 'recharts';

interface GiftMarginAnalysisProps {
  invoices: Invoice[];
  products: Product[];
  sellers: Seller[];
  dateRange: { from: Date; to: Date };
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function GiftMarginAnalysis({ invoices, products, sellers, dateRange }: GiftMarginAnalysisProps) {
  const [selectedSeller, setSelectedSeller] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<string>('all');

  const analysis = useMemo(() => {
    // Filter invoices by date range
    let filteredInvoices = invoices.filter(inv => {
      const invDate = new Date(inv.invoice_date);
      return invDate >= dateRange.from && invDate <= dateRange.to;
    });

    // Apply seller filter
    if (selectedSeller !== 'all') {
      filteredInvoices = filteredInvoices.filter(inv => inv.seller_id === selectedSeller);
    }

    // Flatten all products from invoices
    let allProducts = filteredInvoices.flatMap(inv => 
      (inv.products || []).map(p => ({
        ...p,
        seller_id: inv.seller_id,
        invoice_id: inv.id,
        invoice_date: inv.invoice_date
      }))
    );

    // Apply product filter
    if (selectedProduct !== 'all') {
      allProducts = allProducts.filter(p => p.product_name === selectedProduct);
    }

    // Helpers: infer missing qty/value from gross/net when legacy rows don't have offer fields filled
    const getUnitPrice = (p: any) => Number(p.unit_price ?? 0);
    const getNetAmount = (p: any) => Number(p.net_amount ?? p.amount ?? 0);
    const getGrossAmount = (p: any) => {
      const gross = Number(p.gross_amount ?? 0);
      // Legacy rows may not have gross_amount populated; fall back to amount (what was recorded)
      return gross > 0 ? gross : Number(p.amount ?? 0);
    };
    const getGiftValueMoney = (p: any) => {
      const gross = getGrossAmount(p);
      const net = getNetAmount(p);
      return Math.max(0, gross - net);
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
      const giftMoney = getGiftValueMoney(p);
      return price > 0 ? giftMoney / price : 0;
    };

    // Calculate totals (robust for legacy data)
    const totalUnitsSold = allProducts.reduce((sum, p) => sum + inferSoldUnits(p), 0);
    const totalUnitsGifted = allProducts.reduce((sum, p) => sum + inferGiftedUnits(p), 0);
    const totalUnits = totalUnitsSold + totalUnitsGifted;
    const giftPercentage = totalUnits > 0 ? (totalUnitsGifted / totalUnits) * 100 : 0;

    // Financial calculations
    // What client actually paid (net)
    const netRealRevenue = allProducts.reduce((sum, p) => sum + getNetAmount(p), 0);
    // Total monetary value given away (money left on the table)
    const giftValue = allProducts.reduce((sum, p) => sum + getGiftValueMoney(p), 0);
    // If no gifts existed, you'd capture the full gross value
    const theoreticalRevenue = allProducts.reduce((sum, p) => sum + getGrossAmount(p), 0);
    const grossRevenue = netRealRevenue;
    const marginImpact = theoreticalRevenue > 0 ? ((giftValue / theoreticalRevenue) * 100) : 0;

    // Commission analysis
    const totalCommissionPaid = allProducts.reduce((sum, p) => sum + Number(p.commission ?? 0), 0);
    const correctCommission = allProducts.reduce((sum, p) => {
      const netAmount = getNetAmount(p);
      const percentage = Number(p.percentage ?? 0);
      return sum + (netAmount * percentage / 100);
    }, 0);
    const commissionDifference = totalCommissionPaid - correctCommission;

    // Analysis by seller
    const sellerAnalysis = sellers.map(seller => {
      const sellerProducts = allProducts.filter(p => p.seller_id === seller.id);
      const soldUnits = sellerProducts.reduce((sum, p) => sum + inferSoldUnits(p), 0);
      const giftedUnits = sellerProducts.reduce((sum, p) => sum + inferGiftedUnits(p), 0);
      const revenue = sellerProducts.reduce((sum, p) => sum + getNetAmount(p), 0);
      const giftVal = sellerProducts.reduce((sum, p) => sum + getGiftValueMoney(p), 0);
      const commission = sellerProducts.reduce((sum, p) => sum + Number(p.commission ?? 0), 0);
      const correctComm = sellerProducts.reduce((sum, p) => {
        return sum + (getNetAmount(p) * Number(p.percentage ?? 0) / 100);
      }, 0);

      return {
        id: seller.id,
        name: seller.name,
        soldUnits,
        giftedUnits,
        giftPercentage: (soldUnits + giftedUnits) > 0 ? (giftedUnits / (soldUnits + giftedUnits)) * 100 : 0,
        revenue,
        giftValue: giftVal,
        commissionPaid: commission,
        correctCommission: correctComm,
        commissionDiff: commission - correctComm,
        invoiceCount: filteredInvoices.filter(inv => inv.seller_id === seller.id).length
      };
    }).filter(s => s.invoiceCount > 0).sort((a, b) => b.giftValue - a.giftValue);

    // Analysis by product
    const productNames = [...new Set(allProducts.map(p => p.product_name))];
    const productAnalysis = productNames.map(name => {
      const prods = allProducts.filter(p => p.product_name === name);
      const soldUnits = prods.reduce((sum, p) => sum + inferSoldUnits(p), 0);
      const giftedUnits = prods.reduce((sum, p) => sum + inferGiftedUnits(p), 0);
      const revenue = prods.reduce((sum, p) => sum + getNetAmount(p), 0);
      const giftVal = prods.reduce((sum, p) => sum + getGiftValueMoney(p), 0);
      const avgPrice = soldUnits > 0 ? (revenue / soldUnits) : 0;

      return {
        name,
        soldUnits,
        giftedUnits,
        giftPercentage: (soldUnits + giftedUnits) > 0 ? (giftedUnits / (soldUnits + giftedUnits)) * 100 : 0,
        revenue,
        giftValue: giftVal,
        avgPrice,
        marginLoss: giftVal
      };
    }).sort((a, b) => b.giftValue - a.giftValue);

    // Generate insights
    const insights: string[] = [];
    
    if (sellerAnalysis.length > 0) {
      const topGiftingSeller = sellerAnalysis[0];
      if (topGiftingSeller.giftValue > 0) {
        const sellerGiftShare = (topGiftingSeller.giftValue / giftValue) * 100;
        insights.push(`El ${sellerGiftShare.toFixed(0)}% de los regalos proviene de ${topGiftingSeller.name}`);
      }
    }

    if (productAnalysis.length > 0) {
      const mostGiftedProduct = productAnalysis[0];
      if (mostGiftedProduct.giftedUnits > mostGiftedProduct.soldUnits) {
        insights.push(`"${mostGiftedProduct.name}" genera más pérdidas en regalos que beneficios en ventas`);
      }
    }

    if (giftValue > 0) {
      insights.push(`Las promociones generan una pérdida mensual de RD$${giftValue.toLocaleString()}`);
      const potentialIncrease = giftValue * 0.5; // 50% reduction scenario
      insights.push(`Reduciendo los regalos en un 50% se incrementaría el ingreso neto en RD$${potentialIncrease.toLocaleString()}`);
    }

    if (commissionDifference > 100) {
      insights.push(`Se está pagando RD$${commissionDifference.toLocaleString()} adicionales en comisiones incorrectas`);
    }

    return {
      totalUnitsSold,
      totalUnitsGifted,
      giftPercentage,
      grossRevenue,
      giftValue,
      theoreticalRevenue,
      netRealRevenue,
      marginImpact,
      totalCommissionPaid,
      correctCommission,
      commissionDifference,
      sellerAnalysis,
      productAnalysis,
      insights
    };
  }, [invoices, products, sellers, dateRange, selectedSeller, selectedProduct]);

  const formatCurrency = (value: number) => `RD$${value.toLocaleString('es-DO', { minimumFractionDigits: 0 })}`;
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  // Chart data
  const pieData = [
    { name: 'Vendidos', value: analysis.totalUnitsSold, fill: 'hsl(var(--chart-1))' },
    { name: 'Regalados', value: analysis.totalUnitsGifted, fill: 'hsl(var(--chart-2))' }
  ];

  const productChartData = analysis.productAnalysis.slice(0, 8).map(p => ({
    name: p.name.length > 12 ? p.name.slice(0, 12) + '...' : p.name,
    regalados: p.giftedUnits,
    perdida: p.giftValue
  }));

  // Get unique product names for filter
  const uniqueProducts = [...new Set(invoices.flatMap(inv => (inv.products || []).map(p => p.product_name)))];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={selectedSeller} onValueChange={setSelectedSeller}>
          <SelectTrigger className="w-48">
            <Users className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Vendedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los vendedores</SelectItem>
            {sellers.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedProduct} onValueChange={setSelectedProduct}>
          <SelectTrigger className="w-48">
            <Package className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Producto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los productos</SelectItem>
            {uniqueProducts.map(p => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 1. Resumen General */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-emerald-600 mb-2">
              <Package className="h-4 w-4" />
              <span className="text-xs font-medium">Unidades Vendidas</span>
            </div>
            <p className="text-2xl font-bold">{analysis.totalUnitsSold.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-purple-600 mb-2">
              <Gift className="h-4 w-4" />
              <span className="text-xs font-medium">Unidades Regaladas</span>
            </div>
            <p className="text-2xl font-bold">{analysis.totalUnitsGifted.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-600 mb-2">
              <Percent className="h-4 w-4" />
              <span className="text-xs font-medium">% Regalado</span>
            </div>
            <p className="text-2xl font-bold">{formatPercent(analysis.giftPercentage)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-medium">Ingreso Bruto</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(analysis.grossRevenue)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-600 mb-2">
              <TrendingDown className="h-4 w-4" />
              <span className="text-xs font-medium">Valor Regalos</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(analysis.giftValue)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-teal-500/10 to-teal-600/5 border-teal-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-teal-600 mb-2">
              <BarChart3 className="h-4 w-4" />
              <span className="text-xs font-medium">Ingreso Neto Real</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(analysis.netRealRevenue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* 2. Análisis Financiero Real */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Análisis Financiero
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <span className="text-sm text-muted-foreground">Ingreso Bruto Teórico (sin regalos)</span>
                <span className="font-semibold text-emerald-600">{formatCurrency(analysis.theoreticalRevenue)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <span className="text-sm text-muted-foreground">Ingreso Neto Real Percibido</span>
                <span className="font-semibold text-blue-600">{formatCurrency(analysis.netRealRevenue)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                <span className="text-sm font-medium text-red-700">Dinero Dejado de Percibir</span>
                <span className="font-bold text-red-600">{formatCurrency(analysis.giftValue)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <span className="text-sm font-medium text-amber-700">Impacto en Margen</span>
                <span className="font-bold text-amber-600">-{formatPercent(analysis.marginImpact)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-primary" />
              Distribución Vendido vs Regalado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => value.toLocaleString()} />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Análisis de Comisiones */}
      <Card className={analysis.commissionDifference > 0 ? 'border-amber-500/50' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5 text-primary" />
            Análisis de Comisiones
            {analysis.commissionDifference > 100 && (
              <Badge variant="destructive" className="ml-2">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Revisar
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <p className="text-xs text-muted-foreground mb-1">Comisión Pagada</p>
              <p className="text-xl font-bold">{formatCurrency(analysis.totalCommissionPaid)}</p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <p className="text-xs text-muted-foreground mb-1">Comisión Real Correcta</p>
              <p className="text-xl font-bold text-emerald-600">{formatCurrency(analysis.correctCommission)}</p>
            </div>
            <div className={`p-4 rounded-lg text-center ${analysis.commissionDifference > 0 ? 'bg-red-500/10 border border-red-500/20' : 'bg-emerald-500/10'}`}>
              <p className="text-xs text-muted-foreground mb-1">Diferencia</p>
              <p className={`text-xl font-bold ${analysis.commissionDifference > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {analysis.commissionDifference > 0 ? '+' : ''}{formatCurrency(analysis.commissionDifference)}
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <p className="text-xs text-muted-foreground mb-1">Estado</p>
              <Badge variant={analysis.commissionDifference > 100 ? 'destructive' : 'secondary'}>
                {analysis.commissionDifference > 100 ? 'Sobrepago' : 'Correcto'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Análisis por Vendedor */}
      {analysis.sellerAnalysis.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Análisis por Vendedor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 font-medium">Vendedor</th>
                    <th className="text-right py-3 px-2 font-medium">Vendidas</th>
                    <th className="text-right py-3 px-2 font-medium">Regaladas</th>
                    <th className="text-right py-3 px-2 font-medium">% Regalo</th>
                    <th className="text-right py-3 px-2 font-medium">Ingresos</th>
                    <th className="text-right py-3 px-2 font-medium">Valor Regalos</th>
                    <th className="text-right py-3 px-2 font-medium">Comisión Pagada</th>
                    <th className="text-right py-3 px-2 font-medium">Comisión Real</th>
                    <th className="text-right py-3 px-2 font-medium">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.sellerAnalysis.map((seller, idx) => (
                    <tr key={seller.id} className={`border-b border-border/50 ${idx % 2 === 0 ? 'bg-muted/30' : ''}`}>
                      <td className="py-3 px-2 font-medium">{seller.name}</td>
                      <td className="text-right py-3 px-2">{seller.soldUnits.toLocaleString()}</td>
                      <td className="text-right py-3 px-2 text-purple-600">{seller.giftedUnits.toLocaleString()}</td>
                      <td className="text-right py-3 px-2">
                        <Badge variant={seller.giftPercentage > 15 ? 'destructive' : 'secondary'}>
                          {formatPercent(seller.giftPercentage)}
                        </Badge>
                      </td>
                      <td className="text-right py-3 px-2">{formatCurrency(seller.revenue)}</td>
                      <td className="text-right py-3 px-2 text-red-600">{formatCurrency(seller.giftValue)}</td>
                      <td className="text-right py-3 px-2">{formatCurrency(seller.commissionPaid)}</td>
                      <td className="text-right py-3 px-2 text-emerald-600">{formatCurrency(seller.correctCommission)}</td>
                      <td className={`text-right py-3 px-2 font-medium ${seller.commissionDiff > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {seller.commissionDiff > 0 ? '+' : ''}{formatCurrency(seller.commissionDiff)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5. Análisis por Producto */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              Productos Más Regalados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis type="category" dataKey="name" width={100} className="text-xs" />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      name === 'regalados' ? value.toLocaleString() : formatCurrency(value),
                      name === 'regalados' ? 'Unidades' : 'Pérdida'
                    ]}
                  />
                  <Bar dataKey="regalados" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Ranking de Productos "Peligrosos"
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysis.productAnalysis.slice(0, 5).map((product, idx) => (
                <div key={product.name} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                    ${idx === 0 ? 'bg-red-500 text-white' : idx === 1 ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {product.giftedUnits} regalados de {product.soldUnits + product.giftedUnits} total
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-red-600">{formatCurrency(product.marginLoss)}</p>
                    <p className="text-xs text-muted-foreground">pérdida</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 6. Insights Automáticos */}
      {analysis.insights.length > 0 && (
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              Insights Automáticos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {analysis.insights.map((insight, idx) => (
                <div key={idx} className="flex items-start gap-3 p-4 bg-background rounded-lg border">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Lightbulb className="h-3 w-3 text-primary" />
                  </div>
                  <p className="text-sm">{insight}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
