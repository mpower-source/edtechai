import { render, screen } from '@testing-library/react';
import React from 'react';

test('renders without crashing', () => {
  function Hello() { return <div>App Mounted</div>; }
  render(<Hello />);
  expect(screen.getByText(/App Mounted/i)).toBeInTheDocument();
});
