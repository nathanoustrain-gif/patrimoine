import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

// Config web Firebase — publique par nature (l'accès aux données est protégé par
// les règles de sécurité Firestore : chacun ne voit que ses propres données).
const firebaseConfig = {
  apiKey: "AIzaSyDk571XgurK8MhlDc8kHIh8hTr9Saoo-ek",
  authDomain: "patrimoine-app-86018.firebaseapp.com",
  projectId: "patrimoine-app-86018",
  storageBucket: "patrimoine-app-86018.firebasestorage.app",
  messagingSenderId: "229034960935",
  appId: "1:229034960935:web:cfea5d4a156d066d210602",
};

export const fbApp = initializeApp(firebaseConfig);
export const fbAuth = getAuth(fbApp);
// ignoreUndefinedProperties : nos enregistrements ont des champs optionnels
// (undefined) que Firestore refuserait sinon.
export const fbStore = initializeFirestore(fbApp, {
  ignoreUndefinedProperties: true,
});
export const googleProvider = new GoogleAuthProvider();
