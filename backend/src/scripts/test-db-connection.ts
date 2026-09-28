import dotenv from 'dotenv';
import path from 'path';

// Carrega .env da raiz do projeto ou do backend
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

import { createClient } from '@supabase/supabase-js';

async function verifyConnection() {
  console.log('--- Testando Conexão com o Banco Supabase ---');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('seu-projeto')) {
    console.error('❌ ERRO: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados corretamente no .env');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // 1. Testa tabela usuarios
    const { data: users, error: userError } = await supabase.from('usuarios').select('id, nome, email, ativo');
    if (userError) {
      throw new Error(`Erro na tabela usuarios: ${userError.message}`);
    }
    console.log(`✓ Conexão com o Supabase OK!`);
    console.log(`✓ Tabela 'usuarios': ${users?.length || 0} usuário(s) encontrado(s)`);
    if (users && users.length > 0) {
      users.forEach((u) => console.log(`   - ${u.nome} (${u.email}) [Ativo: ${u.ativo}]`));
    }

    // 2. Testa tabela clientes
    const { data: clientes, error: clienteError } = await supabase.from('clientes').select('id');
    if (clienteError) {
      throw new Error(`Erro na tabela clientes: ${clienteError.message}`);
    }
    console.log(`✓ Tabela 'clientes': OK (${clientes?.length || 0} cadastrados)`);

    // 3. Testa tabela vendas
    const { data: vendas, error: vendaError } = await supabase.from('vendas').select('id');
    if (vendaError) {
      throw new Error(`Erro na tabela vendas: ${vendaError.message}`);
    }
    console.log(`✓ Tabela 'vendas': OK (${vendas?.length || 0} cadastradas)`);

    // 4. Testa tabela historico_mensagens
    const { data: historico, error: histError } = await supabase.from('historico_mensagens').select('id');
    if (histError) {
      throw new Error(`Erro na tabela historico_mensagens: ${histError.message}`);
    }
    console.log(`✓ Tabela 'historico_mensagens': OK (${historico?.length || 0} registros)`);

    console.log('\n🎉 SUCESSO TOTAL! Todas as tabelas e credenciais do Supabase estão funcionando perfeitamente!');
  } catch (error: any) {
    console.error('❌ Falha ao verificar banco de dados:', error.message);
    process.exit(1);
  }
}

verifyConnection();
