import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged as _onAuthStateChanged,
} from "firebase/auth";

import { auth } from "@/src/lib/firebase/clientApp";

export function onAuthStateChanged(cb) {
  return _onAuthStateChanged(auth, cb);
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();

  try {
    signInWithPopup(auth, provider);
  } catch (error) {
    console.error("Sign in with Google failed", error);
  }
}

export async function signOut() {
  try {
    auth.signOut();
  } catch (error) {
    console.error("Sign out with Google failed", error);
  }
}
