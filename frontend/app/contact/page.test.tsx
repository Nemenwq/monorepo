import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ContactPage from './page'

// Mock the API module
vi.mock('@/lib/api/support', () => ({
  submitSupportMessage: vi.fn(),
}))

import { submitSupportMessage } from '@/lib/api/support'

type MockSubmitSupportMessage = Mock<typeof submitSupportMessage>

describe('ContactPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the contact form', () => {
    render(<ContactPage />)

    expect(screen.getByText('Get in Touch')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Phone (Optional)')).toBeInTheDocument()
    expect(screen.getByLabelText('Subject')).toBeInTheDocument()
    expect(screen.getByLabelText('Message')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send Message' })).toBeInTheDocument()
  })

  it('submits the form successfully and shows success banner', async () => {
    const mockSubmit = submitSupportMessage as MockSubmitSupportMessage
    mockSubmit.mockResolvedValue({ success: true, messageId: 'msg-123' })

    render(<ContactPage />)

    // Fill form
    await userEvent.type(screen.getByLabelText('Name'), 'John Doe')
    await userEvent.type(screen.getByLabelText('Email'), 'john@example.com')
    await userEvent.type(screen.getByLabelText('Phone (Optional)'), '+2341234567890')
    await userEvent.type(screen.getByLabelText('Subject'), 'Test Subject')
    await userEvent.type(screen.getByLabelText('Message'), 'Test message content')

    // Submit form
    const submitButton = screen.getByRole('button', { name: 'Send Message' })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(submitSupportMessage).toHaveBeenCalledWith({
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+2341234567890',
        subject: 'Test Subject',
        message: 'Test message content',
      })
    })

    // Check success banner appears
    await waitFor(() => {
      expect(screen.getByText('✓ Message sent successfully!')).toBeInTheDocument()
      expect(screen.getByText("We'll get back to you as soon as possible.")).toBeInTheDocument()
    })

    // Check form is cleared
    expect(screen.getByLabelText('Name')).toHaveValue('')
    expect(screen.getByLabelText('Email')).toHaveValue('')
    expect(screen.getByLabelText('Subject')).toHaveValue('')
    expect(screen.getByLabelText('Message')).toHaveValue('')
  })

  it('shows loading state while submitting', async () => {
    const mockSubmit = submitSupportMessage as MockSubmitSupportMessage
    mockSubmit.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true, messageId: 'msg-123' }), 100))
    )

    render(<ContactPage />)

    // Fill form
    await userEvent.type(screen.getByLabelText('Name'), 'John Doe')
    await userEvent.type(screen.getByLabelText('Email'), 'john@example.com')
    await userEvent.type(screen.getByLabelText('Subject'), 'Test Subject')
    await userEvent.type(screen.getByLabelText('Message'), 'Test message')

    // Submit form
    const submitButton = screen.getByRole('button', { name: 'Send Message' })
    fireEvent.click(submitButton)

    // Check loading state
    await waitFor(() => {
      expect(screen.getByText('Sending...')).toBeInTheDocument()
      expect(submitButton).toBeDisabled()
    })
  })

  it('shows server error on submission failure', async () => {
    const mockError = new Error('Server error') as Error & { details?: Record<string, string> }
    const mockSubmit = submitSupportMessage as MockSubmitSupportMessage
    mockSubmit.mockRejectedValue(mockError)

    render(<ContactPage />)

    // Fill form
    await userEvent.type(screen.getByLabelText('Name'), 'John Doe')
    await userEvent.type(screen.getByLabelText('Email'), 'john@example.com')
    await userEvent.type(screen.getByLabelText('Subject'), 'Test Subject')
    await userEvent.type(screen.getByLabelText('Message'), 'Test message')

    // Submit form
    const submitButton = screen.getByRole('button', { name: 'Send Message' })
    fireEvent.click(submitButton)

    // Check error banner appears
    await waitFor(() => {
      expect(screen.getByText('Failed to Send Message')).toBeInTheDocument()
      expect(screen.getByText('Server error')).toBeInTheDocument()
    })

    // Check button is not disabled after error
    expect(submitButton).not.toBeDisabled()
  })

  it('shows field-level validation errors from backend', async () => {
    const mockError = new Error('Validation failed') as Error & { details?: Record<string, string> }
    mockError.details = {
      email: 'Invalid email format',
      message: 'Message is too short',
    }
    const mockSubmit = submitSupportMessage as MockSubmitSupportMessage
    mockSubmit.mockRejectedValue(mockError)

    render(<ContactPage />)

    // Fill form
    await userEvent.type(screen.getByLabelText('Name'), 'John Doe')
    await userEvent.type(screen.getByLabelText('Email'), 'invalid-email')
    await userEvent.type(screen.getByLabelText('Subject'), 'Test Subject')
    await userEvent.type(screen.getByLabelText('Message'), 'Short')

    // Submit form
    const submitButton = screen.getByRole('button', { name: 'Send Message' })
    fireEvent.click(submitButton)

    // Check field-level errors appear
    await waitFor(() => {
      expect(screen.getByText('Invalid email format')).toBeInTheDocument()
      expect(screen.getByText('Message is too short')).toBeInTheDocument()
    })

    // Check general error message
    expect(screen.getByText('Please fix the errors below and try again.')).toBeInTheDocument()

    // Check input fields have error styling
    const emailInput = screen.getByLabelText('Email')
    const messageInput = screen.getByLabelText('Message')
    expect(emailInput).toHaveClass('border-destructive')
    expect(messageInput).toHaveClass('border-destructive')
  })

  it('clears field errors when user starts typing', async () => {
    const mockError = new Error('Validation failed') as Error & { details?: Record<string, string> }
    mockError.details = {
      email: 'Invalid email format',
    }
    const mockSubmit = submitSupportMessage as MockSubmitSupportMessage
    mockSubmit.mockRejectedValue(mockError)

    render(<ContactPage />)

    // Fill and submit to trigger error
    await userEvent.type(screen.getByLabelText('Name'), 'John Doe')
    await userEvent.type(screen.getByLabelText('Email'), 'invalid')
    await userEvent.type(screen.getByLabelText('Subject'), 'Test')
    await userEvent.type(screen.getByLabelText('Message'), 'Test message')
    fireEvent.click(screen.getByRole('button', { name: 'Send Message' }))

    await waitFor(() => {
      expect(screen.getByText('Invalid email format')).toBeInTheDocument()
    })

    // Type in the email field
    await userEvent.clear(screen.getByLabelText('Email'))
    await userEvent.type(screen.getByLabelText('Email'), 'valid@email.com')

    // Field error should be cleared
    await waitFor(() => {
      expect(screen.queryByText('Invalid email format')).not.toBeInTheDocument()
    })
  })

  it('clears error banner on successful submission after previous error', async () => {
    const mockSubmit = submitSupportMessage as MockSubmitSupportMessage
    mockSubmit
      .mockRejectedValueOnce(new Error('Server error'))
      .mockResolvedValueOnce({ success: true, messageId: 'msg-123' })

    render(<ContactPage />)

    // Fill form
    await userEvent.type(screen.getByLabelText('Name'), 'John Doe')
    await userEvent.type(screen.getByLabelText('Email'), 'john@example.com')
    await userEvent.type(screen.getByLabelText('Subject'), 'Test')
    await userEvent.type(screen.getByLabelText('Message'), 'Test message')

    // First submission fails
    fireEvent.click(screen.getByRole('button', { name: 'Send Message' }))

    await waitFor(() => {
      expect(screen.getByText('Failed to Send Message')).toBeInTheDocument()
    })

    // Second submission succeeds
    fireEvent.click(screen.getByRole('button', { name: 'Send Message' }))

    await waitFor(() => {
      expect(screen.queryByText('Failed to Send Message')).not.toBeInTheDocument()
      expect(screen.getByText('✓ Message sent successfully!')).toBeInTheDocument()
    })
  })

  it('requires all required fields for HTML5 validation', () => {
    render(<ContactPage />)

    const nameInput = screen.getByLabelText('Name')
    const emailInput = screen.getByLabelText('Email')
    const subjectInput = screen.getByLabelText('Subject')
    const messageInput = screen.getByLabelText('Message')

    expect(nameInput).toBeRequired()
    expect(emailInput).toBeRequired()
    expect(subjectInput).toBeRequired()
    expect(messageInput).toBeRequired()
  })

  it('phone field is optional', () => {
    render(<ContactPage />)

    const phoneInput = screen.getByLabelText('Phone (Optional)')
    expect(phoneInput).not.toBeRequired()
  })

  it('handles network errors gracefully', async () => {
    const mockError = new TypeError('Failed to fetch')
    const mockSubmit = submitSupportMessage as MockSubmitSupportMessage
    mockSubmit.mockRejectedValue(mockError)

    render(<ContactPage />)

    // Fill form
    await userEvent.type(screen.getByLabelText('Name'), 'John Doe')
    await userEvent.type(screen.getByLabelText('Email'), 'john@example.com')
    await userEvent.type(screen.getByLabelText('Subject'), 'Test')
    await userEvent.type(screen.getByLabelText('Message'), 'Test message')

    // Submit form
    fireEvent.click(screen.getByRole('button', { name: 'Send Message' }))

    // Check error banner appears with generic message
    await waitFor(() => {
      expect(screen.getByText('Failed to Send Message')).toBeInTheDocument()
      expect(screen.getByText('Failed to send message. Please try again.')).toBeInTheDocument()
    })
  })
})
