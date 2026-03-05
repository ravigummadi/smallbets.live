/**
 * QuickFireTemplates - Scrollable row of cricket bet template buttons.
 * Host taps a template to auto-fill the bet creation form.
 */

import { cricketQuickFireTemplates, type QuickFireTemplate } from '@/data/cricketQuickFireTemplates';

interface QuickFireTemplatesProps {
  onSelect: (template: QuickFireTemplate) => void;
}

export default function QuickFireTemplates({ onSelect }: QuickFireTemplatesProps) {
  return (
    <div className="card" style={{ padding: 'var(--spacing-sm) var(--spacing-md)' }}>
      <h4 style={{ marginBottom: 'var(--spacing-sm)', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
        Quick-Fire Bets
      </h4>
      <div
        style={{
          display: 'flex',
          gap: 'var(--spacing-sm)',
          overflowX: 'auto',
          paddingBottom: 'var(--spacing-xs)',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
        }}
      >
        {cricketQuickFireTemplates.map((template) => (
          <button
            key={template.id}
            className="btn btn-secondary"
            onClick={() => onSelect(template)}
            style={{
              whiteSpace: 'nowrap',
              fontSize: '0.8rem',
              padding: '0.4rem 0.75rem',
              minHeight: 'auto',
              flexShrink: 0,
            }}
          >
            {template.label}
          </button>
        ))}
      </div>
    </div>
  );
}
