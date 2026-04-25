import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Sparkles, BarChart3 } from "lucide-react";
import { api, type GrantMetric, type MetricCategory } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  useAcceptMetric,
  useBulkCreateMetrics,
  useCreateMetric,
  useDeleteMetric,
  useDismissMetric,
  useMetricHistory,
  useExtractMetrics,
  useMetrics,
  useRecordMetricEvent,
  useUpdateMetric,
} from "./use-metrics-data";
import { ApplicationMetricsCard } from "./ApplicationMetricsCard";
import { MetricCard } from "./MetricCard";
import { MetricHistoryDialog } from "./MetricHistoryDialog";
import { MetricEditorDialog } from "./MetricEditorDialog";
import { MetricsReportingSummary } from "./MetricsReportingSummary";
import { RecordMetricUpdateDialog } from "./RecordMetricUpdateDialog";
import { ExtractFromFileDialog } from "./ExtractFromFileDialog";
import { CATEGORY_LABELS, CATEGORY_ORDER, groupMetricsByCategory } from "./utils";

interface MetricsTabProps {
  projectId: string;
}

export function MetricsTab({ projectId }: MetricsTabProps) {
  const { toast } = useToast();
  const { data, isLoading, error } = useMetrics(projectId);

  const createMetric = useCreateMetric(projectId);
  const updateMetric = useUpdateMetric(projectId);
  const recordMetricEvent = useRecordMetricEvent(projectId);
  const deleteMetric = useDeleteMetric(projectId);
  const acceptMetric = useAcceptMetric(projectId);
  const dismissMetric = useDismissMetric(projectId);
  const extractMetrics = useExtractMetrics(projectId);
  const bulkCreate = useBulkCreateMetrics(projectId);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editingMetric, setEditingMetric] = useState<GrantMetric | null>(null);
  const [recordingMetric, setRecordingMetric] = useState<GrantMetric | null>(null);
  const [historyMetric, setHistoryMetric] = useState<GrantMetric | null>(null);
  const [extractOpen, setExtractOpen] = useState(false);
  const history = useMetricHistory(historyMetric?.id);

  const { suggestedMetrics, grouped } = useMemo(() => {
    const all = data?.metrics ?? [];
    const suggested = all.filter(m => m.status === "suggested");
    const active = all.filter(m => m.status !== "suggested" && m.status !== "dismissed");
    return {
      suggestedMetrics: suggested,
      grouped: groupMetricsByCategory(active),
    };
  }, [data]);

  const handleEdit = (metric: GrantMetric) => {
    setEditingMetric(metric);
    setEditorMode("edit");
    setEditorOpen(true);
  };

  const handleAdd = () => {
    setEditingMetric(null);
    setEditorMode("create");
    setEditorOpen(true);
  };

  const handleRecordUpdate = (metric: GrantMetric) => {
    setRecordingMetric(metric);
  };

  const handleViewHistory = (metric: GrantMetric) => {
    setHistoryMetric(metric);
  };

  const handleDelete = async (metric: GrantMetric) => {
    if (!window.confirm(`Delete metric "${metric.label}"?`)) return;
    await deleteMetric.mutateAsync(metric.id).catch(err => {
      toast({
        title: "Failed to delete",
        description: err?.message ?? "Unable to delete metric.",
        variant: "destructive",
      });
    });
  };

  const handleAcceptSuggestion = async (metric: GrantMetric) => {
    await acceptMetric.mutateAsync(metric.id);
  };

  const handleDismissSuggestion = async (metric: GrantMetric) => {
    await dismissMetric.mutateAsync(metric.id);
  };

  const handleSubmitMetric = async (payload: {
    presetKey?: string;
    key: string;
    label: string;
    type: GrantMetric["type"];
    category: MetricCategory;
    unit?: string | null;
    value?: string | null;
    target?: string | null;
  }) => {
    if (editorMode === "edit" && editingMetric) {
      await updateMetric.mutateAsync({
        id: editingMetric.id,
        updates: {
          label: payload.label,
          type: payload.type,
          category: payload.category,
          unit: payload.unit ?? null,
          value: payload.value ?? null,
          target: payload.target ?? null,
        },
      });
    } else {
      await createMetric.mutateAsync(payload);
    }
  };

  const handleSubmitMetricUpdate = async (payload: { value: string; note?: string | null }) => {
    if (!recordingMetric) return;
    try {
      await recordMetricEvent.mutateAsync({
        id: recordingMetric.id,
        value: payload.value,
        note: payload.note,
      });
      toast({
        title: "Metric updated",
        description: `${recordingMetric.label} is ready for reporting.`,
      });
    } catch (err: any) {
      toast({
        title: "Failed to record update",
        description: err?.message ?? "Unable to update this metric.",
        variant: "destructive",
      });
      throw err;
    }
  };

  const handleCopyReportSummary = async () => {
    try {
      const summary = await api.getMetricsReportSummary(projectId);
      await navigator.clipboard.writeText(summary.text);
      toast({
        title: "Report summary copied",
        description: "Metrics are ready to paste into a funder update or report.",
      });
    } catch (err: any) {
      toast({
        title: "Failed to copy summary",
        description: err?.message ?? "Your browser did not allow clipboard access.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-64 animate-pulse rounded-lg bg-slate-100" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-red-600">
          Failed to load metrics. {(error as Error)?.message}
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const activeCount = Object.values(grouped).reduce((sum, g) => sum + g.length, 0);

  return (
    <div className="space-y-6">
      {/* Application (auto-derived) metrics */}
      <ApplicationMetricsCard data={data.application} />

      <MetricsReportingSummary
        metrics={data.metrics}
        project={data.project}
        onRecordUpdate={handleRecordUpdate}
        onCopyReport={handleCopyReportSummary}
      />

      {/* Outcome metrics header + actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-slate-600" />
            Outcome metrics
          </h3>
          <p className="text-sm text-slate-600">
            Track commitments, outputs, and impact. Extract suggestions from the RFP or add your own.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setExtractOpen(true)}>
            <Sparkles className="h-4 w-4 mr-2" />
            Extract from file
          </Button>
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add metric
          </Button>
        </div>
      </div>

      {/* Suggested metrics (ai or otherwise) */}
      {suggestedMetrics.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <h4 className="text-sm font-semibold text-slate-900">
              Suggested from your documents
            </h4>
            <span className="text-xs text-slate-500">
              {suggestedMetrics.length} pending
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {suggestedMetrics.map(m => (
              <MetricCard
                key={m.id}
                metric={m}
                onEdit={handleEdit}
                onRecordUpdate={handleRecordUpdate}
                onViewHistory={handleViewHistory}
                onDelete={handleDelete}
                onAccept={handleAcceptSuggestion}
                onDismiss={handleDismissSuggestion}
              />
            ))}
          </div>
        </section>
      )}

      {activeCount === 0 && suggestedMetrics.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <BarChart3 className="h-5 w-5 text-slate-400" />
            </div>
            <h4 className="text-base font-medium text-slate-900">No metrics yet</h4>
            <p className="text-sm text-slate-600 mt-1">
              Upload the grant application to auto-suggest metrics, or add one manually.
            </p>
            <div className="flex justify-center gap-2 mt-4">
              <Button variant="outline" onClick={() => setExtractOpen(true)}>
                <Sparkles className="h-4 w-4 mr-2" />
                Extract from file
              </Button>
              <Button onClick={handleAdd}>
                <Plus className="h-4 w-4 mr-2" />
                Add metric
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active metrics by category */}
      {CATEGORY_ORDER.map(category => {
        const metrics = grouped[category];
        if (metrics.length === 0) return null;
        return (
          <section key={category}>
            <h4 className="text-sm font-semibold text-slate-900 mb-2">
              {CATEGORY_LABELS[category]}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {metrics.map(m => (
                <MetricCard
                  key={m.id}
                  metric={m}
                  onEdit={handleEdit}
                  onRecordUpdate={handleRecordUpdate}
                  onViewHistory={handleViewHistory}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </section>
        );
      })}

      <MetricEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        mode={editorMode}
        metric={editingMetric}
        presets={data.presets}
        onSubmit={handleSubmitMetric}
      />

      <RecordMetricUpdateDialog
        open={Boolean(recordingMetric)}
        onOpenChange={open => {
          if (!open) setRecordingMetric(null);
        }}
        metric={recordingMetric}
        onSubmit={handleSubmitMetricUpdate}
      />

      <MetricHistoryDialog
        open={Boolean(historyMetric)}
        onOpenChange={open => {
          if (!open) setHistoryMetric(null);
        }}
        metric={historyMetric}
        events={history.data ?? []}
        isLoading={history.isLoading}
      />

      <ExtractFromFileDialog
        open={extractOpen}
        onOpenChange={setExtractOpen}
        onExtract={file => extractMetrics.mutateAsync(file)}
        onAccept={suggestions => bulkCreate.mutateAsync(suggestions)}
      />
    </div>
  );
}
