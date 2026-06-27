import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Por favor, pega la configuración que obtuviste de Firebase aquí:
const firebaseConfig = {
  apiKey: "AIzaSyA7BgToZHtZfYhHP4eNtsmS4c0kG-pqT6E",
  authDomain: "panel-ligas-fc.firebaseapp.com",
  projectId: "panel-ligas-fc",
  storageBucket: "panel-ligas-fc.firebasestorage.app",
  messagingSenderId: "813794779507",
  appId: "1:813794779507:web:56de25742383a30a272506"
};

// Inicializar Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

// Segunda instancia para creación de administradores sin perder sesión
const secondaryApp = getApps().find(a => a.name === "SecondaryApp") 
  ? getApps().find(a => a.name === "SecondaryApp")!
  : initializeApp(firebaseConfig, "SecondaryApp");
const secondaryAuth = getAuth(secondaryApp);

export { app, auth, db, secondaryAuth };
