# Property Detail Page Regression Check

This regression check ensures that key sections (Annual Rent, Listed By, and Whistleblower) remain present on the property detail page, preventing UI regressions.

## Running the Check Locally

### Prerequisites
- Node.js installed
- Dependencies installed: `pnpm install` (from the frontend directory)

### Run the Regression Test

```bash
# From the monorepo root
cd frontend
pnpm test PropertyDetailClient.regression.test.tsx
```

Or run a single test file specifically:

```bash
cd frontend
pnpm vitest run app/properties/[id]/PropertyDetailClient.regression.test.tsx
```

### What the Check Tests

The regression test verifies the presence of these critical UI sections:

1. **Annual Rent Section** - Must display the "Annual Rent" label and pricing information
2. **Listed By Section** - Must display landlord information with verification status
3. **Whistleblower Section** - Must display when whistleblower data exists for the property

## Validating the Check Fails When Elements Are Removed

To verify the regression check works correctly, temporarily remove one of the key sections and confirm the test fails:

### Test 1: Remove Annual Rent Section

1. Open `frontend/app/properties/[id]/PropertyDetailClient.tsx`
2. Comment out or remove the Annual Rent section (around lines 491-499):
   ```tsx
   {/* Temporarily removed for testing */}
   {/* <div className="mb-4">
     <p className="text-xs text-muted-foreground sm:text-sm">
       Annual Rent
     </p>
     <p className="font-mono text-2xl font-black sm:text-3xl">
       {formatPrice(property.price)}
     </p>
   </div> */}
   ```
3. Run the regression test:
   ```bash
   pnpm vitest run app/properties/[id]/PropertyDetailClient.regression.test.tsx
   ```
4. Expected result: Test fails with error about missing "Annual Rent" text
5. Restore the Annual Rent section

### Test 2: Remove Listed By Section

1. Open `frontend/app/properties/[id]/PropertyDetailClient.tsx`
2. Comment out or remove the Listed By section (around lines 633-689)
3. Run the regression test
4. Expected result: Test fails with error about missing "Listed By" text
5. Restore the Listed By section

### Test 3: Remove Whistleblower Section

1. Open `frontend/app/properties/[id]/PropertyDetailClient.tsx`
2. Comment out the whistleblower conditional section (around lines 582-631):
   ```tsx
   {/* Temporarily removed for testing */}
   {/* {property.whistleblower && (
     <div className="border-3 border-secondary bg-card p-6 shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]">
       ...
     </div>
   )} */}
   ```
3. Run the regression test
4. Expected result: Test for whistleblower section may pass (since it's conditional), but overall section presence check should still work
5. Restore the whistleblower section

## Troubleshooting

### Test passes but should fail
- Ensure you've actually removed or commented out the section
- Check that the file was saved
- Try running the test with `--no-cache` flag: `pnpm vitest run --no-cache`

### Module not found errors
- Run `pnpm install` from the frontend directory to ensure dependencies are installed

### Test hangs or times out
- Check that the mock data includes a property with ID "1"
- Verify the property has the expected data structure

## Integration with CI

This regression check is designed to run locally only. To add it to CI, you would:

1. Add the test to your CI configuration (e.g., GitHub Actions)
2. Run it as part of the test suite: `pnpm test`
3. The test will automatically run with other tests in the project

However, per the current scope, this check remains local-only with no CI changes required.
