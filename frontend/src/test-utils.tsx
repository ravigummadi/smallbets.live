/**
 * Test utilities for SmallBets.live frontend tests
 *
 * This file provides helper functions for rendering components with all necessary providers:
 * - React Router (BrowserRouter)
 * - Any context providers your app uses
 *
 * Usage:
 *   import { render } from './test-utils';
 *   const { getByText } = render(<MyComponent />);
 */

import { ReactElement, ReactNode } from 'react';
import { render as rtlRender, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

/**
 * Custom render function that wraps components with all providers
 */
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  // Add any custom options here
  initialRoute?: string;
}

function AllTheProviders({ children }: { children: ReactNode }) {
  return (
    <BrowserRouter>
      {/* Add any other providers here (Context, Theme, etc.) */}
      {children}
    </BrowserRouter>
  );
}

function customRender(
  ui: ReactElement,
  options?: CustomRenderOptions
) {
  const { initialRoute = '/', ...renderOptions } = options || {};

  // Set initial route if provided
  if (initialRoute !== '/') {
    window.history.pushState({}, 'Test page', initialRoute);
  }

  return rtlRender(ui, {
    wrapper: AllTheProviders,
    ...renderOptions,
  });
}

// Re-export everything from testing-library
export * from '@testing-library/react';

// Override render method
export { customRender as render };
