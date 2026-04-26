import { render, screen, fireEvent } from "@testing-library/react";
import MessagesPage from "./page";
import { vi, describe, it, expect } from "vitest";

// Mock the auth store
vi.mock("@/store/useAuthStore", () => ({
  default: () => ({
    isAuthenticated: true,
  }),
}));

// Mock scrollIntoView as it's not implemented in jsdom
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe("MessagesPage", () => {
  it("preserves draft text when switching between conversations", () => {
    render(<MessagesPage />);

    // By default, conversation 1 is selected
    const input = screen.getByPlaceholderText(/type your message/i);
    
    // Type a draft in conversation 1
    fireEvent.change(input, { target: { value: "Draft for conversation 1" } });
    expect(input).toHaveValue("Draft for conversation 1");

    // Switch to conversation 2
    const conv2 = screen.getByLabelText(/Select conversation with Mrs. Adeleke/i);
    fireEvent.click(conv2);

    // Draft should be empty for conversation 2 (assuming no initial draft)
    expect(input).toHaveValue("");
    
    // Type a draft in conversation 2
    fireEvent.change(input, { target: { value: "Draft for conversation 2" } });
    expect(input).toHaveValue("Draft for conversation 2");

    // Switch back to conversation 1
    const conv1 = screen.getByLabelText(/Select conversation with Adebayo Johnson/i);
    fireEvent.click(conv1);

    // Draft for conversation 1 should be preserved
    expect(input).toHaveValue("Draft for conversation 1");
  });

  it("handles mobile navigation correctly by clearing selection on back button click", () => {
    render(<MessagesPage />);
    
    // Initial state: conversation 1 is selected
    expect(screen.getByText(/Adebayo Johnson/i, { selector: "h2" })).toBeInTheDocument();
    
    // Find back button (only visible on mobile, but rendered in JSDOM)
    const backButton = screen.getByLabelText("Back to conversations");
    fireEvent.click(backButton);
    
    // Selection should be cleared (meaning "Select a conversation" view should be visible)
    expect(screen.getByText(/Select a conversation/i)).toBeInTheDocument();
  });
});
