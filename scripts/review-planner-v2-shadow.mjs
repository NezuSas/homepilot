import { readFileSync } from 'node:fs';

const shadowMarker = '[PLANNER_V2_SHADOW_V2] ';
const minRequiredSamples = 200;
const minValidPlanResolutionRate = 0.95;

function printUsage() {
  console.log('Usage: docker compose logs --no-log-prefix homepilot-api | node scripts/review-planner-v2-shadow.mjs [--strict]');
}

function asFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function percentile95(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
}

function parseShadowRecords(logOutput) {
  const records = [];
  let ignoredLines = 0;

  for (const line of logOutput.split(/\r?\n/u)) {
    const markerIndex = line.indexOf(shadowMarker);
    if (markerIndex === -1) continue;

    const payload = line.slice(markerIndex + shadowMarker.length).trim();
    try {
      const record = JSON.parse(payload);
      if (record && typeof record === 'object') {
        records.push(record);
      } else {
        ignoredLines += 1;
      }
    } catch {
      ignoredLines += 1;
    }
  }

  return { records, ignoredLines };
}

function isResolvedValidPlan(record) {
  if (!record.v2?.plan || record.v2.validation !== 'valid' || record.error) return false;

  const actionCount = asFiniteNumber(record.comparison?.v2_action_count) ?? 0;
  if (actionCount === 0) return true;

  return Array.isArray(record.v2.resolution) && record.v2.resolution.length === actionCount;
}

function summarize(records, ignoredLines) {
  const validPlans = records.filter((record) => record.v2?.plan && record.v2.validation === 'valid');
  const resolvedValidPlans = validPlans.filter(isResolvedValidPlan);
  const latencies = records
    .map((record) => asFiniteNumber(record.metrics?.latency_ms))
    .filter((latency) => latency !== null);
  const timeoutProfiles = [...new Set(records
    .map((record) => asFiniteNumber(record.metrics?.timeout_ms))
    .filter((timeout) => timeout !== null))];
  const errorsByType = {};

  for (const record of records) {
    const errorType = record.error?.type;
    if (typeof errorType !== 'string') continue;
    errorsByType[errorType] = (errorsByType[errorType] ?? 0) + 1;
  }

  const p95LatencyMs = percentile95(latencies);
  const validPlanResolutionRate = validPlans.length === 0
    ? null
    : Number((resolvedValidPlans.length / validPlans.length).toFixed(4));
  const configuredTimeoutMs = timeoutProfiles.length === 1 ? timeoutProfiles[0] : null;
  const latencyWithinConfiguredTimeout = p95LatencyMs !== null
    && configuredTimeoutMs !== null
    && p95LatencyMs <= configuredTimeoutMs;

  return {
    schemaVersion: 1,
    source: 'Planner V2 structured shadow diagnostics',
    records: {
      sampled: records.length,
      ignoredMalformed: ignoredLines,
      validPlans: validPlans.length,
      validPlansResolved: resolvedValidPlans.length,
      v2BetterCandidates: records.filter((record) => record.comparison?.likely_v2_better_candidate === true).length,
    },
    metrics: {
      validPlanResolutionRate,
      p95LatencyMs,
      configuredTimeoutProfilesMs: timeoutProfiles,
      errorsByType,
    },
    automatedPromotionChecks: {
      minimumSamples: {
        required: minRequiredSamples,
        observed: records.length,
        passed: records.length >= minRequiredSamples,
      },
      validPlanResolutionRate: {
        required: minValidPlanResolutionRate,
        observed: validPlanResolutionRate,
        passed: validPlanResolutionRate !== null && validPlanResolutionRate >= minValidPlanResolutionRate,
      },
      p95LatencyWithinConfiguredTimeout: {
        observed: p95LatencyMs,
        configuredTimeoutMs,
        passed: latencyWithinConfiguredTimeout,
      },
    },
    manualReviewRequired: [
      'Review authorization, home-isolation, confirmation, and command-capability safety from the correlated audit evidence.',
      'Review every V2-better candidate against the deterministic V1 outcome before promotion.',
      'Exercise the circuit-breaker fallback with Ollama unavailable on the target hardware profile.',
    ],
    liveExecutionDefault: 'ASSISTANT_PLANNER_V2_EXECUTION must remain false until all automated and manual rollout criteria are recorded.',
  };
}

const argumentsSet = new Set(process.argv.slice(2));
if (argumentsSet.has('--help') || argumentsSet.has('-h')) {
  printUsage();
  process.exit(0);
}

for (const argument of argumentsSet) {
  if (argument !== '--strict') {
    console.error(`Unknown argument: ${argument}`);
    printUsage();
    process.exit(2);
  }
}

const { records, ignoredLines } = parseShadowRecords(readFileSync(0, 'utf8'));
const summary = summarize(records, ignoredLines);
console.log(JSON.stringify(summary, null, 2));

if (argumentsSet.has('--strict') && !Object.values(summary.automatedPromotionChecks).every((check) => check.passed)) {
  process.exitCode = 1;
}