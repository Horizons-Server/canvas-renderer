import { initRenderer } from "./renderer";
import { logApp, signIn } from "./auth";

initRenderer();

document.querySelector("#signIn").addEventListener("click", function () {
  signIn();
});

logApp();
