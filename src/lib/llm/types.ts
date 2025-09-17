export type TrackingParams = {
  organizationId: string;
  userId: string;
  projectId?: string;
};

export type GenerateParams = {
  instructions: string;
  questions?: string[];
  context?: string;
  tone?: string;
  maxTokens?: number;
  model?: string;
  tracking?: TrackingParams;
};

export type SummarizeParams = {
  text: string;
  maxTokens?: number;
  model?: string;
  tracking?: TrackingParams;
};

export interface LLMProvider {
  summarize(input: SummarizeParams): Promise<string>;
  generate(params: GenerateParams): Promise<string>;
  name: string;
}
