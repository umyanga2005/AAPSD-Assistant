import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import { supabase } from '../src/supabase.ts';

vi.spyOn(supabase.auth, 'getSession').mockResolvedValue({ data: { session: { access_token: 'mock-token' } } } as any);
vi.spyOn(supabase.auth, 'onAuthStateChange').mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } } as any);
vi.spyOn(supabase.auth, 'signOut').mockResolvedValue({ error: null });
