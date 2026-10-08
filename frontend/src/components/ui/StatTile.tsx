import React from 'react';

export type StatTone = 'neutral' | 'success' | 'warning' | 'danger';

interface StatTileProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  /** Estado do indicador. Aparece como um ponto colorido ao lado do rótulo; o valor fica neutro. */
  tone?: StatTone;
  /** Quando informado, o bloco vira um botão (ex.: filtrar a lista por aquele indicador). */
  onClick?: () => void;
  title?: string;
}

export const StatTile: React.FC<StatTileProps> = ({ label, value, hint, tone = 'neutral', onClick, title }) => {
  const content = (
    <>
      <span className="stat-tile-label">
        {tone !== 'neutral' && <span className={`status-dot dot-${tone}`} aria-hidden="true" />}
        {label}
      </span>
      <span className="stat-tile-value">{value}</span>
      {hint && <span className="stat-tile-hint">{hint}</span>}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className="card stat-tile" onClick={onClick} title={title}>
        {content}
      </button>
    );
  }

  return (
    <div className="card stat-tile" title={title}>
      {content}
    </div>
  );
};
