import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  Package, 
  ShoppingCart,
  AlertTriangle,
  DollarSign
} from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

const Dashboard = () => {
  const [metrics, setMetrics] = useState({
    totalVendas: 0,
    totalCompras: 0,
    lucroLiquido: 0,
    produtosEstoqueBaixo: 0,
    produtosVencendo: 0,
  });
  const [topProdutos, setTopProdutos] = useState<any[]>([]);
  const [vendasMensais, setVendasMensais] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Métricas gerais
      const hoje = new Date();
      const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

      const { data: vendas } = await supabase
        .from('vendas')
        .select('total, lucro')
        .gte('data_venda', primeiroDiaMes.toISOString());

      const { data: compras } = await supabase
        .from('compras')
        .select('total')
        .gte('data_compra', primeiroDiaMes.toISOString());

      const totalVendas = vendas?.reduce((sum, v) => sum + Number(v.total), 0) || 0;
      const totalCompras = compras?.reduce((sum, c) => sum + Number(c.total), 0) || 0;
      const lucroLiquido = vendas?.reduce((sum, v) => sum + Number(v.lucro || 0), 0) || 0;

      // Produtos com estoque baixo
      const { data: allProdutos } = await supabase
        .from('produtos')
        .select('quantidade, quantidade_minima');
      
      const produtosEstoqueBaixo = allProdutos?.filter(
        p => p.quantidade <= p.quantidade_minima
      ) || [];

      // Produtos vencendo em 30 dias
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() + 30);
      
      const { data: produtosVencendo } = await supabase
        .from('produtos')
        .select('validade')
        .lte('validade', dataLimite.toISOString().split('T')[0])
        .gte('validade', hoje.toISOString().split('T')[0]);

      // Top 5 produtos mais vendidos
      const { data: topVendas } = await supabase
        .from('vendas')
        .select('produto_id, quantidade, produtos(nome)')
        .gte('data_venda', primeiroDiaMes.toISOString());

      const produtosMap = new Map();
      topVendas?.forEach((venda: any) => {
        const id = venda.produto_id;
        const nome = venda.produtos?.nome || 'Produto';
        const qtd = venda.quantidade;
        
        if (produtosMap.has(id)) {
          produtosMap.set(id, {
            nome,
            quantidade: produtosMap.get(id).quantidade + qtd,
          });
        } else {
          produtosMap.set(id, { nome, quantidade: qtd });
        }
      });

      const topProdutosArray = Array.from(produtosMap.values())
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, 5);

      // Vendas dos últimos 7 dias
      const vendasDiarias = [];
      for (let i = 6; i >= 0; i--) {
        const data = new Date();
        data.setDate(data.getDate() - i);
        const dataStr = data.toISOString().split('T')[0];
        
        const { data: vendasDia } = await supabase
          .from('vendas')
          .select('total')
          .gte('data_venda', dataStr)
          .lt('data_venda', new Date(data.getTime() + 86400000).toISOString().split('T')[0]);
        
        const total = vendasDia?.reduce((sum, v) => sum + Number(v.total), 0) || 0;
        
        vendasDiarias.push({
          dia: data.toLocaleDateString('pt-BR', { weekday: 'short' }),
          valor: total,
        });
      }

      setMetrics({
        totalVendas,
        totalCompras,
        lucroLiquido,
        produtosEstoqueBaixo: produtosEstoqueBaixo.length,
        produtosVencendo: produtosVencendo?.length || 0,
      });
      setTopProdutos(topProdutosArray);
      setVendasMensais(vendasDiarias);
      
    } catch (error: any) {
      toast.error('Erro ao carregar dados do dashboard');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do sistema</p>
      </div>

      {/* Cards de métricas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendas (Mês)</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {metrics.totalVendas.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-secondary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compras (Mês)</CardTitle>
            <TrendingDown className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {metrics.totalCompras.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-success">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lucro Líquido</CardTitle>
            <DollarSign className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              R$ {metrics.lucroLiquido.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-warning">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                <span className="text-sm">{metrics.produtosEstoqueBaixo} estoque baixo</span>
              </div>
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                <span className="text-sm">{metrics.produtosVencendo} vencendo</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Vendas - Últimos 7 Dias</CardTitle>
            <CardDescription>Evolução diária das vendas</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={vendasMensais}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="dia" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 'var(--radius)',
                  }}
                  formatter={(value: any) => `R$ ${Number(value).toFixed(2)}`}
                />
                <Line 
                  type="monotone" 
                  dataKey="valor" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top 5 Produtos</CardTitle>
            <CardDescription>Mais vendidos no mês</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProdutos} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" className="text-xs" />
                <YAxis dataKey="nome" type="category" width={100} className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 'var(--radius)',
                  }}
                />
                <Bar 
                  dataKey="quantidade" 
                  fill="hsl(var(--chart-2))" 
                  radius={[0, 8, 8, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
