import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Plus, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { z } from 'zod';

const vendaSchema = z.object({
  produto_id: z.string().uuid(),
  quantidade: z.number().int().min(1),
  preco_unitario: z.number().min(0),
});

const Vendas = () => {
  const { profile } = useAuth();
  const [vendas, setVendas] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedVenda, setSelectedVenda] = useState<any>(null);

  const [formData, setFormData] = useState({
    produto_id: '',
    quantidade: '',
    preco_unitario: '',
    observacoes: '',
  });

  useEffect(() => {
    loadProdutos();
    loadVendas();
  }, []);

  const loadProdutos = async () => {
    const { data } = await supabase
      .from('produtos')
      .select('*')
      .gt('quantidade', 0)
      .order('nome');
    if (data) setProdutos(data);
  };

  const loadVendas = async () => {
    const { data } = await supabase
      .from('vendas')
      .select('*, produtos(nome, codigo), profiles(nome)')
      .order('data_venda', { ascending: false });
    if (data) setVendas(data);
  };

  const handleProdutoChange = (produtoId: string) => {
    const produto = produtos.find((p) => p.id === produtoId);
    setFormData({
      ...formData,
      produto_id: produtoId,
      preco_unitario: produto ? produto.preco_venda : '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const data = {
        produto_id: formData.produto_id,
        quantidade: parseInt(formData.quantidade),
        preco_unitario: parseFloat(formData.preco_unitario),
        user_id: profile.id,
        observacoes: formData.observacoes || null,
      };

      vendaSchema.parse(data);

      // Verificar estoque
      const produto = produtos.find((p) => p.id === data.produto_id);
      if (!produto || produto.quantidade < data.quantidade) {
        toast.error('Estoque insuficiente para esta venda');
        return;
      }

      setLoading(true);

      const { error } = await supabase.from('vendas').insert([data]);

      if (error) throw error;

      toast.success('Venda registrada com sucesso!');
      setDialogOpen(false);
      resetForm();
      loadVendas();
      loadProdutos();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error('Erro ao registrar venda: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      produto_id: '',
      quantidade: '',
      preco_unitario: '',
      observacoes: '',
    });
  };

  const gerarRecibo = (venda: any) => {
    const reciboHTML = `
      <html>
        <head>
          <title>Recibo de Venda</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .info { margin: 10px 0; }
            .total { font-size: 20px; font-weight: bold; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>FarmaSystem</h1>
            <h2>Recibo de Venda</h2>
          </div>
          <div class="info"><strong>Data:</strong> ${format(new Date(venda.data_venda), 'dd/MM/yyyy HH:mm')}</div>
          <div class="info"><strong>Produto:</strong> ${venda.produtos?.nome} (${venda.produtos?.codigo})</div>
          <div class="info"><strong>Quantidade:</strong> ${venda.quantidade}</div>
          <div class="info"><strong>Preço Unitário:</strong> R$ ${Number(venda.preco_unitario).toFixed(2)}</div>
          <div class="total">Total: R$ ${Number(venda.total).toFixed(2)}</div>
          <div class="info" style="margin-top: 20px;"><strong>Vendedor:</strong> ${venda.profiles?.nome}</div>
          ${venda.observacoes ? `<div class="info"><strong>Observações:</strong> ${venda.observacoes}</div>` : ''}
        </body>
      </html>
    `;

    const novaJanela = window.open('', '_blank');
    if (novaJanela) {
      novaJanela.document.write(reciboHTML);
      novaJanela.document.close();
      novaJanela.print();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Vendas</h1>
          <p className="text-muted-foreground">Registrar e gerenciar vendas</p>
        </div>

        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Venda
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Venda</DialogTitle>
              <DialogDescription>
                Preencha os dados da venda
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="produto">Produto *</Label>
                <Select
                  value={formData.produto_id}
                  onValueChange={handleProdutoChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {produtos.map((produto) => (
                      <SelectItem key={produto.id} value={produto.id}>
                        {produto.nome} - Estoque: {produto.quantidade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantidade">Quantidade *</Label>
                <Input
                  id="quantidade"
                  type="number"
                  min="1"
                  value={formData.quantidade}
                  onChange={(e) =>
                    setFormData({ ...formData, quantidade: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="preco_unitario">Preço Unitário *</Label>
                <Input
                  id="preco_unitario"
                  type="number"
                  step="0.01"
                  value={formData.preco_unitario}
                  onChange={(e) =>
                    setFormData({ ...formData, preco_unitario: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Input
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) =>
                    setFormData({ ...formData, observacoes: e.target.value })
                  }
                />
              </div>

              {formData.quantidade && formData.preco_unitario && (
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">Total da Venda</p>
                  <p className="text-2xl font-bold text-primary">
                    R${' '}
                    {(
                      parseFloat(formData.quantidade) *
                      parseFloat(formData.preco_unitario)
                    ).toFixed(2)}
                  </p>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Registrando...' : 'Registrar Venda'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Quantidade</TableHead>
              <TableHead>Preço Unit.</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Lucro</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendas.map((venda) => (
              <TableRow key={venda.id}>
                <TableCell>
                  {format(new Date(venda.data_venda), 'dd/MM/yyyy HH:mm')}
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{venda.produtos?.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      {venda.produtos?.codigo}
                    </p>
                  </div>
                </TableCell>
                <TableCell>{venda.quantidade}</TableCell>
                <TableCell>R$ {Number(venda.preco_unitario).toFixed(2)}</TableCell>
                <TableCell className="font-medium">
                  R$ {Number(venda.total).toFixed(2)}
                </TableCell>
                <TableCell className="text-success font-medium">
                  R$ {Number(venda.lucro || 0).toFixed(2)}
                </TableCell>
                <TableCell>{venda.profiles?.nome}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => gerarRecibo(venda)}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {vendas.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhuma venda registrada</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Vendas;
