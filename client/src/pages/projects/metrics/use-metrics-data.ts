import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  type GrantMetric,
  type GrantMetricEvent,
  type MetricSuggestion,
  type RecordMetricEventPayload,
  type MetricsResponse,
} from "@/lib/api";
import { workspaceKeys } from "@/lib/workspace-query-keys";

export function metricsQueryKey(projectId: string, organizationId?: string | null) {
  return workspaceKeys.projectMetrics(organizationId, projectId);
}

export function metricHistoryQueryKey(metricId: string) {
  return workspaceKeys.metricHistory(metricId);
}

export function useMetrics(projectId: string, organizationId?: string | null) {
  return useQuery<MetricsResponse>({
    queryKey: metricsQueryKey(projectId, organizationId),
    queryFn: () => api.getProjectMetrics(projectId),
    enabled: Boolean(projectId),
  });
}

export function useCreateMetric(projectId: string, organizationId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<GrantMetric> & { presetKey?: string }) =>
      api.createMetric(projectId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: metricsQueryKey(projectId, organizationId) });
    },
  });
}

export function useUpdateMetric(projectId: string, organizationId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<GrantMetric> & { note?: string } }) =>
      api.updateMetric(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: metricsQueryKey(projectId, organizationId) });
    },
  });
}

export function useMetricHistory(metricId: string | null | undefined) {
  return useQuery<GrantMetricEvent[]>({
    queryKey: metricHistoryQueryKey(metricId ?? ""),
    queryFn: () => api.getMetricHistory(metricId!),
    enabled: Boolean(metricId),
  });
}

export function useRecordMetricEvent(projectId: string, organizationId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & RecordMetricEventPayload) =>
      api.recordMetricEvent(id, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: metricsQueryKey(projectId, organizationId) });
      qc.invalidateQueries({ queryKey: metricHistoryQueryKey(variables.id) });
    },
  });
}

export function useDeleteMetric(projectId: string, organizationId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteMetric(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: metricsQueryKey(projectId, organizationId) });
    },
  });
}

export function useAcceptMetric(projectId: string, organizationId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.acceptMetric(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: metricsQueryKey(projectId, organizationId) });
    },
  });
}

export function useDismissMetric(projectId: string, organizationId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.dismissMetric(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: metricsQueryKey(projectId, organizationId) });
    },
  });
}

export function useExtractMetrics(projectId: string) {
  return useMutation({
    mutationFn: (file: File) => api.extractMetricsFromFile(projectId, file),
  });
}

export function useBulkCreateMetrics(projectId: string, organizationId?: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (suggestions: MetricSuggestion[]) =>
      api.bulkCreateMetrics(projectId, suggestions, { status: "active", source: "ai_suggested" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: metricsQueryKey(projectId, organizationId) });
    },
  });
}
