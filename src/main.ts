import { logApp, signIn, signOut } from "./auth";
import { initRenderer, addLine } from "./renderer";

initRenderer();

document.querySelector("#signIn").addEventListener("click", function () {
  signIn();
});

document.querySelector("#signOut").addEventListener("click", function () {
  signOut();
});

document.querySelector("#newLine").addEventListener("click", function () {
  addLine();
});

logApp();
