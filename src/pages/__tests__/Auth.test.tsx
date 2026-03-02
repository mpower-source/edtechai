import { render, screen } from '@testing-library/react'
import { AuthProvider } from '../../auth/AuthProvider'
import Auth from '../Auth'

// Basic smoke test for the Auth page UI (magic link/email sign-in)
// Uses AuthProvider so components relying on context don't crash

describe('Auth page', () => {
  it('renders email input and a sign-in button', () => {
    render(
      <AuthProvider>
        <Auth />
      </AuthProvider>
    )

    // email input
    const emailInput = screen.getByRole('textbox', { name: /email/i })
    expect(emailInput).toBeInTheDocument()

    // a button that likely triggers sign-in / magic link
    const button = screen.getByRole('button', { name: /sign in|magic link|send/i })
    expect(button).toBeInTheDocument()
  })
})
