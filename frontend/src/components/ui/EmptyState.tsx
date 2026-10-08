import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  text?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, text, action }) => (
  <div className="empty-state">
    {icon && <span className="empty-state-icon">{icon}</span>}
    <div className="empty-state-title">{title}</div>
    {text && <p className="empty-state-text">{text}</p>}
    {action}
  </div>
);
