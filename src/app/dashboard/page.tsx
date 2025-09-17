"use client";

import { useAppStore } from "@/stores/app";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function DashboardPage() {
  const projects = useAppStore((s) => s.projects);
  const addProject = useAppStore((s) => s.addProject);

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Welcome to Granted</h1>
          <p className="text-sm text-black/70">Create a project and start drafting funder-aligned applications.</p>
        </div>
        <Button onClick={() => addProject({ id: Date.now().toString(), name: `Project ${projects.length + 1}` })}>New Project</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Win Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">—%</div>
            <div className="text-xs text-black/60">Connect results to see trends</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{projects.length}</div>
            <div className="text-xs text-black/60">Keep momentum going</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Deadlines</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">0</div>
            <div className="text-xs text-black/60">Sync your calendar (soon)</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <div className="text-sm text-black/70">
                No projects yet. Create one to get started or go to {" "}
                <Link className="underline" href="/upload">Upload</Link> to ingest docs.
              </div>
            ) : (
              <div className="space-y-3">
                {projects.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 p-3 rounded-lg border border-black/10">
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-black/60">Won: {p.stats?.won ?? 0} • Submitted: {p.stats?.submitted ?? 0}</div>
                    </div>
                    <Link href="/grant-form" className="text-sm underline">Open</Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Start</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-black/70">Three steps to your first draft:</div>
            <ol className="list-decimal list-inside text-sm space-y-1 text-black/80">
              <li>Upload your org documents</li>
              <li>Paste the funder questions</li>
              <li>Generate and export your draft</li>
            </ol>
            <div className="flex gap-2 pt-2">
              <Link href="/upload"><Button variant="secondary">Upload Docs</Button></Link>
              <Link href="/grant-form"><Button>Grant Form</Button></Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
