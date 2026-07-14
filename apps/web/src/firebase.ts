import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBlnb6IF0-e1lXha8zZrRVGternhzUH2dc",
  authDomain: "aapsd-assistant.firebaseapp.com",
  projectId: "aapsd-assistant",
  storageBucket: "aapsd-assistant.firebasestorage.app",
  messagingSenderId: "895506394838",
  appId: "1:895506394838:web:d0679ed4f85a09f24ae377",
  measurementId: "G-BQMCT1JKEJ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
