import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import express from "express";
import { createWhistleblowerApplicationsRouter } from "./whistleblowerApplications.js";
import { errorHandler } from "../middleware/errorHandler.js";
import {
  InMemoryWhistleblowerSignupApplicationStore,
  initWhistleblowerSignupApplicationStore,
} from "../models/whistleblowerSignupApplicationStore.js";

describe("Whistleblower Signup Application Routes", () => {
  let app: express.Application;
  let store: InMemoryWhistleblowerSignupApplicationStore;

  beforeEach(async () => {
    store = new InMemoryWhistleblowerSignupApplicationStore();
    initWhistleblowerSignupApplicationStore(store);

    app = express();
    app.use(express.json());
    app.use("/api/whistleblower/applications", createWhistleblowerApplicationsRouter());
    app.use(errorHandler);

    await store.clear();
  });

  it("creates whistleblower signup application with valid payload", async () => {
    const response = await request(app)
      .post("/api/whistleblower/applications")
      .send({
        fullName: "Amina Yusuf",
        email: "amina@example.com",
        phone: "+2348012345678",
        address: "Block 5, Flat 2A, Yaba, Lagos",
        linkedinProfile: "https://linkedin.com/in/amina-yusuf",
        facebookProfile: "https://facebook.com/amina.yusuf",
        instagramProfile: "https://instagram.com/amina.yusuf",
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.applicationId).toBeDefined();
    expect(response.body.data.status).toBe("pending");
  });

  it("rejects invalid whistleblower signup payload with validation error", async () => {
    const response = await request(app)
      .post("/api/whistleblower/applications")
      .send({
        fullName: "A",
        email: "invalid",
        phone: "1",
        address: "No",
        linkedinProfile: "not-a-url",
        facebookProfile: "not-a-url",
        instagramProfile: "not-a-url",
      })
      .expect(400);

    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });
});
