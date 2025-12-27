import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { 
  Zap, MapPin, BarChart3, User, Calendar as CalendarIcon, Gift
} from 'lucide-react';
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Invoice } from '@/hooks/useInvoices';
import { Client } from '@/hooks/useClients';
import { Product } from '@/hooks/useProducts';
import { Seller } from '@/hooks/useSellers';
import { VentoView } from './VentoView';
import { InteractiveMap } from './InteractiveMap';
import { ProductAnalysis } from './ProductAnalysis';
import { ClientAnalysis } from './ClientAnalysis';
import { GiftMarginAnalysis } from './GiftMarginAnalysis';

type DatePreset = 'today' | '7d' | '30d' | 'month' | 'lastMonth' | 'custom';

interface SalesAnalysisDashboardProps {
  invoices: Invoice[];
  clients: Client[];
  products: Product[];
  sellers: Seller[];
}

export function SalesAnalysisDashboard({ invoices, clients, products, sellers }: SalesAnalysisDashboardProps) {
  const [datePreset, setDatePreset] = useState<DatePreset>('30d');
  const [customRange, setCustomRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ 
    from: undefined, 
    to: undefined 
  });
  const [selectedClientFromMap, setSelectedClientFromMap] = useState<Client | null>(null);
  const [activeTab, setActiveTab] = useState('ventoview');

  // Calculate date range based on preset
  const getDateRange = () => {
    const now = new Date();
    switch (datePreset) {
      case 'today':
        return { from: startOfDay(now), to: endOfDay(now) };
      case '7d':
        return { from: startOfDay(subDays(now, 7)), to: endOfDay(now) };
      case '30d':
        return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
      case 'month':
        return { from: startOfMonth(now), to: endOfMonth(now) };
      case 'lastMonth':
        const lastMonth = subMonths(now, 1);
        return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
      case 'custom':
        if (customRange.from && customRange.to) {
          return { from: startOfDay(customRange.from), to: endOfDay(customRange.to) };
        }
        return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
      default:
        return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
    }
  };

  const dateRange = getDateRange();

  const handleClientSelectFromMap = (client: Client) => {
    setSelectedClientFromMap(client);
    setActiveTab('clients');
  };

  const handlePresetChange = (value: DatePreset) => {
    setDatePreset(value);
    if (value !== 'custom') {
      setCustomRange({ from: undefined, to: undefined });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Centro de Análisis</h2>
          <p className="text-muted-foreground">Inteligencia comercial para decisiones estratégicas</p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={datePreset} onValueChange={handlePresetChange}>
            <SelectTrigger className="w-44">
              <CalendarIcon className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="7d">Últimos 7 días</SelectItem>
              <SelectItem value="30d">Últimos 30 días</SelectItem>
              <SelectItem value="month">Mes actual</SelectItem>
              <SelectItem value="lastMonth">Mes anterior</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>

          {datePreset === 'custom' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {customRange.from && customRange.to 
                    ? `${format(customRange.from, 'dd/MM/yy')} - ${format(customRange.to, 'dd/MM/yy')}`
                    : 'Seleccionar fechas'
                  }
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={{ from: customRange.from, to: customRange.to }}
                  onSelect={(range) => setCustomRange({ from: range?.from, to: range?.to })}
                  numberOfMonths={2}
                  locale={es}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 h-12 p-1 bg-muted rounded-xl">
          <TabsTrigger value="ventoview" className="gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">VentoView</span>
          </TabsTrigger>
          <TabsTrigger value="gifts" className="gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Gift className="h-4 w-4" />
            <span className="hidden sm:inline">Regalos</span>
          </TabsTrigger>
          <TabsTrigger value="map" className="gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <MapPin className="h-4 w-4" />
            <span className="hidden sm:inline">Mapa</span>
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Productos</span>
          </TabsTrigger>
          <TabsTrigger value="clients" className="gap-2 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Clientes</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ventoview">
          <VentoView 
            invoices={invoices} 
            clients={clients} 
            products={products} 
            dateRange={dateRange}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        </TabsContent>

        <TabsContent value="gifts">
          <GiftMarginAnalysis 
            invoices={invoices} 
            products={products} 
            sellers={sellers}
            dateRange={dateRange}
          />
        </TabsContent>

        <TabsContent value="map">
          <InteractiveMap 
            invoices={invoices} 
            clients={clients} 
            products={products} 
            dateRange={dateRange}
            onClientSelect={handleClientSelectFromMap}
          />
        </TabsContent>

        <TabsContent value="products">
          <ProductAnalysis 
            invoices={invoices} 
            products={products} 
            dateRange={dateRange} 
          />
        </TabsContent>

        <TabsContent value="clients">
          <ClientAnalysis 
            invoices={invoices} 
            clients={clients} 
            products={products} 
            dateRange={dateRange}
            initialClient={selectedClientFromMap}
            onClose={() => setSelectedClientFromMap(null)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
