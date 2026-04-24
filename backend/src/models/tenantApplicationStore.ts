/**
 * Tenant Application Store
 * In-memory and PostgreSQL implementations for tenant application persistence
 */

import { getPool } from "../db.js";
import {
  TenantApplication,
  TenantApplicationStatus,
  CreateTenantApplicationData,
} from "./tenantApplication.js";

export interface TenantApplicationStore {
  create(data: CreateTenantApplicationData): Promise<TenantApplication>;
  findById(applicationId: string): Promise<TenantApplication | null>;
  findByUserId(
    userId: string,
    filters?: {
      status?: TenantApplicationStatus;
      limit?: number;
      cursor?: string;
    },
  ): Promise<{ applications: TenantApplication[]; nextCursor?: string }>;
  updateStatus(
    applicationId: string,
    status: TenantApplicationStatus,
    reviewedBy?: string,
    rejectionReason?: string,
  ): Promise<TenantApplication | null>;
}

/**
 * In-memory implementation for testing
 */
export class InMemoryTenantApplicationStore implements TenantApplicationStore {
  private applications: Map<string, TenantApplication> = new Map();
  private counter = 1;

  async create(data: CreateTenantApplicationData): Promise<TenantApplication> {
    const applicationId = `APP-${Date.now()}-${this.counter++}`;
    const totalAmount = data.annualRent - data.deposit;
    const monthlyPayment = totalAmount / data.duration;

    const application: TenantApplication = {
      applicationId,
      userId: data.userId,
      propertyId: data.propertyId,
      propertyTitle: data.propertyTitle,
      propertyLocation: data.propertyLocation,
      annualRent: data.annualRent,
      deposit: data.deposit,
      duration: data.duration,
      totalAmount,
      monthlyPayment,
      status: TenantApplicationStatus.PENDING,
      hasAgreedToTerms: data.hasAgreedToTerms,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.applications.set(applicationId, application);
    return application;
  }

  async findById(applicationId: string): Promise<TenantApplication | null> {
    return this.applications.get(applicationId) || null;
  }

  async findByUserId(
    userId: string,
    filters?: {
      status?: TenantApplicationStatus;
      limit?: number;
      cursor?: string;
    },
  ): Promise<{ applications: TenantApplication[]; nextCursor?: string }> {
    const limit = filters?.limit || 20;
    let applications = Array.from(this.applications.values()).filter(
      (app) => app.userId === userId,
    );

    if (filters?.status) {
      applications = applications.filter(
        (app) => app.status === filters.status,
      );
    }

    // Sort by createdAt descending
    applications.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    // Simple cursor-based pagination
    if (filters?.cursor) {
      const cursorIndex = applications.findIndex(
        (app) => app.applicationId === filters.cursor,
      );
      if (cursorIndex !== -1) {
        applications = applications.slice(cursorIndex + 1);
      }
    }

    const paginatedApps = applications.slice(0, limit);
    const nextCursor =
      paginatedApps.length === limit
        ? paginatedApps[paginatedApps.length - 1].applicationId
        : undefined;

    return { applications: paginatedApps, nextCursor };
  }

  async updateStatus(
    applicationId: string,
    status: TenantApplicationStatus,
    reviewedBy?: string,
    rejectionReason?: string,
  ): Promise<TenantApplication | null> {
    const application = this.applications.get(applicationId);
    if (!application) return null;

    application.status = status;
    application.updatedAt = new Date().toISOString();
    application.reviewedAt = new Date().toISOString();
    application.reviewedBy = reviewedBy;
    application.rejectionReason = rejectionReason;

    this.applications.set(applicationId, application);
    return application;
  }

  // Test helper
  async clear(): Promise<void> {
    this.applications.clear();
    this.counter = 1;
  }
}

/**
 * PostgreSQL implementation
 */
export class PostgresTenantApplicationStore implements TenantApplicationStore {
  async create(data: CreateTenantApplicationData): Promise<TenantApplication> {
    const pool = await getPool();
    if (!pool) throw new Error("Database pool not initialized");
    const totalAmount = data.annualRent - data.deposit;
    const monthlyPayment = totalAmount / data.duration;

    const result = await pool.query(
      `INSERT INTO tenant_applications (
        user_id, property_id, property_title, property_location,
        annual_rent, deposit, duration, total_amount, monthly_payment,
        status, has_agreed_to_terms, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING 
        id as application_id,
        user_id,
        property_id,
        property_title,
        property_location,
        annual_rent,
        deposit,
        duration,
        total_amount,
        monthly_payment,
        status,
        has_agreed_to_terms,
        created_at,
        updated_at,
        reviewed_at,
        reviewed_by,
        rejection_reason`,
      [
        data.userId,
        data.propertyId,
        data.propertyTitle || null,
        data.propertyLocation || null,
        data.annualRent,
        data.deposit,
        data.duration,
        totalAmount,
        monthlyPayment,
        TenantApplicationStatus.PENDING,
        data.hasAgreedToTerms,
      ],
    );

    return this.mapRow(result.rows[0]);
  }

