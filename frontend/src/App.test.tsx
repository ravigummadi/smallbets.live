/**
 * Tests for App routing with lazy-loaded pages.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { toHaveNoViolations } from 'vitest-axe/matchers';
import App, { RouteFallback } from './App';

expect.extend({ toHaveNoViolations });

describe('App (lazy routes)', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
    localStorage.clear();
  });

  it('renders the shell immediately and the home page after the chunk loads', async () => {
    render(<App />);

    // Shell (header) is part of the initial bundle and renders synchronously
    expect(screen.getByRole('link', { name: /smallbets/i })).toBeInTheDocument();

    // Home page arrives once the lazy import resolves
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('lazy-loads the create room page on /create', async () => {
    window.history.pushState({}, '', '/create');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /create/i })).toBeInTheDocument();
    });
  });

  it('redirects unknown routes to home', async () => {
    window.history.pushState({}, '', '/does-not-exist');
    render(<App />);

    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
    });
  });
});

describe('RouteFallback', () => {
  it('is announced to screen readers as a busy status region', () => {
    render(<RouteFallback />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent('Loading');
  });

  it('has no a11y violations', async () => {
    const { container } = render(<RouteFallback />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
