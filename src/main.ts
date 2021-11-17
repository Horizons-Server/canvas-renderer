import { logApp, signIn, signOut } from "./auth";
import { initRenderer } from "./renderer";

initRenderer();

document.querySelector("#signIn").addEventListener("click", function () {
  signIn();
});

document.querySelector("#signOut").addEventListener("click", function () {
  signOut();
});

logApp();
