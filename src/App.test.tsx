import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

function Placeholder() {
  return <div>App Works</div>;
}

describe('App', () => {
  it('renders', () => {
    render(<Placeholder />);
    expect(screen.getByText('App Works')).toBeInTheDocument();
  });
});
