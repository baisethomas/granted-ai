import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { randomUUID } from 'node:crypto';

import { registerRoutes } from '../server/routes.js';
import { storage, MemStorage } from '../server/storage.js';

type TestServer = {
  baseUrl: string;
  close: () => void;
};

async function createAppForUser(userId: string): Promise<TestServer> {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { id: userId };
    next();
  });

  const server = await registerRoutes(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Failed to determine server address');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => server.close()
  };
}

async function jsonRequest(
  baseUrl: string,
  path: string,
  options: RequestInit = {}
): Promise<{ status: number; body: any }> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers
  });

  let data: any = undefined;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  return { status: response.status, body: data };
}

function resetStorage(): void {
  if (storage instanceof MemStorage) {
    storage.reset();
  }
}

beforeEach(() => {
  resetStorage();
});

test('users cannot view projects owned by others', async (t) => {
  const ownerId = randomUUID();
  const otherUserId = randomUUID();

  const project = await storage.createProject(ownerId, {
    title: 'Protected Project',
    funder: 'Funder',
    amount: '$1000',
    deadline: new Date(),
    description: 'Top secret'
  } as any);

  const { baseUrl, close } = await createAppForUser(otherUserId);
  t.after(() => close());

  const response = await jsonRequest(baseUrl, `/api/projects/${project.id}`);
  assert.equal(response.status, 404);
});

test('users cannot update projects owned by others', async (t) => {
  const ownerId = randomUUID();
  const otherUserId = randomUUID();

  const project = await storage.createProject(ownerId, {
    title: 'Needs Protection',
    funder: 'Funder',
    amount: '$5000',
    deadline: new Date(),
    description: 'Sensitive details'
  } as any);

  const { baseUrl, close } = await createAppForUser(otherUserId);
  t.after(() => close());

  const response = await jsonRequest(baseUrl, `/api/projects/${project.id}`, {
    method: 'PUT',
    body: JSON.stringify({ title: 'Compromised' })
  });

  assert.equal(response.status, 404);
});

test('project owners can update their projects', async (t) => {
  const ownerId = randomUUID();

  const project = await storage.createProject(ownerId, {
    title: 'Editable Project',
    funder: 'Funder',
    amount: '$7500',
    deadline: new Date(),
    description: 'Original description'
  } as any);

  const { baseUrl, close } = await createAppForUser(ownerId);
  t.after(() => close());

  const response = await jsonRequest(baseUrl, `/api/projects/${project.id}`, {
    method: 'PUT',
    body: JSON.stringify({ title: 'Updated Title' })
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.title, 'Updated Title');
});

test('users cannot delete documents owned by others', async (t) => {
  const ownerId = randomUUID();
  const otherUserId = randomUUID();

  const document = await storage.createDocument(ownerId, {
    filename: 'doc.txt',
    originalName: 'doc.txt',
    fileType: 'text/plain',
    fileSize: 42,
    category: 'organization-info',
    summary: null,
    processed: false,
    embeddingStatus: 'pending',
    chunkCount: 0,
    embeddingModel: 'text-embedding-3-small'
  } as any);

  const { baseUrl, close } = await createAppForUser(otherUserId);
  t.after(() => close());

  const response = await jsonRequest(baseUrl, `/api/documents/${document.id}`, {
    method: 'DELETE'
  });
  assert.equal(response.status, 404);
});

test('users cannot edit responses for questions on other users projects', async (t) => {
  const ownerId = randomUUID();
  const otherUserId = randomUUID();

  const project = await storage.createProject(ownerId, {
    title: 'Q&A Project',
    funder: 'Funder',
    amount: '$1200',
    deadline: new Date(),
    description: 'Contains sensitive questions'
  } as any);

  const question = await storage.createGrantQuestion(project.id, {
    question: 'Describe the mission',
    wordLimit: 100,
    priority: 'high',
    errorMessage: null
  } as any);

  await storage.updateGrantQuestion(question.id, { response: 'Initial answer' });

  const { baseUrl, close } = await createAppForUser(otherUserId);
  t.after(() => close());

  const response = await jsonRequest(baseUrl, `/api/questions/${question.id}/response`, {
    method: 'PUT',
    body: JSON.stringify({ content: 'Unauthorized update' })
  });

  assert.equal(response.status, 404);
});

test('question owners can edit responses exactly once per request', async (t) => {
  const ownerId = randomUUID();

  const project = await storage.createProject(ownerId, {
    title: 'Editable Q&A',
    funder: 'Funder',
    amount: '$2200',
    deadline: new Date(),
    description: 'Question edits should succeed'
  } as any);

  const question = await storage.createGrantQuestion(project.id, {
    question: 'Explain the program impact',
    wordLimit: 150,
    priority: 'medium',
    errorMessage: null
  } as any);

  await storage.updateGrantQuestion(question.id, { response: 'Initial impact statement' });

  const { baseUrl, close } = await createAppForUser(ownerId);
  t.after(() => close());

  const response = await jsonRequest(baseUrl, `/api/questions/${question.id}/response`, {
    method: 'PUT',
    body: JSON.stringify({ content: 'Updated impact statement' })
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'edited');
  assert.equal(response.body.content, 'Updated impact statement');
});
