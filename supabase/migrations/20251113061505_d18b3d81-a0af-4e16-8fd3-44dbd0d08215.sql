-- Criar tabela de perfis de usuários
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'vendedor' CHECK (role IN ('admin', 'vendedor')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS na tabela profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para profiles
CREATE POLICY "Usuários podem ver seu próprio perfil" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Usuários podem atualizar seu próprio perfil" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Trigger para criar perfil automaticamente ao registrar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', 'Usuário'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'vendedor')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Tabela de categorias de produtos
CREATE TABLE public.categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver categorias" ON public.categorias
  FOR SELECT USING (true);

CREATE POLICY "Admins podem gerenciar categorias" ON public.categorias
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Inserir categorias padrão
INSERT INTO public.categorias (nome) VALUES
  ('Medicamentos'),
  ('Genéricos'),
  ('Cosméticos'),
  ('Higiene'),
  ('Suplementos'),
  ('Outros');

-- Tabela de produtos
CREATE TABLE public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  codigo TEXT UNIQUE NOT NULL,
  categoria_id UUID REFERENCES public.categorias(id),
  preco_compra DECIMAL(10,2) NOT NULL CHECK (preco_compra >= 0),
  preco_venda DECIMAL(10,2) NOT NULL CHECK (preco_venda >= 0),
  quantidade INTEGER NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  quantidade_minima INTEGER DEFAULT 10,
  validade DATE NOT NULL,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados podem ver produtos" ON public.produtos
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins podem gerenciar produtos" ON public.produtos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Índice para busca rápida
CREATE INDEX idx_produtos_codigo ON public.produtos(codigo);
CREATE INDEX idx_produtos_validade ON public.produtos(validade);
CREATE INDEX idx_produtos_quantidade ON public.produtos(quantidade);

-- Tabela de fornecedores
CREATE TABLE public.fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  contato TEXT,
  telefone TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados podem ver fornecedores" ON public.fornecedores
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins podem gerenciar fornecedores" ON public.fornecedores
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Tabela de compras
CREATE TABLE public.compras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id UUID REFERENCES public.fornecedores(id),
  produto_id UUID REFERENCES public.produtos(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  preco_unitario DECIMAL(10,2) NOT NULL CHECK (preco_unitario >= 0),
  total DECIMAL(10,2) GENERATED ALWAYS AS (quantidade * preco_unitario) STORED,
  data_compra TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados podem ver compras" ON public.compras
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem criar compras" ON public.compras
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Tabela de vendas
CREATE TABLE public.vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID REFERENCES public.produtos(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  preco_unitario DECIMAL(10,2) NOT NULL CHECK (preco_unitario >= 0),
  total DECIMAL(10,2) GENERATED ALWAYS AS (quantidade * preco_unitario) STORED,
  lucro DECIMAL(10,2),
  data_venda TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados podem ver vendas" ON public.vendas
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem criar vendas" ON public.vendas
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Trigger para atualizar estoque após compra
CREATE OR REPLACE FUNCTION public.atualizar_estoque_compra()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.produtos
  SET quantidade = quantidade + NEW.quantidade,
      updated_at = NOW()
  WHERE id = NEW.produto_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_atualizar_estoque_compra
  AFTER INSERT ON public.compras
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_estoque_compra();

-- Trigger para atualizar estoque e calcular lucro após venda
CREATE OR REPLACE FUNCTION public.atualizar_estoque_venda()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  preco_compra_produto DECIMAL(10,2);
BEGIN
  -- Buscar preço de compra do produto
  SELECT preco_compra INTO preco_compra_produto
  FROM public.produtos
  WHERE id = NEW.produto_id;
  
  -- Calcular lucro
  NEW.lucro := (NEW.preco_unitario - preco_compra_produto) * NEW.quantidade;
  
  -- Atualizar estoque
  UPDATE public.produtos
  SET quantidade = quantidade - NEW.quantidade,
      updated_at = NOW()
  WHERE id = NEW.produto_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_atualizar_estoque_venda
  BEFORE INSERT ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_estoque_venda();

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_produtos_updated_at
  BEFORE UPDATE ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- View para produtos com alertas
CREATE OR REPLACE VIEW public.produtos_com_alertas AS
SELECT 
  p.*,
  c.nome as categoria_nome,
  CASE 
    WHEN p.quantidade <= p.quantidade_minima THEN 'estoque_baixo'
    WHEN p.validade <= CURRENT_DATE + INTERVAL '30 days' THEN 'validade_proxima'
    ELSE 'ok'
  END as status_alerta
FROM public.produtos p
LEFT JOIN public.categorias c ON p.categoria_id = c.id;