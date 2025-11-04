import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "default-api-key",
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID || "default-project"}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "default-project",
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID || "default-project"}.firebasestorage.app`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "default-sender",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "default-app-id"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const appId = import.meta.env.VITE_FIREBASE_APP_ID || 'default-tournament-app';
