import {
  PostgresReceiptRepository,
  ReceiptRepository,
  StubReceiptRepository,
} from "./receipt-repository.js";
import {
  PostgresTimelockRepository,
  StubTimelockRepository,
  TimelockRepository,
} from "./timelock-repository.js";

function hasDatabaseUrl(databaseUrl: string | undefined): boolean {
  return Boolean(databaseUrl && databaseUrl.trim().length > 0);
}

function isStubAllowed(nodeEnv: string | undefined): boolean {
  return nodeEnv === "development" || nodeEnv === "test";
}

function assertRepositoryBootstrapConfig(
  databaseUrl: string | undefined,
  nodeEnv: string | undefined,
): void {
  if (!hasDatabaseUrl(databaseUrl) && !isStubAllowed(nodeEnv)) {
    throw new Error(
      "DATABASE_URL is required outside development/test for receipt and timelock repositories",
    );
  }
}

export function createReceiptRepository(
  databaseUrl: string | undefined,
  nodeEnv: string | undefined,
): ReceiptRepository {
  assertRepositoryBootstrapConfig(databaseUrl, nodeEnv);
  return hasDatabaseUrl(databaseUrl)
    ? new PostgresReceiptRepository()
    : new StubReceiptRepository();
}

export function createTimelockRepository(
  databaseUrl: string | undefined,
  nodeEnv: string | undefined,
): TimelockRepository {
  assertRepositoryBootstrapConfig(databaseUrl, nodeEnv);
  return hasDatabaseUrl(databaseUrl)
    ? new PostgresTimelockRepository()
    : new StubTimelockRepository();
}
