import dotenv from 'dotenv';
dotenv.config();

import { getSupabaseClient } from '../config/supabase.js';
import { SupabaseUserRepository } from '../repositories/supabase-user.repository.js';
import { AuthService } from '../services/auth.service.js';

async function seed() {
  console.log('--- Iniciando Seed dos Usuários Iniciais ---');

  try {
    const supabase = getSupabaseClient();
    const userRepo = new SupabaseUserRepository(supabase);
    const authService = new AuthService(userRepo, process.env.JWT_SECRET || 'secret');

    const defaultUsers = [
      {
        nome: 'Dono da Empresa',
        email: 'admin@flowzap.com',
        senha: 'FlowZap@2026',
      },
      {
        nome: 'Sócio / Parceiro',
        email: 'socio@flowzap.com',
        senha: 'FlowZap@2026',
      },
    ];

    for (const u of defaultUsers) {
      const existing = await userRepo.findByEmail(u.email);
      if (existing) {
        console.log(`Usuário [${u.email}] já existe no banco. Pulando.`);
        continue;
      }

      const hash = await authService.hashPassword(u.senha);
      await userRepo.create({
        nome: u.nome,
        email: u.email,
        senha_hash: hash,
        ativo: true,
      });

      console.log(`✓ Usuário criado com sucesso: ${u.email} (Senha inicial: ${u.senha})`);
    }

    console.log('--- Seed finalizado com sucesso! ---');
  } catch (error) {
    console.error('Erro ao executar seed:', error);
    process.exit(1);
  }
}

seed();
