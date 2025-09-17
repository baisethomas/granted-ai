"use client";

import { useAppStore, type AppState } from "@/stores/app";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export default function SettingsPage() {
  const organizationName = useAppStore((s) => s.organizationName);
  const setOrganizationName = useAppStore((s) => s.setOrganizationName);
  const tone = useAppStore((s) => s.tone);
  const setTone = useAppStore((s) => s.setTone);

  return (
    <div className="container py-8 space-y-6">
      <h1 className="text-2xl font-semibold">Settings & Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Organization Name</label>
            <Input
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="Acme Nonprofit"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Tone Preference</label>
            <Select value={tone} onChange={(e) => setTone(e.target.value as AppState["tone"])}>
              <option>Professional</option>
              <option>Data-Driven</option>
              <option>Storytelling</option>
              <option>Inspirational</option>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
