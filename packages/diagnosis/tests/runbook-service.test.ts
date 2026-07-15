import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { buildRunbookLookup, retrieveRunbook } from '../src/runbook-service.js';

function makeTempDir(): string {
  const dir = resolve(tmpdir(), `rb-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeRunbook(dir: string, filename: string, frontmatter: string, body: string) {
  writeFileSync(resolve(dir, filename), `---\n${frontmatter}\n---\n\n${body}`, 'utf-8');
}

describe('buildRunbookLookup', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns matching runbook for a deployment query', () => {
    writeRunbook(
      tmpDir,
      'deploy.md',
      'id: deploy\n  title: Deployment Troubleshooting\n  tags: [deployment, pipeline, ci/cd]',
      'Check the pipeline logs for error messages.\nVerify the image tag matches the build output.',
    );
    writeRunbook(
      tmpDir,
      'memory.md',
      'id: memory\n  title: High Memory\n  tags: [memory, kubernetes, oom]',
      'Check pod memory usage with kubectl top.\nLook for OOMKilled events.',
    );

    const lookup = buildRunbookLookup(tmpDir);
    const result = lookup('deployment pipeline failed image tag');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('deploy');
    expect(result!.title).toContain('Deployment');
    expect(result!.tags).toContain('deployment');
    expect(result!.content).toContain('pipeline logs');
  });

  it('returns matching runbook for ImagePullBackOff query', () => {
    writeRunbook(
      tmpDir,
      'image.md',
      'id: imagepull\n  title: ImagePullBackOff\n  tags: [kubernetes, image, pod, registry]',
      'Run kubectl describe pod to see the exact error.\nVerify the image tag exists in the registry.',
    );

    const lookup = buildRunbookLookup(tmpDir);
    const result = lookup('kubernetes pod ImagePullBackOff registry');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('imagepull');
  });

  it('returns matching runbook for CPU / memory query', () => {
    writeRunbook(
      tmpDir,
      'cpu.md',
      'id: cpu-mem\n  title: High CPU and Memory\n  tags: [cpu, memory, performance, kubernetes]',
      'Use kubectl top pod to find top consumers.\nCheck for OOMKilled events.',
    );

    const lookup = buildRunbookLookup(tmpDir);
    const result = lookup('high cpu memory usage kubernetes');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('cpu-mem');
  });

  it('returns null for an unrelated query', () => {
    writeRunbook(
      tmpDir,
      'deploy.md',
      'id: deploy\n  title: Deployment\n  tags: [deployment, pipeline]',
      'Pipeline and deployment troubleshooting steps.',
    );

    const lookup = buildRunbookLookup(tmpDir);
    const result = lookup('how to configure prometheus alerts');

    expect(result).toBeNull();
  });

  it('returns null for empty query', () => {
    writeRunbook(
      tmpDir,
      'deploy.md',
      'id: deploy\n  title: Deployment\n  tags: [deployment]',
      'Content.',
    );

    const lookup = buildRunbookLookup(tmpDir);
    expect(lookup('')).toBeNull();
    expect(lookup('   ')).toBeNull();
  });

  it('returns null when directory is empty', () => {
    const lookup = buildRunbookLookup(tmpDir);
    const result = lookup('deployment failed');
    expect(result).toBeNull();
  });

  it('skips malformed documents without frontmatter', () => {
    writeFileSync(resolve(tmpDir, 'bad.md'), 'This file has no YAML frontmatter at all.', 'utf-8');
    writeRunbook(
      tmpDir,
      'good.md',
      'id: good\n  title: Good One\n  tags: [test]',
      'Valid content.',
    );

    const lookup = buildRunbookLookup(tmpDir);
    const result = lookup('test');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('good');
  });

  it('skips malformed documents with incomplete frontmatter', () => {
    writeFileSync(
      resolve(tmpDir, 'partial.md'),
      '---\n  id: partial\n  tags: [test]\n---\n\nNo title here.',
      'utf-8',
    );
    writeRunbook(tmpDir, 'good.md', 'id: good\n  title: Complete\n  tags: [test]', 'Valid.');

    const lookup = buildRunbookLookup(tmpDir);
    const result = lookup('test');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('good');
  });

  it('skips documents with missing id or title in frontmatter', () => {
    writeRunbook(tmpDir, 'no-id.md', 'title: No ID\n  tags: [test]', 'Missing id.');
    writeRunbook(tmpDir, 'no-title.md', 'id: no-title\n  tags: [test]', 'Missing title.');
    writeRunbook(
      tmpDir,
      'valid.md',
      'id: valid\n  title: Valid One\n  tags: [test]',
      'Has everything.',
    );

    const lookup = buildRunbookLookup(tmpDir);
    const result = lookup('test');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('valid');
  });

  it('prefers the best matching runbook over partial matches', () => {
    writeRunbook(
      tmpDir,
      'partial.md',
      'id: partial\n  title: Partial Match\n  tags: [general]',
      'This document has some general content about deployment.',
    );
    writeRunbook(
      tmpDir,
      'exact.md',
      'id: exact\n  title: Exact Deployment Guide\n  tags: [deployment, github, pipeline]',
      'Deployment troubleshooting for GitHub Actions pipelines with image tags.',
    );

    const lookup = buildRunbookLookup(tmpDir);
    const result = lookup('GitHub Actions deployment pipeline failed image tag');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('exact');
  });
});

describe('retrieveRunbook', () => {
  it('returns a runbook for a deployment query using default docs', async () => {
    const result = await retrieveRunbook('GitHub Actions deployment pipeline');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('github-deployment-failure');
    expect(result!.title).toContain('GitHub Actions');
    expect(result!.tags).toContain('github');
  });

  it('returns a runbook for an ImagePullBackOff query', async () => {
    const result = await retrieveRunbook('kubernetes ImagePullBackOff pod registry');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('kubernetes-imagepullbackoff');
  });

  it('returns a runbook for CPU/memory query', async () => {
    const result = await retrieveRunbook('high CPU memory OOM');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('high-cpu-memory');
  });

  it('returns null for an unrelated query', async () => {
    const result = await retrieveRunbook('zzzzzzzzz');
    expect(result).toBeNull();
  });

  it('returns null for an empty query', async () => {
    expect(await retrieveRunbook('')).toBeNull();
    expect(await retrieveRunbook('   ')).toBeNull();
  });
});
