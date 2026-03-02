import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AuthProvider } from '../../auth/AuthProvider'
import Auth from '../Auth'

vi.mock('../../integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } }
      }),
      signOut: vi.fn().mockResolvedValue({ error: null })
    }
  }
}))

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
    const emailInput = screen.getByPlaceholderText(/you@example.com/i)
    expect(emailInput).toBeInTheDocument()

    // a button that likely triggers sign-in / magic link
    const button = screen.getByRole('button', { name: /sign in|magic link|send/i })
    expect(button).toBeInTheDocument()
  })
})
