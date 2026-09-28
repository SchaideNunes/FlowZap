import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { MessageSquare, Lock, Mail, ArrowRight } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('aevcelulares@outlook.com');
  const [senha, setSenha] = useState('AEVStore@123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/auth/login', { email, senha });
      login(response.data.token, response.data.user);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Falha ao autenticar. Verifique o email e senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background: 'radial-gradient(ellipse at top, #141f32 0%, #0b0f17 70%)',
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: '440px',
          width: '100%',
          padding: '2.25rem',
          boxShadow: 'var(--shadow-lg)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div
            className="brand-icon"
            style={{ width: '48px', height: '48px', margin: '0 auto 1rem auto' }}
          >
            <MessageSquare size={26} />
          </div>
          <h1 style={{ fontSize: '1.65rem', marginBottom: '0.35rem' }}>AEV Celulares</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            FlowZap • Cobranças Recorrentes via WhatsApp
          </p>
        </div>

        {error && (
          <div
            style={{
              color: 'var(--danger)',
              fontSize: '0.85rem',
              marginBottom: '1.25rem',
              background: 'var(--danger-light)',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email de Acesso</label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                className="form-input"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu-email@flowzap.com"
                style={{ paddingLeft: '2.5rem' }}
              />
              <Mail
                size={16}
                color="var(--text-dim)"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Senha</label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                className="form-input"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Sua senha"
                style={{ paddingLeft: '2.5rem' }}
              />
              <Lock
                size={16}
                color="var(--text-dim)"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: '0.75rem' }}
            disabled={loading}
          >
            {loading ? 'Entrando...' : 'Entrar no Painel'}
            <ArrowRight size={18} />
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          Banco de Dados em Nuvem (Supabase) • Sede Local
        </div>
      </div>
    </div>
  );
};
