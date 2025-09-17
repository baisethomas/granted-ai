import { create } from "zustand";

export type UploadedDocument = {
  id: string;
  name: string;
  path?: string;
  summary?: string;
};

export type Project = {
  id: string;
  name: string;
  deadline?: string;
  stats?: { won?: number; submitted?: number };
};

export type AppState = {
  organizationName: string;
  tone: "Professional" | "Data-Driven" | "Storytelling" | "Inspirational";
  documents: UploadedDocument[];
  projects: Project[];
  draft: string;
  setOrganizationName: (name: string) => void;
  setTone: (tone: AppState["tone"]) => void;
  addDocument: (doc: UploadedDocument) => void;
  updateDocumentSummary: (id: string, summary: string) => void;
  setDraft: (draft: string) => void;
  addProject: (project: Project) => void;
};

export const useAppStore = create<AppState>((set) => ({
  organizationName: "",
  tone: "Professional",
  documents: [],
  projects: [],
  draft: "",
  setOrganizationName: (organizationName) => set({ organizationName }),
  setTone: (tone) => set({ tone }),
  addDocument: (doc) => set((s) => ({ documents: [...s.documents, doc] })),
  updateDocumentSummary: (id, summary) =>
    set((s) => ({
      documents: s.documents.map((d) => (d.id === id ? { ...d, summary } : d)),
    })),
  setDraft: (draft) => set({ draft }),
  addProject: (project) => set((s) => ({ projects: [project, ...s.projects] })),
}));
