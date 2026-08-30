// Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC2Fx18R1RNKll9cP_M8k0Cy5G0k7Luj7U",
  authDomain: "aashir-portfolio-analytics.firebaseapp.com",
  projectId: "aashir-portfolio-analytics",
  storageBucket: "aashir-portfolio-analytics.firebasestorage.app",
  messagingSenderId: "214952690264",
  appId: "1:214952690264:web:541808563ec18371de402d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firebase Authentication
const auth = getAuth(app);

// Firestore Database
const db = getFirestore(app);

// Admin Firebase Authentication UID
const ADMIN_UID = "TfEGfeTEyJZn1wiU4gaDOwby8sr1";

// Export everything required by analytics.js and admin.html
export {
  app,
  auth,
  db,
  ADMIN_UID
};