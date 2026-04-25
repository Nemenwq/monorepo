import { describe, expect, it } from "vitest";
import { createReceiptRepository, createTimelockRepository } from "./repositoryBootstrap.js";
import { PostgresReceiptRepository, StubReceiptRepository } from "./receipt-repository.js";
import {
  PostgresTimelockRepository,
  StubTimelockRepository,
} from "./timelock-repository.js";

describe("repository bootstrap selection", () => {
  describe("createReceiptRepository", () => {
    it("uses stub repository in development when DATABASE_URL is missing", () => {
      const repository = createReceiptRepository(undefined, "development");
      expect(repository).toBeInstanceOf(StubReceiptRepository);
    });

    it("uses postgres repository when DATABASE_URL is provided", () => {
      const repository = createReceiptRepository(
        "postgres://localhost:5432/shelterflex",
        "production",
      );
      expect(repository).toBeInstanceOf(PostgresReceiptRepository);
    });

    it("fails fast outside dev/test when DATABASE_URL is missing", () => {
      expect(() => createReceiptRepository(undefined, "production")).toThrow(
        "DATABASE_URL is required outside development/test",
      );
    });
  });

  describe("createTimelockRepository", () => {
    it("uses stub repository in test mode when DATABASE_URL is missing", () => {
      const repository = createTimelockRepository(undefined, "test");
      expect(repository).toBeInstanceOf(StubTimelockRepository);
    });

    it("uses postgres repository when DATABASE_URL is provided", () => {
      const repository = createTimelockRepository(
        "postgres://localhost:5432/shelterflex",
        "staging",
      );
      expect(repository).toBeInstanceOf(PostgresTimelockRepository);
    });

    it("fails fast outside dev/test when DATABASE_URL is missing", () => {
      expect(() => createTimelockRepository(undefined, "production")).toThrow(
        "DATABASE_URL is required outside development/test",
      );
    });
  });
});
