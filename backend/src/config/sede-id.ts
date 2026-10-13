import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Identidade desta instalação, usada pela trava de sede única. O identificador é criado na
 * primeira execução e fica em `backend/.sede-id` (ou SEDE_ID_FILE); o nome é o do computador.
 */
export function loadSedeIdentity(): { id: string; nome: string } {
  const file = path.resolve(process.env.SEDE_ID_FILE || path.join(process.cwd(), '.sede-id'));

  let id = '';
  try {
    id = fs.readFileSync(file, 'utf8').trim();
  } catch {
    // Primeira execução nesta máquina
  }

  if (!UUID.test(id)) {
    id = randomUUID();
    try {
      fs.writeFileSync(file, `${id}\n`);
    } catch {
      // Sem conseguir gravar, o identificador vale só para esta execução
    }
  }

  return { id, nome: os.hostname() };
}
