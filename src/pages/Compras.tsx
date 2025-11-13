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
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { z } from 'zod';

const compraSchema = z.object({
  produto_id: z.string().uuid(),
  fornecedor_id: z.string().uuid().optional(),
  quantidade: z.number().int().min(1),
  preco_unitario: z.number().min(0),
});

const Compras = () => {
  const { profile } = useAuth();
  const [compras, setCompras] = useState<any[]>([]);
  const [produtos, setProdutos] = useState<any[]>([]);
  const [fornecedores, setFornecedores] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    produto_id: '',
    fornecedor_id: '',
    quantidade: '',
    preco_unitario: '',
    observacoes: '',
  });

  useEffect(() => {
    loadProdutos();
    loadFornecedores();
    loadCompras();
  }, []);

  const loadProdutos = async () => {
    const { data } = await supabase.from('produtos').select('*').order('nome');
    if (data) setProdutos(data);
  };

  const loadFornecedores = async () => {
    const { data } = await supabase.from('fornecedores').select('*').order('nome');
    if (data) setFornecedores(data);
  };

  const loadCompras = async () => {
    const { data } = await supabase
      .from('compras')
      .select('*, produtos(nome, codigo), fornecedores(nome), profiles(nome)')
      .order('data_compra', { ascending: false });
    if (data) setCompras(data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const data = {
        produto_id: formData.produto_id,
        fornecedor_id: formData.fornecedor_id || null,
        quantidade: parseInt(formData.quantidade),
        preco_unitario: parseFloat(formData.preco_unitario),
        user_id: profile.id,
        observacoes: formData.observacoes || null,
      };

      compraSchema.parse(data);
      setLoading(true);

      const { error } = await supabase.from('compras').insert([data]);

      if (error) throw error;

      toast.success('Compra registrada! Estoque atualizado.');
      setDialogOpen(false);
      resetForm();
      loadCompras();
      loadProdutos();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error('Erro ao registrar compra: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      produto_id: '',
      fornecedor_id: '',
      quantidade: '',
      preco_unitario: '',
      observacoes: '',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Compras</h1>
          <p className="text-muted-foreground">Registrar entrada de produtos</p>
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
              Nova Compra
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar Compra</DialogTitle>
              <DialogDescription>
                Registre a entrada de produtos no estoque
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="produto">Produto *</Label>
                <Select
                  value={formData.produto_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, produto_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {produtos.map((produto) => (
                      <SelectItem key={produto.id} value={produto.id}>
                        {produto.nome} ({produto.codigo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fornecedor">Fornecedor</Label>
                <Select
                  value={formData.fornecedor_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, fornecedor_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {fornecedores.map((fornecedor) => (
                      <SelectItem key={fornecedor.id} value={fornecedor.id}>
                        {fornecedor.nome}
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
                  <p className="text-sm text-muted-foreground">Total da Compra</p>
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
                  {loading ? 'Registrando...' : 'Registrar Compra'}
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
              <TableHead>Fornecedor</TableHead>
              <TableHead>Quantidade</TableHead>
              <TableHead>Preço Unit.</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Responsável</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {compras.map((compra) => (
              <TableRow key={compra.id}>
                <TableCell>
                  {format(new Date(compra.data_compra), 'dd/MM/yyyy HH:mm')}
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{compra.produtos?.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      {compra.produtos?.codigo}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  {compra.fornecedores?.nome || '-'}
                </TableCell>
                <TableCell>{compra.quantidade}</TableCell>
                <TableCell>R$ {Number(compra.preco_unitario).toFixed(2)}</TableCell>
                <TableCell className="font-medium">
                  R$ {Number(compra.total).toFixed(2)}
                </TableCell>
                <TableCell>{compra.profiles?.nome}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {compras.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhuma compra registrada</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Compras;
