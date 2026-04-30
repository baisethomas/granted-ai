// @vitest-environment node

import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { registerRoutes } from "./routes.js";
import { MemStorage, storage } from "./storage.js";

vi.mock("./middleware/supabaseAuth.js", () => ({
  requireSupabaseUser: (req: any, _res: any, next: any) => {
    req.supabaseUser = {
      id: req.headers["x-test-user"] || "workspace-route-user",
      email: `${req.headers["x-test-user"] || "workspace-route-user"}@example.com`,
    };
    next();
  },
  supabaseAdminClient: {
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        remove: async () => ({ error: null }),
        createSignedUrl: async () => ({ data: { signedUrl: "https://example.com/doc" } }),
      }),
    },
  },
}));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: vi.fn(),
      },
    };
    embeddings = {
      create: vi.fn(),
    };
  },
}));

let server: ReturnType<typeof import("http").createServer>;
let baseUrl = "";

async function requestJson(path: string, userId: string, init: RequestInit = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-test-user": userId,
      ...(init.headers || {}),
    },
  });
}

async function postJson(path: string, userId: string, body: unknown) {
  return requestJson(path, userId, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  server = await registerRoutes(app);
  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address === "object") {
        baseUrl = `http://127.0.0.1:${address.port}`;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

describe("workspace route isolation", () => {
  it("lists and creates projects only inside the requested workspace", async () => {
    const userId = "workspace-project-user";

    const orgAResponse = await postJson("/api/organizations", userId, { name: "Client A" });
    const orgBResponse = await postJson("/api/organizations", userId, { name: "Client B" });
    const orgA = await orgAResponse.json();
    const orgB = await orgBResponse.json();

    await postJson(`/api/organizations/${orgA.id}/projects`, userId, {
      title: "Client A Grant",
      funder: "A Funder",
    });
    await postJson(`/api/organizations/${orgB.id}/projects`, userId, {
      title: "Client B Grant",
      funder: "B Funder",
    });

    const orgAProjectsResponse = await requestJson(`/api/organizations/${orgA.id}/projects`, userId);
    const orgBProjectsResponse = await requestJson(`/api/organizations/${orgB.id}/projects`, userId);
    const orgAProjects = await orgAProjectsResponse.json();
    const orgBProjects = await orgBProjectsResponse.json();

    expect(orgAProjectsResponse.status).toBe(200);
    expect(orgBProjectsResponse.status).toBe(200);
    expect(orgAProjects).toHaveLength(1);
    expect(orgBProjects).toHaveLength(1);
    expect(orgAProjects[0]).toMatchObject({ title: "Client A Grant", organizationId: orgA.id });
    expect(orgBProjects[0]).toMatchObject({ title: "Client B Grant", organizationId: orgB.id });
  });

  it("does not allow another user to read a workspace they are not a member of", async () => {
    const ownerId = "workspace-owner-user";
    const outsiderId = "workspace-outsider-user";

    const orgResponse = await postJson("/api/organizations", ownerId, { name: "Private Client" });
    const org = await orgResponse.json();

    const response = await requestJson(`/api/organizations/${org.id}/projects`, outsiderId);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Organization not found");
  });

  it("lists documents only inside the requested workspace", async () => {
    const userId = "workspace-document-user";
    const orgA = await (await postJson("/api/organizations", userId, { name: "Doc Client A" })).json();
    const orgB = await (await postJson("/api/organizations", userId, { name: "Doc Client B" })).json();

    await storage.createDocumentForOrganization(userId, orgA.id, {
      organizationId: orgA.id,
      filename: "a.txt",
      originalName: "A Context.txt",
      fileType: "text/plain",
      fileSize: 10,
      category: "organization-info",
    });
    await storage.createDocumentForOrganization(userId, orgB.id, {
      organizationId: orgB.id,
      filename: "b.txt",
      originalName: "B Context.txt",
      fileType: "text/plain",
      fileSize: 10,
      category: "organization-info",
    });

    const orgADocs = await (await requestJson(`/api/organizations/${orgA.id}/documents`, userId)).json();
    const orgBDocs = await (await requestJson(`/api/organizations/${orgB.id}/documents`, userId)).json();

    expect(orgADocs.map((doc: any) => doc.originalName)).toEqual(["A Context.txt"]);
    expect(orgBDocs.map((doc: any) => doc.originalName)).toEqual(["B Context.txt"]);
  });

  it("accepts profile suggestions only inside the requested workspace", async () => {
    const ownerId = "workspace-profile-owner";
    const outsiderId = "workspace-profile-outsider";
    const org = await (await postJson("/api/organizations", ownerId, { name: "Profile Client" })).json();
    const document = await storage.createDocumentForOrganization(ownerId, org.id, {
      organizationId: org.id,
      filename: "profile.txt",
      originalName: "Profile.txt",
      fileType: "text/plain",
      fileSize: 10,
      category: "organization-info",
    });
    const [suggestion] = await storage.createOrganizationProfileSuggestions(ownerId, org.id, document.id, [
      {
        field: "mission",
        suggestedValue: "Improve community health through accessible education and care.",
        confidence: 85,
        sourceQuote: "Mission: Improve community health through accessible education and care.",
      },
    ]);

    const outsiderResponse = await postJson(
      `/api/organizations/${org.id}/profile-suggestions/${suggestion.id}/review`,
      outsiderId,
      { status: "accepted" },
    );
    expect(outsiderResponse.status).toBe(404);

    const ownerResponse = await postJson(
      `/api/organizations/${org.id}/profile-suggestions/${suggestion.id}/review`,
      ownerId,
      { status: "accepted" },
    );
    const body = await ownerResponse.json();
    const updatedOrg = await storage.getOrganization(org.id);

    expect(ownerResponse.status).toBe(200);
    expect(body.suggestion.status).toBe("accepted");
    expect(updatedOrg?.mission).toBe("Improve community health through accessible education and care.");
  });

  it("restores dismissed profile suggestions to the review queue", async () => {
    const userId = "workspace-profile-restore";
    const org = await (await postJson("/api/organizations", userId, { name: "Restore Client" })).json();
    const document = await storage.createDocumentForOrganization(userId, org.id, {
      organizationId: org.id,
      filename: "restore-profile.txt",
      originalName: "Restore Profile.txt",
      fileType: "text/plain",
      fileSize: 10,
      category: "organization-info",
    });
    const [suggestion] = await storage.createOrganizationProfileSuggestions(userId, org.id, document.id, [
      {
        field: "primaryContact",
        suggestedValue: "Jordan Lee",
        confidence: 78,
        sourceQuote: "Primary contact: Jordan Lee",
      },
    ]);

    const dismissResponse = await postJson(
      `/api/organizations/${org.id}/profile-suggestions/${suggestion.id}/review`,
      userId,
      { status: "rejected" },
    );
    expect(dismissResponse.status).toBe(200);

    const restoreResponse = await postJson(
      `/api/organizations/${org.id}/profile-suggestions/${suggestion.id}/review`,
      userId,
      { status: "pending" },
    );
    const body = await restoreResponse.json();

    expect(restoreResponse.status).toBe(200);
    expect(body.suggestion.status).toBe("pending");
    expect(body.suggestion.reviewedBy).toBeNull();
    expect(body.suggestion.reviewedAt).toBeNull();
  });

  it("accepts dismissed as an alias when dismissing profile suggestions", async () => {
    const userId = "workspace-profile-dismissed-alias";
    const org = await (await postJson("/api/organizations", userId, { name: "Dismissed Alias Client" })).json();
    const document = await storage.createDocumentForOrganization(userId, org.id, {
      organizationId: org.id,
      filename: "dismissed-alias-profile.txt",
      originalName: "Dismissed Alias Profile.txt",
      fileType: "text/plain",
      fileSize: 10,
      category: "organization-info",
    });
    const [suggestion] = await storage.createOrganizationProfileSuggestions(userId, org.id, document.id, [
      {
        field: "ein",
        suggestedValue: "12-3456789",
        confidence: 80,
        sourceQuote: "EIN: 12-3456789",
      },
    ]);

    const dismissResponse = await postJson(
      `/api/organizations/${org.id}/profile-suggestions/${suggestion.id}/review`,
      userId,
      { status: "dismissed" },
    );
    const dismissBody = await dismissResponse.json();
    expect(dismissResponse.status).toBe(200);
    expect(dismissBody.suggestion.status).toBe("rejected");

    const restoreResponse = await postJson(
      `/api/organizations/${org.id}/profile-suggestions/${suggestion.id}/review`,
      userId,
      { status: "pending" },
    );
    const restoreBody = await restoreResponse.json();
    expect(restoreResponse.status).toBe(200);
    expect(restoreBody.suggestion.status).toBe("pending");
  });

  it("accepts a dismissed profile suggestion without requiring restore first", async () => {
    const userId = "workspace-profile-accept-dismissed";
    const org = await (await postJson("/api/organizations", userId, { name: "Accept Dismissed Client" })).json();
    const document = await storage.createDocumentForOrganization(userId, org.id, {
      organizationId: org.id,
      filename: "accept-dismissed-profile.txt",
      originalName: "Accept Dismissed Profile.txt",
      fileType: "text/plain",
      fileSize: 10,
      category: "organization-info",
    });
    const [suggestion] = await storage.createOrganizationProfileSuggestions(userId, org.id, document.id, [
      {
        field: "primaryContact",
        suggestedValue: "Avery Stone",
        confidence: 82,
        sourceQuote: "Primary contact: Avery Stone",
      },
    ]);

    await postJson(
      `/api/organizations/${org.id}/profile-suggestions/${suggestion.id}/review`,
      userId,
      { status: "rejected" },
    );

    const acceptResponse = await postJson(
      `/api/organizations/${org.id}/profile-suggestions/${suggestion.id}/review`,
      userId,
      { status: "accepted" },
    );
    const body = await acceptResponse.json();
    const updatedOrg = await storage.getOrganization(org.id);

    expect(acceptResponse.status).toBe(200);
    expect(body.suggestion.status).toBe("accepted");
    expect(updatedOrg?.primaryContact).toBe("Avery Stone");
  });

  it("backfills profile suggestions from existing organization documents", async () => {
    const userId = "workspace-profile-backfill";
    const org = await (await postJson("/api/organizations", userId, { name: "Backfill Client" })).json();
    await storage.createDocumentForOrganization(userId, org.id, {
      organizationId: org.id,
      filename: "backfill-profile.txt",
      originalName: "Backfill Profile.txt",
      fileType: "text/plain",
      fileSize: 10,
      category: "organization-info",
      summary: "Mission: Improve community health through accessible education and care. EIN: 12-3456789.",
      processed: true,
      processingStatus: "complete",
    });

    const response = await requestJson(`/api/organizations/${org.id}/profile-suggestions`, userId);
    const suggestions = await response.json();

    expect(response.status).toBe(200);
    expect(suggestions.some((suggestion: any) => suggestion.field === "mission")).toBe(true);
    expect(suggestions.some((suggestion: any) => suggestion.field === "ein")).toBe(true);
  });
});

describe("workspace retrieval isolation", () => {
  it("returns chunks only from the requested organization and matching project scope", async () => {
    const store = new MemStorage();
    const userId = "retrieval-user";
    const orgA = await store.createOrganization(userId, { name: "Retrieval Client A" });
    const orgB = await store.createOrganization(userId, { name: "Retrieval Client B" });
    const projectA = await store.createProjectForOrganization(userId, orgA.id, {
      title: "A Project",
      funder: "A Funder",
    });
    const projectB = await store.createProjectForOrganization(userId, orgA.id, {
      title: "B Project",
      funder: "B Funder",
    });

    const workspaceDoc = await store.createDocumentForOrganization(userId, orgA.id, {
      organizationId: orgA.id,
      filename: "workspace.txt",
      originalName: "Workspace Context.txt",
      fileType: "text/plain",
      fileSize: 10,
      category: "organization-info",
    });
    const projectDoc = await store.createDocumentForOrganization(userId, orgA.id, {
      organizationId: orgA.id,
      projectId: projectA.id,
      filename: "project-a.txt",
      originalName: "Project A Context.txt",
      fileType: "text/plain",
      fileSize: 10,
      category: "organization-info",
    });
    const otherProjectDoc = await store.createDocumentForOrganization(userId, orgA.id, {
      organizationId: orgA.id,
      projectId: projectB.id,
      filename: "project-b.txt",
      originalName: "Project B Context.txt",
      fileType: "text/plain",
      fileSize: 10,
      category: "organization-info",
    });
    const otherOrgDoc = await store.createDocumentForOrganization(userId, orgB.id, {
      organizationId: orgB.id,
      filename: "other-org.txt",
      originalName: "Other Org Context.txt",
      fileType: "text/plain",
      fileSize: 10,
      category: "organization-info",
    });

    await store.insertDocChunk(workspaceDoc.id, {
      chunkIndex: 0,
      content: "Shared workspace mission context",
      tokenCount: 4,
      embedding: [1, 0, 0],
    });
    await store.insertDocChunk(projectDoc.id, {
      chunkIndex: 0,
      content: "Specific project A context",
      tokenCount: 4,
      embedding: [1, 0, 0],
    });
    await store.insertDocChunk(otherProjectDoc.id, {
      chunkIndex: 0,
      content: "Specific project B context",
      tokenCount: 4,
      embedding: [1, 0, 0],
    });
    await store.insertDocChunk(otherOrgDoc.id, {
      chunkIndex: 0,
      content: "Other org context",
      tokenCount: 3,
      embedding: [1, 0, 0],
    });

    const results = await store.searchDocChunksByEmbeddingForOrganization(
      userId,
      orgA.id,
      [1, 0, 0],
      10,
      projectA.id
    );

    expect(results.map((result) => result.document.originalName).sort()).toEqual([
      "Project A Context.txt",
      "Workspace Context.txt",
    ]);
  });
});
