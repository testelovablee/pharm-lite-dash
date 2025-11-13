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
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Search, AlertCircle, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { z } from 'zod';

const produtoSchema = z.object({
  nome: z.string().min(2).max(200),
  codigo: z.string().min(1).max(50),
  categoria_id: z.string().uuid(),
  preco_compra: z.number().min(0),
  preco_venda: z.number().min(0),
  quantidade: z.number().int().min(0),
  quantidade_minima: z.number().int().min(0),
  validade: z.string(),
  descricao: z.string().max(500).optional(),
});

const Produtos = () => {
  const { profile } = useAuth();
  const [produtos, setProdutos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduto, setEditingProduto] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    nome: '',
    codigo: '',
    categoria_id: '',
    preco_compra: '',
    preco_venda: '',
    quantidade: '',
    quantidade_minima: '10',
    validade: '',
    descricao: '',
  });

  useEffect(() => {
    loadCategorias();
    loadProdutos();
  }, []);

  const loadCategorias = async () => {
    const { data } = await supabase.from('categorias').select('*').order('nome');
    if (data) setCategorias(data);
  };

  const loadProdutos = async () => {
    const { data } = await supabase
      .from('produtos')
      .select('*, categorias(nome)')
      .order('nome');
    if (data) setProdutos(data);
  };

  const isAdmin = profile?.role === 'admin';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAdmin) {
      toast.error('Apenas administradores podem gerenciar produtos');
      return;
    }

    try {
      const data = {
        ...formData,
        preco_compra: parseFloat(formData.preco_compra),
        preco_venda: parseFloat(formData.preco_venda),
        quantidade: parseInt(formData.quantidade),
        quantidade_minima: parseInt(formData.quantidade_minima),
      };

      produtoSchema.parse(data);
      setLoading(true);

      if (editingProduto) {
        const { error } = await supabase
          .from('produtos')
          .update(data)
          .eq('id', editingProduto.id);

        if (error) throw error;
        toast.success('Produto atualizado!');
      } else {
        const { error } = await supabase.from('produtos').insert([data]);
        if (error) throw error;
        toast.success('Produto cadastrado!');
      }

      setDialogOpen(false);
      resetForm();
      loadProdutos();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error('Erro ao salvar produto');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) {
      toast.error('Apenas administradores podem excluir produtos');
      return;
    }

    if (!confirm('Tem certeza que deseja excluir este produto?')) return;

    const { error } = await supabase.from('produtos').delete().eq('id', id);

    if (error) {
      toast.error('Erro ao excluir produto');
    } else {
      toast.success('Produto excluído!');
      loadProdutos();
    }
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      codigo: '',
      categoria_id: '',
      preco_compra: '',
      preco_venda: '',
      quantidade: '',
      quantidade_minima: '10',
      validade: '',
      descricao: '',
    });
    setEditingProduto(null);
  };

  const openEditDialog = (produto: any) => {
    setEditingProduto(produto);
    setFormData({
      nome: produto.nome,
      codigo: produto.codigo,
      categoria_id: produto.categoria_id,
      preco_compra: produto.preco_compra,
      preco_venda: produto.preco_venda,
      quantidade: produto.quantidade,
      quantidade_minima: produto.quantidade_minima,
      validade: produto.validade,
      descricao: produto.descricao || '',
    });
    setDialogOpen(true);
  };

  const getStatusBadge = (produto: any) => {
    const hoje = new Date();
    const validade = new Date(produto.validade);
    const diasParaVencer = Math.ceil((validade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

    if (produto.quantidade <= produto.quantidade_minima) {
      return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Estoque Baixo</Badge>;
    }
    if (diasParaVencer <= 30 && diasParaVencer >= 0) {
      return <Badge className="bg-warning text-warning-foreground gap-1"><Calendar className="h-3 w-3" />Vencendo</Badge>;
    }
    if (diasParaVencer < 0) {
      return <Badge variant="destructive">Vencido</Badge>;
    }
    return null;
  };

  const filteredProdutos = produtos.filter((p) =>
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Produtos</h1>
          <p className="text-muted-foreground">Gerenciar estoque de produtos</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button disabled={!isAdmin}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Produto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProduto ? 'Editar Produto' : 'Novo Produto'}
              </DialogTitle>
              <DialogDescription>
                Preencha as informações do produto
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="codigo">Código *</Label>
                  <Input
                    id="codigo"
                    value={formData.codigo}
                    onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="categoria">Categoria *</Label>
                  <Select
                    value={formData.categoria_id}
                    onValueChange={(value) => setFormData({ ...formData, categoria_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {categorias.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="validade">Validade *</Label>
                  <Input
                    id="validade"
                    type="date"
                    value={formData.validade}
                    onChange={(e) => setFormData({ ...formData, validade: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preco_compra">Preço de Compra *</Label>
                  <Input
                    id="preco_compra"
                    type="number"
                    step="0.01"
                    value={formData.preco_compra}
                    onChange={(e) => setFormData({ ...formData, preco_compra: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preco_venda">Preço de Venda *</Label>
                  <Input
                    id="preco_venda"
                    type="number"
                    step="0.01"
                    value={formData.preco_venda}
                    onChange={(e) => setFormData({ ...formData, preco_venda: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantidade">Quantidade *</Label>
                  <Input
                    id="quantidade"
                    type="number"
                    value={formData.quantidade}
                    onChange={(e) => setFormData({ ...formData, quantidade: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantidade_minima">Quantidade Mínima *</Label>
                  <Input
                    id="quantidade_minima"
                    type="number"
                    value={formData.quantidade_minima}
                    onChange={(e) => setFormData({ ...formData, quantidade_minima: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Input
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredProdutos.map((produto) => (
          <Card key={produto.id} className="p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-semibold">{produto.nome}</h3>
                <p className="text-sm text-muted-foreground">
                  {produto.categorias?.nome} • {produto.codigo}
                </p>
              </div>
              {getStatusBadge(produto)}
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-muted-foreground">Estoque</p>
                <p className="font-medium">{produto.quantidade} un</p>
              </div>
              <div>
                <p className="text-muted-foreground">Validade</p>
                <p className="font-medium">
                  {format(new Date(produto.validade), 'dd/MM/yyyy')}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Compra</p>
                <p className="font-medium">R$ {Number(produto.preco_compra).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Venda</p>
                <p className="font-medium text-primary">
                  R$ {Number(produto.preco_venda).toFixed(2)}
                </p>
              </div>
            </div>

            {isAdmin && (
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => openEditDialog(produto)}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Editar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(produto.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>

      {filteredProdutos.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Nenhum produto encontrado</p>
        </div>
      )}
    </div>
  );
};

export default Produtos;