  async findById(applicationId: string): Promise<TenantApplication | null> {
    const pool = await getPool();
    if (!pool) throw new Error("Database pool not initialized");
    const result = await pool.query(
      `SELECT 
        id as application_id,
        user_id,
        property_id,
        property_title,
        property_location,
        annual_rent,
        deposit,
        duration,
        total_amount,
        monthly_payment,
        status,
        has_agreed_to_terms,
        created_at,
        updated_at,
        reviewed_at,
        reviewed_by,
        rejection_reason
      FROM tenant_applications
      WHERE id = $1`,
      [applicationId],
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async findByUserId(
    userId: string,
    filters?: {
      status?: TenantApplicationStatus;
      limit?: number;
      cursor?: string;
    },
  ): Promise<{ applications: TenantApplication[]; nextCursor?: string }> {
    const pool = await getPool();
    if (!pool) throw new Error("Database pool not initialized");
    const limit = filters?.limit || 20;
    const params: any[] = [userId, limit + 1];
    let query = `
      SELECT 
        id as application_id,
        user_id,
        property_id,
        property_title,
        property_location,
        annual_rent,
        deposit,
        duration,
        total_amount,
        monthly_payment,
        status,
        has_agreed_to_terms,
        created_at,
        updated_at,
        reviewed_at,
        reviewed_by,
        rejection_reason
      FROM tenant_applications
      WHERE user_id = $1
    `;

    if (filters?.status) {
      params.push(filters.status);
      query += ` AND status = $${params.length}`;
    }

    if (filters?.cursor) {
      params.push(filters.cursor);
      query += ` AND created_at < (SELECT created_at FROM tenant_applications WHERE id = $${params.length})`;
    }

    query += ` ORDER BY created_at DESC LIMIT $2`;

    const result = await pool.query(query, params);
    const applications = result.rows.map((row) => this.mapRow(row));

    const hasMore = applications.length > limit;
    if (hasMore) applications.pop();

    const nextCursor =
      hasMore && applications.length > 0
        ? applications[applications.length - 1].applicationId
        : undefined;

    return { applications, nextCursor };
  }

  async updateStatus(
    applicationId: string,
    status: TenantApplicationStatus,
    reviewedBy?: string,
    rejectionReason?: string,
  ): Promise<TenantApplication | null> {
    const pool = await getPool();
    if (!pool) throw new Error("Database pool not initialized");
    const result = await pool.query(
      `UPDATE tenant_applications
      SET status = $1, reviewed_at = NOW(), reviewed_by = $2, rejection_reason = $3, updated_at = NOW()
      WHERE id = $4
      RETURNING 
        id as application_id,
        user_id,
        property_id,
        property_title,
        property_location,
        annual_rent,
        deposit,
        duration,
        total_amount,
        monthly_payment,
        status,
        has_agreed_to_terms,
        created_at,
        updated_at,
        reviewed_at,
        reviewed_by,
        rejection_reason`,
      [status, reviewedBy || null, rejectionReason || null, applicationId],
    );

    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  private mapRow(row: any): TenantApplication {
    return {
      applicationId: row.application_id,
      userId: row.user_id,
      propertyId: row.property_id,
      propertyTitle: row.property_title,
      propertyLocation: row.property_location,
      annualRent: parseFloat(row.annual_rent),
      deposit: parseFloat(row.deposit),
      duration: row.duration,
      totalAmount: parseFloat(row.total_amount),
      monthlyPayment: parseFloat(row.monthly_payment),
      status: row.status,
      hasAgreedToTerms: row.has_agreed_to_terms,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      reviewedAt: row.reviewed_at?.toISOString(),
      reviewedBy: row.reviewed_by,
      rejectionReason: row.rejection_reason,
    };
  }
}

// Singleton instance
let tenantApplicationStore: TenantApplicationStore =
  new InMemoryTenantApplicationStore();

export function initTenantApplicationStore(
  store: TenantApplicationStore,
): void {
  tenantApplicationStore = store;
}

export { tenantApplicationStore };
