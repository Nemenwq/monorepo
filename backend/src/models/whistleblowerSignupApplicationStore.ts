import { getPool } from "../db.js";
import {
  CreateWhistleblowerSignupApplicationData,
  WhistleblowerSignupApplication,
  WhistleblowerSignupApplicationStatus,
} from "./whistleblowerSignupApplication.js";

export interface WhistleblowerSignupApplicationStore {
  create(
    data: CreateWhistleblowerSignupApplicationData,
  ): Promise<WhistleblowerSignupApplication>;
}

export class InMemoryWhistleblowerSignupApplicationStore
  implements WhistleblowerSignupApplicationStore
{
  private applications = new Map<string, WhistleblowerSignupApplication>();
  private counter = 1;

  async create(
    data: CreateWhistleblowerSignupApplicationData,
  ): Promise<WhistleblowerSignupApplication> {
    const applicationId = `WSA-${Date.now()}-${this.counter++}`;
    const now = new Date().toISOString();
    const application: WhistleblowerSignupApplication = {
      applicationId,
      ...data,
      status: WhistleblowerSignupApplicationStatus.PENDING,
      createdAt: now,
      updatedAt: now,
    };

    this.applications.set(applicationId, application);
    return application;
  }

  async clear(): Promise<void> {
    this.applications.clear();
    this.counter = 1;
  }
}

export class PostgresWhistleblowerSignupApplicationStore
  implements WhistleblowerSignupApplicationStore
{
  async create(
    data: CreateWhistleblowerSignupApplicationData,
  ): Promise<WhistleblowerSignupApplication> {
    const pool = await getPool();
    if (!pool) throw new Error("Database pool not initialized");

    const result = await pool.query(
      `INSERT INTO whistleblower_signup_applications (
         full_name,
         email,
         phone,
         address,
         linkedin_profile,
         facebook_profile,
         instagram_profile,
         status,
         created_at,
         updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       RETURNING
         id as application_id,
         full_name,
         email,
         phone,
         address,
         linkedin_profile,
         facebook_profile,
         instagram_profile,
         status,
         created_at,
         updated_at`,
      [
        data.fullName,
        data.email,
        data.phone,
        data.address,
        data.linkedinProfile,
        data.facebookProfile,
        data.instagramProfile,
        WhistleblowerSignupApplicationStatus.PENDING,
      ],
    );

    return this.mapRow(result.rows[0]);
  }

  private mapRow(row: Record<string, any>): WhistleblowerSignupApplication {
    return {
      applicationId: row.application_id,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      address: row.address,
      linkedinProfile: row.linkedin_profile,
      facebookProfile: row.facebook_profile,
      instagramProfile: row.instagram_profile,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}

let whistleblowerSignupApplicationStore: WhistleblowerSignupApplicationStore =
  new InMemoryWhistleblowerSignupApplicationStore();

export function initWhistleblowerSignupApplicationStore(
  store: WhistleblowerSignupApplicationStore,
): void {
  whistleblowerSignupApplicationStore = store;
}

export { whistleblowerSignupApplicationStore };
