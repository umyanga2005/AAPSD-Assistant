import * as matchers from '@testing-library/jest-dom/matchers';
import { expect } from 'vitest';
expect.extend(matchers);
import { vi } from 'vitest';

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: { getIdToken: () => Promise.resolve('mock-token') },
  })),
  GoogleAuthProvider: vi.fn(),
  onAuthStateChanged: vi.fn((auth, cb) => {
    cb({
      uid: 'mock-uid',
      email: 'test@example.com',
      getIdToken: () => Promise.resolve('mock-token'),
    });
    return () => {};
  }),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
}));
