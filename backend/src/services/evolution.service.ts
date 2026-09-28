import axios, { AxiosInstance } from 'axios';

export interface EvolutionConfig {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
}

export interface ConnectionStatus {
  state: 'open' | 'connecting' | 'close' | 'refused' | 'unknown';
  qrcode?: string | null;
}

export class EvolutionService {
  private http: AxiosInstance;
  private instanceName: string;

  constructor(config: EvolutionConfig) {
    this.instanceName = config.instanceName;
    this.http = axios.create({
      baseURL: config.baseUrl.replace(/\/$/, ''),
      headers: {
        apikey: config.apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });
  }

  /**
   * Consulta o estado atual da conexão da instância
   */
  async checkInstanceStatus(): Promise<ConnectionStatus> {
    try {
      const response = await this.http.get(`/instance/connectionState/${this.instanceName}`);
      const state = response.data?.instance?.state || response.data?.state || 'unknown';
      return { state };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return { state: 'close' };
      }
      return { state: 'unknown' };
    }
  }

  /**
   * Obtém QR Code para conectar a instância caso esteja desconectada
   */
  async getQrCode(): Promise<{ pairingCode?: string; qrcode?: string; state: string }> {
    try {
      const response = await this.http.get(`/instance/connect/${this.instanceName}`);
      const data = response.data;
      return {
        qrcode: data?.base64 || data?.qrcode?.base64 || null,
        pairingCode: data?.pairingCode || null,
        state: data?.state || 'connecting',
      };
    } catch {
      // Se a instância não existir, cria a instância primeiro
      return this.createAndConnectInstance();
    }
  }

  /**
   * Cria a instância se ainda não existir e retorna o QR Code
   */
  async createAndConnectInstance(): Promise<{ qrcode?: string; state: string }> {
    try {
      const response = await this.http.post('/instance/create', {
        instanceName: this.instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      });
      const data = response.data;
      return {
        qrcode: data?.qrcode?.base64 || null,
        state: 'connecting',
      };
    } catch (err: any) {
      throw new Error(`Falha ao criar instância na Evolution API: ${err.message}`);
    }
  }

  /**
   * Simula a presença "digitando..." ou "gravando áudio..." (Anti-Ban)
   */
  async sendPresence(whatsapp: string, presence: 'composing' | 'recording' | 'available' = 'composing'): Promise<boolean> {
    try {
      const cleanNumber = whatsapp.replace(/\D/g, '');
      await this.http.post(`/chat/sendPresence/${this.instanceName}`, {
        number: cleanNumber,
        presence,
        delay: 1200,
      });
      return true;
    } catch {
      // Falha de presença não deve travar o fluxo principal
      return false;
    }
  }

  /**
   * Envia mensagem de texto simples
   */
  async sendText(whatsapp: string, text: string): Promise<any> {
    const cleanNumber = whatsapp.replace(/\D/g, '');
    const response = await this.http.post(`/message/sendText/${this.instanceName}`, {
      number: cleanNumber,
      text,
    });
    return response.data;
  }
}
