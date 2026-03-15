import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test-utils';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import userEvent from '@testing-library/user-event';
import CollapsibleSection from './CollapsibleSection';

expect.extend({ toHaveNoViolations });

describe('CollapsibleSection', () => {
  it('renders title and children when expanded by default', () => {
    render(
      <CollapsibleSection title="Test Section">
        <p>Section content</p>
      </CollapsibleSection>
    );
    expect(screen.getByText('Test Section')).toBeInTheDocument();
    expect(screen.getByText('Section content')).toBeInTheDocument();
    expect(screen.getByText('−')).toBeInTheDocument();
  });

  it('renders badge when provided', () => {
    render(
      <CollapsibleSection title="Bets" badge={5}>
        <p>Content</p>
      </CollapsibleSection>
    );
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('hides children when defaultExpanded is false', () => {
    render(
      <CollapsibleSection title="Hidden" defaultExpanded={false}>
        <p>Hidden content</p>
      </CollapsibleSection>
    );
    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
    expect(screen.getByText('+')).toBeInTheDocument();
  });

  it('toggles visibility on header click', async () => {
    const user = userEvent.setup();
    render(
      <CollapsibleSection title="Toggle Me">
        <p>Toggleable content</p>
      </CollapsibleSection>
    );

    expect(screen.getByText('Toggleable content')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Toggle Me/i }));
    expect(screen.queryByText('Toggleable content')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Toggle Me/i }));
    expect(screen.getByText('Toggleable content')).toBeInTheDocument();
  });

  it('sets aria-expanded and aria-controls attributes', async () => {
    const user = userEvent.setup();
    render(
      <CollapsibleSection title="Aria Test">
        <p>Aria content</p>
      </CollapsibleSection>
    );

    const button = screen.getByRole('button', { name: /Aria Test/i });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAttribute('aria-controls');

    const contentId = button.getAttribute('aria-controls')!;
    expect(document.getElementById(contentId)).toBeInTheDocument();

    await user.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById(contentId)).not.toBeInTheDocument();
  });

  it('renders string badge', () => {
    render(
      <CollapsibleSection title="Match Bets" badge="3 open">
        <p>Content</p>
      </CollapsibleSection>
    );
    expect(screen.getByText('3 open')).toBeInTheDocument();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <CollapsibleSection title="Accessible Section" badge={2}>
        <p>Accessible content</p>
      </CollapsibleSection>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
