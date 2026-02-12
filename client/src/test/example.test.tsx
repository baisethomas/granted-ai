import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen, userEvent } from './utils';
import { Button } from '@/components/ui/button';

describe('Vitest Setup Verification', () => {
  it('should render components correctly', () => {
    renderWithProviders(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should handle user interactions', async () => {
    const user = userEvent.setup();
    let clicked = false;

    renderWithProviders(
      <Button onClick={() => { clicked = true; }}>
        Click me
      </Button>
    );

    const button = screen.getByText('Click me');
    await user.click(button);

    expect(clicked).toBe(true);
  });

  it('should work with jest-dom matchers', () => {
    renderWithProviders(<Button disabled>Disabled</Button>);
    expect(screen.getByText('Disabled')).toBeDisabled();
  });
});
