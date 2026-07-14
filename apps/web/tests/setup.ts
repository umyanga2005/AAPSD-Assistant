import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import { auth } from '../src/firebase.js';

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  onAuthStateChanged: vi.fn((auth, cb) => {
    cb({ uid: 'mock-uid', email: 'test@example.com', getIdToken: () => Promise.resolve('mock-token') });
    return () => {};
  }),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
}));
