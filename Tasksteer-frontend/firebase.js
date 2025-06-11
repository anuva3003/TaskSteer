// firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBPneX8HLvkg1z6fGpTKUDDFOFUJkdf-iA",
  authDomain: "tasksteer.firebaseapp.com",
  projectId: "tasksteer",
  storageBucket: "tasksteer.appspot.com",
  messagingSenderId: "553442098430",
  appId: "1:553442098430:web:9a79768fe81bdd15a379af",
  measurementId: "G-WQ2MC2GJNS"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { app, auth };
