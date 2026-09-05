// Firebase client auth — the only auth system. Browser apiKey is public by design;
// lock it down in Firebase Console → Authentication → Settings → Authorized domains.
// Env vars (same names) override these defaults when set, e.g. on Netlify.
import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  GoogleAuthProvider, createUserWithEmailAndPassword, getAuth,
  onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut,
  type Auth, type User,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyCFyxO2VGjkEdd6qcdc71CbEQKrCu8Jnhk",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "portfolio-health-advisor.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "portfolio-health-advisor",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "portfolio-health-advisor.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "351769982345",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:351769982345:web:7502673d92cc7a436a9d58",
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function firebaseAuth(): Auth {
  if (!auth) {
    app = app ?? initializeApp(firebaseConfig);
    auth = getAuth(app);
  }
  return auth;
}

export const googleProvider = new GoogleAuthProvider();

export {
  createUserWithEmailAndPassword, onAuthStateChanged,
  signInWithEmailAndPassword, signInWithPopup, signOut,
};
export type { User };

/** Firebase's raw errors are cryptic — translate the common ones. */
export function friendlyAuthError(code: string): string {
  switch (code) {
    case "auth/email-already-in-use": return "Account exists — sign in instead.";
    case "auth/invalid-email": return "Enter a valid email address.";
    case "auth/weak-password": return "Password needs at least 6 characters.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found": return "Wrong email or password.";
    case "auth/too-many-requests": return "Too many tries — wait a minute and retry.";
    case "auth/popup-closed-by-user": return "Popup closed before finishing.";
    case "auth/unauthorized-domain": return "This domain isn't authorized in Firebase Console → Authentication → Settings.";
    case "auth/operation-not-allowed": return "Enable this sign-in method in Firebase Console → Authentication.";
    case "auth/network-request-failed": return "Network error — check your connection.";
    default: return "Something went wrong. Try again.";
  }
}
