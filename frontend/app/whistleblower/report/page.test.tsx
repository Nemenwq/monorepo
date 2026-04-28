import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReportApartmentPage from './page'

// Mock crypto.randomUUID
global.crypto = {
  randomUUID: vi.fn(() => 'test-uuid-123'),
} as any

// Mock URL.createObjectURL and URL.revokeObjectURL
const mockCreateObjectURL = vi.fn((file: File) => `blob:${file.name}`)
const mockRevokeObjectURL = vi.fn()

Object.defineProperty(global, 'URL', {
  value: {
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL,
  },
  writable: true,
})

describe('ReportApartmentPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the report form initially', () => {
    render(<ReportApartmentPage />)

    expect(screen.getByText('Report a Vacant Apartment')).toBeInTheDocument()
    expect(screen.getByLabelText('Apartment Address')).toBeInTheDocument()
    expect(screen.getByLabelText('Bedrooms')).toBeInTheDocument()
    expect(screen.getByLabelText('Bathrooms')).toBeInTheDocument()
    expect(screen.getByLabelText('Annual Rent (₦)')).toBeInTheDocument()
  })

  it('shows photo upload section with minimum requirement', () => {
    render(<ReportApartmentPage />)

    expect(screen.getByText('Upload Photos (Minimum 3)')).toBeInTheDocument()
    expect(screen.getByText('Click to upload photos')).toBeInTheDocument()
  })

  it('displays photo previews when photos are added', async () => {
    render(<ReportApartmentPage />)

    const fileInput = screen.getByLabelText(/upload photos/i) as HTMLInputElement
    const files = [
      new File(['photo1'], 'photo1.jpg', { type: 'image/jpeg' }),
      new File(['photo2'], 'photo2.jpg', { type: 'image/jpeg' }),
    ]

    await userEvent.upload(fileInput, files)

    await waitFor(() => {
      expect(screen.getByText('2 photos selected')).toBeInTheDocument()
    })

    // Check that preview images are rendered
    const images = screen.getAllByAltText('Preview')
    expect(images).toHaveLength(2)
  })

  it('allows removing individual photos', async () => {
    render(<ReportApartmentPage />)

    const fileInput = screen.getByLabelText(/upload photos/i) as HTMLInputElement
    const files = [
      new File(['photo1'], 'photo1.jpg', { type: 'image/jpeg' }),
      new File(['photo2'], 'photo2.jpg', { type: 'image/jpeg' }),
      new File(['photo3'], 'photo3.jpg', { type: 'image/jpeg' }),
    ]

    await userEvent.upload(fileInput, files)

    await waitFor(() => {
      expect(screen.getByText('3 photos selected')).toBeInTheDocument()
    })

    // Hover over a photo to reveal remove button
    const removeButtons = screen.getAllByLabelText('Remove photo')
    expect(removeButtons).toHaveLength(3)

    // Click the first remove button
    fireEvent.click(removeButtons[0])

    await waitFor(() => {
      expect(screen.getByText('2 photos selected')).toBeInTheDocument()
    })

    // Verify URL was revoked
    expect(mockRevokeObjectURL).toHaveBeenCalled()
  })

  it('shows validation error when fewer than 3 photos are selected', async () => {
    render(<ReportApartmentPage />)

    const fileInput = screen.getByLabelText(/upload photos/i) as HTMLInputElement
    const files = [
      new File(['photo1'], 'photo1.jpg', { type: 'image/jpeg' }),
      new File(['photo2'], 'photo2.jpg', { type: 'image/jpeg' }),
    ]

    await userEvent.upload(fileInput, files)

    await waitFor(() => {
      expect(screen.getByText('Minimum 3 photos required')).toBeInTheDocument()
    })

    expect(screen.getByText(/You need at least 3 photos to submit your report/)).toBeInTheDocument()
  })

  it('does not show validation error when 3 or more photos are selected', async () => {
    render(<ReportApartmentPage />)

    const fileInput = screen.getByLabelText(/upload photos/i) as HTMLInputElement
    const files = [
      new File(['photo1'], 'photo1.jpg', { type: 'image/jpeg' }),
      new File(['photo2'], 'photo2.jpg', { type: 'image/jpeg' }),
      new File(['photo3'], 'photo3.jpg', { type: 'image/jpeg' }),
    ]

    await userEvent.upload(fileInput, files)

    await waitFor(() => {
      expect(screen.queryByText('Minimum 3 photos required')).not.toBeInTheDocument()
    })

    expect(screen.queryByText(/You need at least 3 photos to submit your report/)).not.toBeInTheDocument()
  })

  it('prevents form submission with fewer than 3 photos', async () => {
    render(<ReportApartmentPage />)

    // Fill required fields
    await userEvent.type(screen.getByLabelText('Apartment Address'), 'Test Address')
    await userEvent.selectOptions(screen.getByLabelText('Bedrooms'), '1')
    await userEvent.selectOptions(screen.getByLabelText('Bathrooms'), '1')
    await userEvent.type(screen.getByLabelText('Annual Rent (₦)'), '500000')

    // Add only 2 photos
    const fileInput = screen.getByLabelText(/upload photos/i) as HTMLInputElement
    const files = [
      new File(['photo1'], 'photo1.jpg', { type: 'image/jpeg' }),
      new File(['photo2'], 'photo2.jpg', { type: 'image/jpeg' }),
    ]
    await userEvent.upload(fileInput, files)

    await waitFor(() => {
      expect(screen.getByText('2 photos selected')).toBeInTheDocument()
    })

    // Try to submit
    const submitButton = screen.getByText('Submit Report')
    fireEvent.click(submitButton)

    // Should still be on form step, not confirmation
    await waitFor(() => {
      expect(screen.getByText('Report a Vacant Apartment')).toBeInTheDocument()
      expect(screen.queryByText('Apartment Reported!')).not.toBeInTheDocument()
    })
  })

  it('allows form submission with 3 or more photos', async () => {
    render(<ReportApartmentPage />)

    // Fill required fields
    await userEvent.type(screen.getByLabelText('Apartment Address'), 'Test Address')
    await userEvent.selectOptions(screen.getByLabelText('Bedrooms'), '1')
    await userEvent.selectOptions(screen.getByLabelText('Bathrooms'), '1')
    await userEvent.type(screen.getByLabelText('Annual Rent (₦)'), '500000')

    // Add 3 photos
    const fileInput = screen.getByLabelText(/upload photos/i) as HTMLInputElement
    const files = [
      new File(['photo1'], 'photo1.jpg', { type: 'image/jpeg' }),
      new File(['photo2'], 'photo2.jpg', { type: 'image/jpeg' }),
      new File(['photo3'], 'photo3.jpg', { type: 'image/jpeg' }),
    ]
    await userEvent.upload(fileInput, files)

    await waitFor(() => {
      expect(screen.getByText('3 photos selected')).toBeInTheDocument()
    })

    // Submit form
    const submitButton = screen.getByText('Submit Report')
    fireEvent.click(submitButton)

    // Should move to confirmation step
    await waitFor(() => {
      expect(screen.getByText('Apartment Reported!')).toBeInTheDocument()
      expect(screen.getByText('Your Listing Details:')).toBeInTheDocument()
    })
  })

  it('revokes object URLs on component unmount', () => {
    const { unmount } = render(<ReportApartmentPage />)

    // Add photos
    const fileInput = screen.getByLabelText(/upload photos/i) as HTMLInputElement
    const files = [
      new File(['photo1'], 'photo1.jpg', { type: 'image/jpeg' }),
      new File(['photo2'], 'photo2.jpg', { type: 'image/jpeg' }),
    ]
    userEvent.upload(fileInput, files)

    // Unmount component
    unmount()

    // URLs should be revoked
    expect(mockRevokeObjectURL).toHaveBeenCalledTimes(2)
  })

  it('handles adding more photos after initial upload', async () => {
    render(<ReportApartmentPage />)

    const fileInput = screen.getByLabelText(/upload photos/i) as HTMLInputElement

    // Add first batch
    const files1 = [
      new File(['photo1'], 'photo1.jpg', { type: 'image/jpeg' }),
      new File(['photo2'], 'photo2.jpg', { type: 'image/jpeg' }),
    ]
    await userEvent.upload(fileInput, files1)

    await waitFor(() => {
      expect(screen.getByText('2 photos selected')).toBeInTheDocument()
    })

    // Add second batch
    const files2 = [
      new File(['photo3'], 'photo3.jpg', { type: 'image/jpeg' }),
      new File(['photo4'], 'photo4.jpg', { type: 'image/jpeg' }),
    ]
    await userEvent.upload(fileInput, files2)

    await waitFor(() => {
      expect(screen.getByText('4 photos selected')).toBeInTheDocument()
    })

    const images = screen.getAllByAltText('Preview')
    expect(images).toHaveLength(4)
  })

  it('shows correct pluralization for photo count', async () => {
    render(<ReportApartmentPage />)

    const fileInput = screen.getByLabelText(/upload photos/i) as HTMLInputElement

    // Test singular
    const files1 = [new File(['photo1'], 'photo1.jpg', { type: 'image/jpeg' })]
    await userEvent.upload(fileInput, files1)

    await waitFor(() => {
      expect(screen.getByText('1 photo selected')).toBeInTheDocument()
    })

    // Test plural
    const files2 = [
      new File(['photo2'], 'photo2.jpg', { type: 'image/jpeg' }),
      new File(['photo3'], 'photo3.jpg', { type: 'image/jpeg' }),
    ]
    await userEvent.upload(fileInput, files2)

    await waitFor(() => {
      expect(screen.getByText('3 photos selected')).toBeInTheDocument()
    })
  })
})
