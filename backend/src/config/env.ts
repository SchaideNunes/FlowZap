import dotenv from 'dotenv';
import path from 'path';

// Carrega .env da raiz do projeto ou da pasta backend.
// Deve ser o primeiro import de index.ts: imports ES são avaliados antes do corpo do
// módulo, então chamar dotenv.config() direto em index.ts rodaria depois de createApp().
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config();
