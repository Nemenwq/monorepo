import { apiFetch, type ApiError } from '../api'

export interface SupportMessageRequest {
  name: string
  email: string
  phone?: string
  subject: string
  message: string
}

export interface SupportMessageResponse {
  success: true
  messageId: string
}

/**
 * Submits a support message to the backend.
 * 
 * @param data - The support message data
 * @returns Promise resolving to the response with messageId
 * @throws ApiError if the request fails
 */
export async function submitSupportMessage(
  data: SupportMessageRequest
): Promise<SupportMessageResponse> {
  const response = await apiFetch<SupportMessageResponse>('/api/support/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  return response
}
