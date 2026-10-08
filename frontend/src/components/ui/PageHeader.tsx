import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  /** Botões da tela. A ação principal deve usar .btn-primary (uma por tela). */
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actions }) => (
  <div className="view-header">
    <div>
      <h1 className="page-title">{title}</h1>
      {subtitle && <p className="page-subtitle">{subtitle}</p>}
    </div>
    {actions && <div className="view-header-actions">{actions}</div>}
  </div>
);
