import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

const configMock = vi.fn();

vi.mock('dotenv', () => ({
  default: { config: configMock },
}));

describe('config/env', () => {
  beforeEach(() => {
    configMock.mockClear();
    vi.resetModules();
  });

  it('carrega o .env da raiz do projeto, o da pasta backend e o padrão, nessa ordem', async () => {
    await import('./env.js');

    expect(configMock).toHaveBeenCalledTimes(3);
    expect(configMock).toHaveBeenNthCalledWith(1, {
      path: path.resolve(process.cwd(), '../.env'),
    });
    expect(configMock).toHaveBeenNthCalledWith(2, {
      path: path.resolve(process.cwd(), '.env'),
    });
    expect(configMock).toHaveBeenNthCalledWith(3);
  });
});
