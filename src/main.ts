import { signIn, signOut } from "./database/auth";
import {
  initRenderer,
  addLine,
  addPoly,
  finishAdding,
} from "./canvas/renderer";

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

document.querySelector("#newLine").addEventListener("click", function () {
  addLine();
});

document.querySelector("#newPoly").addEventListener("click", function () {
  addPoly();
});

document.querySelector("#doneAdding").addEventListener("click", function () {
  finishAdding();
});
