import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Package, MapPin, Users, UserCheck, LayoutDashboard } from 'lucide-react';
import { Invoice } from '@/hooks/useInvoices';
import { Client } from '@/hooks/useClients';
import { Product } from '@/hooks/useProducts';
import { Seller } from '@/hooks/useSellers';
import { useAnalyticsData } from '@/hooks/useAnalyticsData';
import { ProductsArea } from './areas/ProductsArea';
import { ZonesArea } from './areas/ZonesArea';
import { ClientsArea } from './areas/ClientsArea';
import { SellersArea } from './areas/SellersArea';
import { ExecutivePanel } from './areas/ExecutivePanel';

type AreaType = 'products' | 'zones' | 'clients' | 'sellers' | 'executive';

interface AnalysisCenterLayoutProps {
  invoices: Invoice[];
  clients: Client[];
  products: Product[];
  sellers: Seller[];
  dateRange: { from: Date; to: Date };
}

const areas = [
  { id: 'products' as AreaType, label: 'Productos', icon: Package },
  { id: 'zones' as AreaType, label: 'Zonas', icon: MapPin },
  { id: 'clients' as AreaType, label: 'Clientes', icon: Users },
  { id: 'sellers' as AreaType, label: 'Vendedores', icon: UserCheck },
  { id: 'executive' as AreaType, label: 'Ejecutivo', icon: LayoutDashboard },
];

export function AnalysisCenterLayout({ 
  invoices, 
  clients, 
  products, 
  sellers, 
  dateRange 
}: AnalysisCenterLayoutProps) {
  const [activeArea, setActiveArea] = useState<AreaType>('products');
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);

  const analytics = useAnalyticsData({
    invoices,
    clients,
    products,
    sellers,
    dateRange,
    selectedProvince: activeArea === 'zones' ? selectedProvince : null,
  });

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-280px)] min-h-[600px]">
      {/* Sidebar Navigation */}
      <nav className="lg:w-48 shrink-0">
        <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
          {areas.map((area) => {
            const Icon = area.icon;
            const isActive = activeArea === area.id;
            return (
              <Button
                key={area.id}
                variant={isActive ? 'default' : 'ghost'}
                className={cn(
                  'justify-start gap-2 shrink-0 lg:w-full',
                  isActive && 'bg-primary text-primary-foreground shadow-md'
                )}
                onClick={() => {
                  setActiveArea(area.id);
                  if (area.id !== 'zones') {
                    setSelectedProvince(null);
                  }
                }}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{area.label}</span>
              </Button>
            );
          })}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 overflow-hidden">
        {activeArea === 'products' && (
          <ProductsArea 
            productMetrics={analytics.productMetrics}
            totalNetRevenue={analytics.totalNetRevenue}
            totalSoldUnits={analytics.totalSoldUnits}
            totalGiftedUnits={analytics.totalGiftedUnits}
            totalGiftValue={analytics.totalGiftValue}
          />
        )}
        {activeArea === 'zones' && (
          <ZonesArea 
            provinceMetrics={analytics.provinceMetrics}
            selectedProvince={selectedProvince}
            onSelectProvince={setSelectedProvince}
          />
        )}
        {activeArea === 'clients' && (
          <ClientsArea clientMetrics={analytics.clientMetrics} />
        )}
        {activeArea === 'sellers' && (
          <SellersArea sellerMetrics={analytics.sellerMetrics} />
        )}
        {activeArea === 'executive' && (
          <ExecutivePanel 
            totalNetRevenue={analytics.totalNetRevenue}
            totalSoldUnits={analytics.totalSoldUnits}
            totalGiftedUnits={analytics.totalGiftedUnits}
            totalGiftValue={analytics.totalGiftValue}
            anomalies={analytics.anomalies}
          />
        )}
      </main>
    </div>
  );
}
