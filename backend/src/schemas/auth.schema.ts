import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email({ message: 'Email inválido' }),
  senha: z.string().min(6, { message: 'A senha deve ter no mínimo 6 caracteres' }),
});

export type LoginDTO = z.infer<typeof LoginSchema>;

export const CreateUserSchema = z.object({
  nome: z.string().trim().min(2, { message: 'O nome deve ter no mínimo 2 caracteres' }),
  email: z.string().trim().toLowerCase().email({ message: 'Email inválido' }),
  senha: z.string().min(6, { message: 'A senha deve ter no mínimo 6 caracteres' }),
  ativo: z.boolean().default(true),
});

export type CreateUserDTO = z.infer<typeof CreateUserSchema>;
