# Requirements Document

## Introduction

The Whistleblower Earnings Dashboard feature provides whistleblowers with visibility into their earnings history and payout status. The system exposes a backend API endpoint that returns aggregated earnings totals and a detailed history of individual rewards, enabling whistleblowers to track pending and completed payouts.

Whistleblowers are a **first-class platform participant** on Shelterflex. In addition to their trust-and-safety role (reporting fraudulent or misrepresented listings), they function as **organic advertisers**: by maintaining a high-quality, verified listing inventory they increase tenant confidence and drive platform adoption. The earnings dashboard is therefore not just a utility — it is a retention and incentive surface for a key stakeholder group.

## Glossary

- **Earnings_API**: The backend API endpoint that provides earnings data for whistleblowers
- **Whistleblower**: A user who reports listings and earns rewards; also functions as an organic advertiser by improving listing quality and platform trust
- **Reward**: A monetary compensation earned by a whistleblower for reporting a listing
- **Payout_Status**: The current state of a reward payment (pending, payable, or paid)
- **NGN**: Nigerian Naira currency used for display purposes
- **USDC**: USD Coin stablecoin used as the canonical currency value
- **Earnings_Totals**: Aggregated sums of rewards across all payout statuses
- **Earnings_History**: A chronological list of individual reward records

## Requirements

### Requirement 1: Retrieve Earnings Data

**User Story:** As a whistleblower, I want to retrieve my earnings data via an API endpoint, so that I can view my payout history and totals in the dashboard.

#### Acceptance Criteria

1. THE Earnings_API SHALL expose a GET endpoint at the path /api/whistleblower/:id/earnings
2. WHEN a valid whistleblower ID is provided, THE Earnings_API SHALL return earnings data for that whistleblower
3. THE Earnings_API SHALL return a response containing both Earnings_Totals and Earnings_History
4. WHEN an invalid whistleblower ID is provided, THE Earnings_API SHALL return an error response with status code 404

### Requirement 2: Provide Earnings Totals

**User Story:** As a whistleblower, I want to see aggregated totals of my earnings, so that I can quickly understand my overall payout status.

#### Acceptance Criteria

1. THE Earnings_API SHALL return Earnings_Totals containing totalNgn, pendingNgn, and paidNgn
2. THE Earnings_API SHALL calculate totalNgn as the sum of all rewards regardless of Payout_Status
3. THE Earnings_API SHALL calculate pendingNgn as the sum of rewards with Payout_Status of pending or payable
4. THE Earnings_API SHALL calculate paidNgn as the sum of rewards with Payout_Status of paid
5. WHERE USDC totals are included, THE Earnings_API SHALL return totalUsdc, pendingUsdc, and paidUsdc with the same calculation logic applied to USDC amounts

### Requirement 3: Provide Earnings History

**User Story:** As a whistleblower, I want to see a detailed list of my individual rewards, so that I can track each payout separately.

#### Acceptance Criteria

1. THE Earnings_API SHALL return Earnings_History as a list of reward items
2. FOR EACH reward item, THE Earnings_API SHALL include rewardId, listingId, dealId, amountNgn, amountUsdc, status, and createdAt
3. FOR EACH reward item with Payout_Status of paid, THE Earnings_API SHALL include paidAt
4. THE Earnings_API SHALL set status to one of the following values: pending, payable, or paid
5. THE Earnings_API SHALL order Earnings_History items by createdAt in descending order

### Requirement 4: Maintain API Documentation

**User Story:** As a developer, I want the earnings endpoint documented in OpenAPI, so that I can understand the API contract and integrate with it correctly.

#### Acceptance Criteria

1. WHEN the Earnings_API endpoint is implemented, THE development team SHALL update the OpenAPI specification
2. THE OpenAPI specification SHALL document the request path, parameters, response schema, and error responses
3. THE OpenAPI specification SHALL include example responses demonstrating at least two different Payout_Status values

### Requirement 5: Ensure Code Quality

**User Story:** As a developer, I want the backend code to pass quality checks, so that the codebase remains maintainable and reliable.

#### Acceptance Criteria

1. WHEN the implementation is complete, THE backend code SHALL pass linting checks without errors
2. WHEN the implementation is complete, THE backend code SHALL pass type checking without errors
3. WHEN the implementation is complete, THE backend code SHALL build successfully without errors
