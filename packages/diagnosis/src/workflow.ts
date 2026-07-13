import type { DiagnosisRequest, DiagnosisResult } from '@aapsd/contracts';
import type { ModelProvider } from './model-provider/types.js';
import { authorizeRequest } from './authorizer.js';
import { collectAllEvidence, retrieveRunbook } from './evidence-collector.js';
import { redactEvidence } from './redactor.js';
import { analyzeWithModel } from './analyzer.js';

export async function runDiagnosis(
  request: DiagnosisRequest,
  userRoles: string[],
  provider?: ModelProvider,
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

  const evidenceList = await collectAllEvidence(
    request.context?.pipelineRunId,
    request.context?.podName,
    request.context?.timeRange,
  );

  const runbook = await retrieveRunbook(request.query);

  const redactedEvidence = evidenceList.map((e) => ({
    ...e,
    ...redactEvidence(e.logs, e.metadata),
  }));

  const prompt = buildPrompt(request, redactedEvidence, runbook);

  let modelResponse;
  try {
    modelResponse = await analyzeWithModel(prompt, provider);
  } catch {
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
  return JSON.stringify({
    query: request.query,
    evidence,
    runbook,
  });
}
