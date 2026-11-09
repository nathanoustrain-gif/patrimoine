import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { fbAuth, googleProvider } from "./firebase";

/** undefined = en cours de chargement, null = déconnecté, User = connecté. */
export function useAuthUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(fbAuth, (u) => setUser(u)), []);
  return user;
}

export function signInGoogle() {
  return signInWithPopup(fbAuth, googleProvider);
}

export function signOutUser() {
  return signOut(fbAuth);
}
