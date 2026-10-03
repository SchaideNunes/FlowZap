export function extractErrorMessage(err: any, fallback = 'Ocorreu um erro inesperado.'): string {
  if (!err) return fallback;

  // Se a resposta da API (ou da Vercel) trouxer objeto ou string em `data.error`
  const apiError = err.response?.data?.error;
  if (typeof apiError === 'string' && apiError.trim()) {
    return apiError;
  }
  if (apiError && typeof apiError === 'object') {
    if (typeof apiError.message === 'string' && apiError.message.trim()) {
      return apiError.message;
    }
    if (typeof apiError.code === 'string' && apiError.code.trim()) {
      return `Erro do servidor: ${apiError.code}`;
    }
    try {
      return JSON.stringify(apiError);
    } catch {
      // Ignora erro de serialização
    }
  }

  // Se a resposta da API trouxer `data.message`
  const apiMessage = err.response?.data?.message;
  if (typeof apiMessage === 'string' && apiMessage.trim()) {
    return apiMessage;
  }

  // Se for erro de rede do Axios ou Error padrão do JS
  if (typeof err.message === 'string' && err.message.trim()) {
    if (err.message === 'Network Error') {
      return 'Erro de conexão: Servidor indisponível ou problema de rede.';
    }
    return err.message;
  }

  return fallback;
}
