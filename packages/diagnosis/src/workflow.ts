import type { DiagnosisRequest, DiagnosisResult } from '@aapsd/contracts';
import type { ModelProvider } from './model-provider/types.js';
import type { EvidenceCollector, EvidenceCollectorOptions } from './evidence-collector-types.js';
import { authorizeRequest } from './authorizer.js';
import { createDefaultEvidenceCollector } from './evidence-collector.js';
import { retrieveRunbook } from './runbook-service.js';
import { redactEvidence } from './redactor.js';
import { analyzeWithModel } from './analyzer.js';

export type { EvidenceCollector, EvidenceCollectorOptions } from './evidence-collector-types.js';

export async function runDiagnosis(
  request: DiagnosisRequest,
  userRoles: string[],
  provider?: ModelProvider,
  evidenceCollector?: EvidenceCollector,
): Promise<DiagnosisResult> {
  const auth = authorizeRequest(request, userRoles);
  if (!auth.authorized) {
    return {
      requestId: request.traceId,
      summary: 'Authorization failed',
      evidence: [],
      likely_causes: [],
      recommendations: [],
      confidence: 'insufficient_evidence',
      needs_human_review: true,
      redacted: false,
      traceId: request.traceId,
    };
  }

  const context = request.context;
  const hasAnyContext = !!(context?.pipelineRunId || context?.podName || context?.timeRange);

  if (!hasAnyContext) {
    return {
      requestId: request.traceId,
      summary:
        'No context provided. To run a diagnosis, specify a pipeline run, pod name, or time range.',
      evidence: [],
      likely_causes: [],
      recommendations: [
        {
          action: 'Provide diagnostic context',
          details:
            'Include pipeline_run_id, pod_name, or a time range to collect relevant evidence.',
        },
      ],
      confidence: 'insufficient_evidence',
      needs_human_review: false,
      redacted: false,
      traceId: request.traceId,
    };
  }

  const collector = evidenceCollector ?? createDefaultEvidenceCollector();

  const collectOptions: EvidenceCollectorOptions = {
    pipelineRunId: context?.pipelineRunId,
    podName: context?.podName,
    timeRange: context?.timeRange,
  };

  const [evidenceList, runbook] = await Promise.all([
    collector.collectAll(collectOptions),
    retrieveRunbook(request.query),
  ]);

  const hasUsableEvidence = evidenceList.some(
    (e) => e.logs.length > 0 || Object.keys(e.metadata).length > 0,
  );

  if (!hasUsableEvidence) {
    return {
      requestId: request.traceId,
      summary: 'No usable evidence could be collected from the provided context.',
      evidence: [],
      likely_causes: [],
      recommendations: [
        {
          action: 'Verify context values',
          details:
            'The provided pipeline run, pod name, or time range returned no data. Double-check values and try again.',
        },
      ],
      confidence: 'insufficient_evidence',
      needs_human_review: false,
      redacted: false,
      traceId: request.traceId,
    };
  }

  const redactedEvidence = evidenceList.map((e) => ({
    ...e,
    ...redactEvidence(e.logs, e.metadata),
  }));

  const prompt = buildPrompt(request, redactedEvidence, runbook);

  let modelResponse;
  try {
    modelResponse = await analyzeWithModel(prompt, provider);
  } catch (err: any) {
    console.error('Model analysis failed:', err);
    return {
      requestId: request.traceId,
      summary: 'Analysis could not be completed due to a system error.',
      evidence: redactedEvidence.flatMap((e) =>
        e.logs.map((log: string) => ({
          source: e.source,
          title: `Raw log from ${e.source}`,
          detail: log,
        })),
      ),
      likely_causes: [],
      recommendations: [
        {
          action: 'Retry diagnosis',
          details: 'The model request failed. Please retry the diagnosis.',
        },
      ],
      confidence: 'insufficient_evidence',
      needs_human_review: true,
      redacted: true,
      traceId: request.traceId,
    };
  }

  return {
    requestId: request.traceId,
    summary: modelResponse.summary,
    evidence: modelResponse.evidence,
    likely_causes: modelResponse.likely_causes,
    recommendations: modelResponse.recommendations,
    confidence: modelResponse.confidence,
    needs_human_review: modelResponse.needs_human_review,
    redacted: true,
    traceId: request.traceId,
  };
}

function buildPrompt(
  request: DiagnosisRequest,
  evidence: Array<{ source: string; logs: string[]; metadata: Record<string, unknown> }>,
  runbook: unknown,
): string {
  const schema = {
    summary: "string (1-2 sentences)",
    evidence: [{ source: "string", title: "string", detail: "string", url: "optional string", timestamp: "optional string" }],
    likely_causes: [{ description: "string", probability: "number 0-1" }],
    recommendations: [{ action: "string", details: "string" }],
    confidence: "high | medium | low | insufficient_evidence",
    needs_human_review: "boolean"
  };

  return `You are a DevOps and infrastructure diagnosis AI.
Analyze the following request and evidence, and return a JSON object matching this schema EXACTLY. Do not include any text outside the JSON object. Do not wrap it in markdown formatting like \`\`\`json.
Schema:
${JSON.stringify(schema, null, 2)}

Request Details:
${JSON.stringify({
  query: request.query,
  evidence,
  runbook,
}, null, 2)}`;
}
