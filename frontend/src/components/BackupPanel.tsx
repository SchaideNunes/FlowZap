import React, { useEffect, useState } from 'react';
import { FileText, Download } from 'lucide-react';
import { BackupSnapshot, BackupStatus } from '../types/index.js';
import { api } from '../services/api.js';
import { extractErrorMessage } from '../utils/error.js';
import { downloadBackupJson, downloadBackupPdf } from '../utils/backup-export.js';
import { formatDateBR, todayISO } from '../utils/format.js';

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Backup dos dados: mostra se a cópia automática da máquina-sede está em dia e deixa
 * baixar na hora o relatório em PDF e o arquivo completo.
 */
export const BackupPanel: React.FC = () => {
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [busy, setBusy] = useState<'pdf' | 'json' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get('/backup/status')
      .then((res) => setStatus(res.data))
      .catch(() => setStatus(null));
  }, []);

  const baixar = async (formato: 'pdf' | 'json') => {
    setBusy(formato);
    setError(null);
    try {
      const res = await api.get('/backup');
      const snapshot: BackupSnapshot = res.data;
      if (formato === 'pdf') await downloadBackupPdf(snapshot);
      else downloadBackupJson(snapshot);
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'Não foi possível gerar o backup.'));
    } finally {
      setBusy(null);
    }
  };

  const ultimo = status?.ultimo_backup_em ? new Date(status.ultimo_backup_em) : null;
  const emDia = ultimo ? Date.now() - ultimo.getTime() < 2 * DIA_MS : false;

  const selo = ultimo
    ? emDia
      ? { classe: 'badge-pago', ponto: 'dot-success', texto: 'Em dia' }
      : { classe: 'badge-avisado', ponto: 'dot-warning', texto: 'Atrasado' }
    : { classe: '', ponto: 'dot-neutral', texto: 'Sem registro' };

  const quando = ultimo
    ? `${formatDateBR(todayISO(ultimo))} às ${String(ultimo.getHours()).padStart(2, '0')}:${String(
        ultimo.getMinutes()
      ).padStart(2, '0')}`
    : null;

  return (
    <section className="card panel">
      <div className="panel-head">
        <h3 className="panel-title">Backup dos dados</h3>
        <span className={`badge ${selo.classe}`}>
          <span className={`status-dot ${selo.ponto}`} aria-hidden="true" />
          {selo.texto}
        </span>
      </div>

      <p className="panel-text">
        {quando
          ? `Última cópia automática: ${quando}, no computador da loja.`
          : 'O computador da loja guarda uma cópia dos dados todos os dias em que está ligado.'}{' '}
        {ultimo && !emDia && 'Ligue o computador da loja para atualizar a cópia. '}
        Baixe também uma cópia de vez em quando e guarde fora do computador (e-mail, pendrive ou nuvem).
      </p>

      {error && (
        <div className="form-hint is-danger" role="alert">
          {error}
        </div>
      )}

      <div className="panel-foot">
        <button className="btn btn-secondary btn-sm" onClick={() => baixar('pdf')} disabled={busy !== null}>
          <FileText size={15} />
          {busy === 'pdf' ? 'Gerando PDF...' : 'Baixar PDF'}
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => baixar('json')}
          disabled={busy !== null}
          title="Arquivo completo, usado para restaurar o sistema"
        >
          <Download size={15} />
          {busy === 'json' ? 'Gerando...' : 'Baixar arquivo de backup'}
        </button>
      </div>
    </section>
  );
};
