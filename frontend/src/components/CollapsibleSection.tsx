import { useState } from 'react';

interface CollapsibleSectionProps {
  title: string;
  badge?: string | number;
  defaultExpanded?: boolean;
  children: React.ReactNode;
  className?: string;
}

export default function CollapsibleSection({
  title,
  badge,
  defaultExpanded = true,
  children,
  className = '',
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className={`collapsible-section ${className}`}>
      <button
        className={`collapsible-section-header ${expanded ? 'collapsible-section-header--expanded' : ''}`}
        onClick={() => setExpanded(!expanded)}
        type="button"
      >
        <span className="collapsible-section-title">
          {title}
          {badge !== undefined && (
            <span className="bet-count-badge">{badge}</span>
          )}
        </span>
        <span className="collapsible-section-icon">
          {expanded ? '−' : '+'}
        </span>
      </button>
      {expanded && (
        <div className="collapsible-section-body">
          {children}
        </div>
      )}
    </div>
  );
}
