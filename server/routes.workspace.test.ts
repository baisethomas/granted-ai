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
