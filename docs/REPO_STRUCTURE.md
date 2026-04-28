# Shelterflex Monorepo Structure

Shelterflex is a **Rent Now, Pay Later (RNPL)** platform. Tenants secure properties with a partial deposit and repay the balance in installments. Landlords list directly and receive guaranteed or partially guaranteed payments. Whistleblowers report fraudulent listings and earn on-chain rewards, acting as a decentralized trust and quality-assurance layer that also drives organic platform adoption.

This repository is a **monorepo** with three projects.

## Top-level folders

- `frontend/` - Next.js web app (UI for tenants, landlords, and whistleblowers)
- `backend/` - Express API (business logic, deal management, earnings API, Soroban RPC integration)
- `contracts/` - Soroban smart contracts (Rust): payments, escrow, staking, whistleblower rewards
- `docs/` - Contributor and product documentation

## Working on one area without running everything

You do not need to run all services to contribute.

### Frontend-only contributions

- Work inside `frontend/`
- Run:

```bash
npm install
npm run dev
```

### Backend-only contributions

- Work inside `backend/`
- Run:

```bash
npm install
cp .env.example .env
npm run dev
```

### Contract-only contributions

- Work inside `contracts/`
- Run:

```bash
cargo test
stellar contract build
```

## Where to put new code

- Frontend UI components: `frontend/components/`
- Frontend route pages: `frontend/app/`
- Backend routes: `backend/src/` (keep Soroban code under `backend/src/soroban/`)
- Contracts: `contracts/<contract_name>/src/lib.rs`

## Documentation

- Root overview: `README.md`
- Contribution guide: `CONTRIBUTING.md`
- Issue ideas: `docs/ISSUES_CATALOG.md`
