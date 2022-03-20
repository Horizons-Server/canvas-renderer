import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAj-_F0M8JDCtGT9P9U-ZqW-kLHVRRygsQ",
  authDomain: "street-mapping.firebaseapp.com",
  projectId: "street-mapping",
  storageBucket: "street-mapping.appspot.com",
  messagingSenderId: "944053169255",
  appId: "1:944053169255:web:e8069e468f42f0fedf38c2",
  measurementId: "G-KPYWE4Q983",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const provider = new GoogleAuthProvider();
const auth = getAuth();

auth.onAuthStateChanged((user) => {
  if (user) {
    // User logged in already or has just logged in.
    console.log("LOGGED IN");
    console.log(user);
    document.getElementById("signIn").style.display = "none";
    document.getElementById("signOut").style.display = "block";
  } else {
    // User not logged in or has just logged out.
    console.log("NOT LOGGED IN");
    document.getElementById("signIn").style.display = "block";
    document.getElementById("signOut").style.display = "none";
  }
});

export function signIn() {
  signInWithPopup(auth, provider)
    .then((result) => {
      // This gives you a Google Access Token. You can use it to access the Google API.
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential.accessToken;
      // The signed-in user info.
      const user = result.user;
      // ...
      console.log(user);
    })
    .catch((error) => {
      // Handle Errors here.
      const errorCode = error.code;
      const errorMessage = error.message;
      // The email of the user's account used.
      const email = error.email;
      // The AuthCredential type that was used.
      const credential = GoogleAuthProvider.credentialFromError(error);
      // ...
    });
}

export function signOut() {
  auth.signOut();
}
