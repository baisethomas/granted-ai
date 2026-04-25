import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  type GrantMetric,
  type GrantMetricEvent,
  type MetricSuggestion,
  type RecordMetricEventPayload,
  type MetricsResponse,
} from "@/lib/api";

export function metricsQueryKey(projectId: string) {
  return ["metrics", projectId] as const;
}

export function metricHistoryQueryKey(metricId: string) {
  return ["metric-history", metricId] as const;
}

export function useMetrics(projectId: string) {
  return useQuery<MetricsResponse>({
    queryKey: metricsQueryKey(projectId),
    queryFn: () => api.getProjectMetrics(projectId),
    enabled: Boolean(projectId),
  });
}

export function useCreateMetric(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<GrantMetric> & { presetKey?: string }) =>
      api.createMetric(projectId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: metricsQueryKey(projectId) });
    },
  });
}

export function useUpdateMetric(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<GrantMetric> & { note?: string } }) =>
      api.updateMetric(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: metricsQueryKey(projectId) });
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

export function useRecordMetricEvent(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & RecordMetricEventPayload) =>
      api.recordMetricEvent(id, data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: metricsQueryKey(projectId) });
      qc.invalidateQueries({ queryKey: metricHistoryQueryKey(variables.id) });
    },
  });
}

export function useDeleteMetric(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteMetric(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: metricsQueryKey(projectId) });
    },
  });
}

export function useAcceptMetric(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.acceptMetric(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: metricsQueryKey(projectId) });
    },
  });
}

export function useDismissMetric(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.dismissMetric(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: metricsQueryKey(projectId) });
    },
  });
}

export function useExtractMetrics(projectId: string) {
  return useMutation({
    mutationFn: (file: File) => api.extractMetricsFromFile(projectId, file),
  });
}

export function useBulkCreateMetrics(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (suggestions: MetricSuggestion[]) =>
      api.bulkCreateMetrics(projectId, suggestions, { status: "active", source: "ai_suggested" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: metricsQueryKey(projectId) });
    },
  });
}
