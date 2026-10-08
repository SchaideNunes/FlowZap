import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../services/api.js';
import { Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';
import { extractErrorMessage } from '../utils/error.js';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
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
      setError(extractErrorMessage(err, 'Falha ao autenticar. Verifique o email e senha.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="card login-card">
        <div className="login-brand">
          <img src="/logo.webp" alt="A&V Store" className="login-logo" width={96} height={96} />
          <h1 className="login-title">{'A&V Store'}</h1>
          <p className="login-subtitle">Gestão de cobranças · FlowZap</p>
        </div>

        {error && (
          <div className="alert alert-danger" role="alert">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">
              E-mail
            </label>
            <div className="input-with-icon">
              <input
                id="login-email"
                type="email"
                className="form-input"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
              />
              <Mail size={16} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-senha">
              Senha
            </label>
            <div className="input-with-icon">
              <input
                id="login-senha"
                type="password"
                className="form-input"
                required
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Sua senha"
              />
              <Lock size={16} />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-lg btn-block" style={{ marginTop: '0.5rem' }} disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>
      </div>
    </div>
  );
};
