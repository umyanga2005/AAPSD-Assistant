/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RealGitHubAdapter } from '../src/github-adapter/real.js';
import { RealK8sAdapter } from '../src/k8s-adapter/real.js';
import { fetch as undiciFetch } from 'undici';

vi.mock('undici', () => ({
  fetch: vi.fn(),
  Agent: vi.fn(),
}));

let mockFetch: any;

beforeEach(() => {
  mockFetch = vi.fn();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Evidence Metadata', () => {
  describe('GitHub Adapter', () => {
    it('includes url and timestamp in metadata', async () => {
      const adapter = new RealGitHubAdapter({ token: 'test', allowedRepos: ['owner/repo'] });
      // Mock jobs response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jobs: [] })
      } as any);

      // Mock run details response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ html_url: 'https://github.com/owner/repo/actions/runs/123', created_at: '2023-01-01T00:00:00Z' })
      } as any);

      const result = await adapter.collectEvidence('owner/repo/123');
      
      expect(result.metadata.url).toBe('https://github.com/owner/repo/actions/runs/123');
      expect(result.metadata.timestamp).toBe('2023-01-01T00:00:00Z');
    });
  });

  describe('K8s Adapter', () => {
    it('includes timestamp in metadata', async () => {
      const adapter = new RealK8sAdapter({ token: 'test', allowedNamespaces: ['default'] });
      
      const mockUndiciFetch = vi.mocked(undiciFetch);
      
      // Mock getPodStatus response
      mockUndiciFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          metadata: { name: 'test-pod', namespace: 'default', creationTimestamp: '2023-01-01T00:00:00Z' },
          status: { phase: 'Running', containerStatuses: [] }
        })
      } as any);

      // Mock events response
      mockUndiciFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) } as any);
      // Mock logs response
      mockUndiciFetch.mockResolvedValueOnce({ ok: true, text: async () => '' } as any);
      // Mock deployments response
      mockUndiciFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) } as any);

      const result = await adapter.collectEvidence('test-pod', 'default');
      
      expect(result.metadata.timestamp).toBe('2023-01-01T00:00:00Z');
    });
  });
});
