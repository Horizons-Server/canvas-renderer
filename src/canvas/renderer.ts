import {
  Joint,
  Joints,
  Polygon,
  Polygons,
  Line,
  Lines,
  VisualType,
  VisualTypes,
} from "../database/types";
import {
  setDoc,
  getFirestore,
  collection,
  onSnapshot,
  doc,
} from "firebase/firestore";
import { getDatabase, ref, onValue, push, child, set } from "firebase/database";
import { getTileUrl } from "./dynmap";

// globals
// canvas and ctx
const canvas = document.querySelector("#mainCanvas") as HTMLCanvasElement;
if (!canvas) throw new Error("Canvas not Found");
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Could not create context");

// data
let lines: Lines = {};
let polygons: Polygons = {};
let joints: Joints = {};
let types: VisualTypes = {};
let docsToSave: {
  id: string;
  collection: string;
  source: any;
}[] = [];
let saveTimeout: any;
let addingLine: string;
let addingPoly: string;
let rendered: string[] = [];
let dynmapTiles: {
  [key: string]: HTMLImageElement;
} = {};
let worldId = "horizons";

// consts
const firestore = getFirestore();
const database = getDatabase();
canvas.width = innerWidth;
canvas.height = innerHeight;
const databaseType: "realtime" | "firestore" = "realtime";

// lets
let fontSize = 20;
let textAreas: DOMRect[] = [];
let editing = false;
let mouse = {
  x: 0,
  y: 0,
  rx: 0,
  rz: 0,
  button: -1,
  bounds: canvas.getBoundingClientRect(),
};

//timings
let verbose = false;
let firstTime = {};
let perfTotal = {};
let perfCount = {};
let perfAvgs = {};
let perfMax = {};
let perfMin = {};

addEventListener(
  "resize",
  () => {
    canvas.style.width = innerWidth + "px";
    canvas.style.height = innerHeight + "px";

    retinaFix();
  },
  { passive: true }
);
addEventListener("wheel", trackWheel, { passive: false });
addEventListener("mousemove", move);
addEventListener("mousedown", move);
addEventListener("mouseup", move);
addEventListener("mouseout", move); // to stop mouse button locking up
canvas.addEventListener("click", processEditorClick);

// lazy programmers globals
var scale = 1;
var wx = 0; // world zoom origin
var wy = 0;
var sx = 0; // mouse screen pos
var sy = 0;

function zoomed(number: any) {
  if (typeof number != "number") {
    return number;
  }

  // just scale
  return number * scale;
  // return Math.floor(number * scale);
}
// converts from world coord to screen pixel coord
function zoomedX(number: any) {
  // scale & origin X
  return (number - wx) * scale + sx;
  // return Math.floor((number - wx) * scale + sx);
}

function zoomedZ(number: any) {
  // scale & origin Y
  return (number - wy) * scale + sy;
  // return Math.floor((number - wy) * scale + sy);
}

// inverse function converts from screen pixel coord to world coord
function zoomed_INV(number: any) {
  if (typeof number != "number") {
    return number;
  }

  // just scale
  // return Math.floor(number / scale);
  return number / scale;
}

function zoomedX_INV(number: any) {
  // scale & origin INV
  return (number - sx) * (1 / scale) + wx;
  // return Math.floor((number - sx) * (1 / scale) + wx);

  // or return Math.floor((number - sx) / scale + wx);
}

function zoomedZ_INV(number: any) {
  // scale & origin INV
  return (number - sy) * (1 / scale) + wy;
  // return Math.floor((number - sy) * (1 / scale) + wy);

  // or return Math.floor((number - sy) / scale + wy);
}

function move(e: MouseEvent) {
  // mouse move event
  if (e.type === "mousedown") {
    mouse.button = e.button;
  } else if (e.type === "mouseup" || e.type === "mouseout") {
    mouse.button = -1;
  }

  mouse.bounds = canvas.getBoundingClientRect();
  mouse.x = e.clientX - mouse.bounds.left;
  mouse.y = e.clientY - mouse.bounds.top;
  var xx = mouse.rx; // get last real world pos of mouse
  var yy = mouse.rz;

  mouse.rx = zoomedX_INV(mouse.x); // get the mouse real world pos via inverse scale and translate
  mouse.rz = zoomedZ_INV(mouse.y);

  if (addingLine || addingPoly) requestAnimationFrame(animate);

  if (editorProcessMouse())
    if (mouse.button === 0) {
      // is mouse button down
      wx -= mouse.rx - xx; // move the world origin by the distance
      // moved in world coords
      wy -= mouse.rz - yy;
      // recaculate mouse world
      mouse.rx = zoomedX_INV(mouse.x);
      mouse.rz = zoomedZ_INV(mouse.y);
      requestAnimationFrame(animate);
    }
}

function trackWheel(e) {
  if (e.deltaY < 0) {
    scale = Math.min(5, scale * 1.1); // zoom in
  } else {
    scale = Math.max(1 / 100, scale * (1 / 1.1)); // zoom out is inverse of zoom in
  }

  wx = mouse.rx; // set world origin
  wy = mouse.rz;
  sx = mouse.x; // set screen origin
  sy = mouse.y;
  mouse.rx = zoomedX_INV(mouse.x); // recalc mouse world (real) pos
  mouse.rz = zoomedZ_INV(mouse.y);

  e.preventDefault(); // stop the page scrolling

  requestAnimationFrame(animate);
}

function timings(identifier: string) {
  if (perfCount[identifier] == undefined) {
    perfCount[identifier] = 0;
    perfTotal[identifier] = 0;
    perfMax[identifier] = -Infinity;
    perfMin[identifier] = Infinity;
  }

  if (firstTime[identifier] == undefined) {
    firstTime[identifier] = performance.now();
  } else {
    let start = firstTime[identifier] * 1000;
    let end = performance.now() * 1000;

    perfTotal[identifier] += end - start;
    perfCount[identifier]++;

    if (verbose) {
      console.log(identifier + " took ", end - start, "us (/16,000us)");
      console.log(
        "AVG " + identifier + " took",
        perfTotal[identifier] / perfCount[identifier],
        "us (/16,000us)"
      );
    }

    let rounded = Math.round(perfTotal[identifier] / perfCount[identifier]);

    perfAvgs[identifier] = rounded;
    perfMax[identifier] = Math.max(rounded, perfMax[identifier]);
    perfMin[identifier] = Math.min(rounded, perfMax[identifier]);

    firstTime[identifier] = undefined;
  }
}

function viewTimings() {
  console.log(
    "%c Average Times (μs) ",
    "background-color: #78c4ff; font-weight: bold"
  );
  console.table(perfAvgs);
  console.log(
    "%c Minimum Times (μs) ",
    "background-color: #abffae; font-weight: bold"
  );
  console.table(perfMin);
  console.log(
    "%c Maximum Times (μs) ",
    "background-color: #ff8787; font-weight: bold"
  );
  console.table(perfMax);

  setTimeout(viewTimings, 1000);
}

/* ---- RENDERING ENGINE ---- */

/**
 * retinaFix - adjust the canvas to be resolution independent
 */
function retinaFix() {
  if (!canvas || !ctx) return;

  // get current size of the canvas
  let rect = canvas.getBoundingClientRect();

  // increase the actual size of our canvas
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = rect.height * devicePixelRatio;

  // ensure all drawing operations are scaled
  ctx.scale(devicePixelRatio, devicePixelRatio);

  // scale everything down using CSS
  canvas.style.width = rect.width + "px";
  canvas.style.height = rect.height + "px";

  setDefaultStyles();
  requestAnimationFrame(animate);
}

/**
 * animate - draws a new frame
 */
function animate() {
  if (!ctx || !canvas) return;

  timings("frame");

  timings("clearRect");

  // ctx.fillStyle = "#" + Math.floor(Math.random() * 16777215).toString(16);

  ctx.fillStyle = "whitesmoke";
  ctx.fillRect(0, 0, innerWidth, innerHeight);

  textAreas = [];

  timings("clearRect");

  //draw dynmap
  timings("drawMap");

  renderMap();

  timings("drawMap");

  //handle drawing
  timings("drawPolygons");
  drawPolygons();
  timings("drawPolygons");

  timings("drawLines");
  drawLines();
  timings("drawLines");

  timings("renderAllText");
  renderAllText();
  timings("renderAllText");

  timings("frame");
}

/**
 * setProperties - sets ctx properties to match those of a type
 *
 * @param  properties properties in an object
 */
function setProperties(properties: { [key: string]: any }) {
  if (!ctx || properties == undefined) return;

  console.log("PROPERTIES", properties);

  let propertiesToChange = Object.keys(properties);
  propertiesToChange.forEach((property) => {
    if (
      typeof ctx[property] == "function" &&
      Array.isArray(properties[property])
    ) {
      ctx[property](...properties[property]); //handle function props
    } else {
      ctx[property] = zoomed(properties[property]); //handle normal props
    }
  });
}

//uses world coords
function isOnScreen(box: DOMRect) {
  if (
    zoomedX(box.right) < 0 ||
    zoomedX(box.left) > innerWidth ||
    zoomedZ(box.bottom) < 0 ||
    zoomedZ(box.top) > innerHeight
  ) {
    return false;
  }
  return true;
}

//uses screen coords
function isOnScreen_INV(box: DOMRect) {
  if (
    box.right < 0 ||
    box.left > innerWidth ||
    box.bottom < 0 ||
    box.top > innerHeight
  ) {
    return false;
  }
  return true;
}

/**
 * drawPolygons - draws all polygons to the canvas
 */
function drawPolygons() {
  if (!ctx || !canvas) return;

  for (let polygonId in polygons) {
    let polygon = polygons[polygonId];

    let top = Infinity;
    let bottom = -Infinity;
    let left = Infinity;
    let right = -Infinity;

    polygon.joints.forEach((jointId) => {
      let joint = joints[jointId];
      top = Math.min(top, joint.z);
      bottom = Math.max(bottom, joint.z);
      left = Math.min(left, joint.x);
      right = Math.max(right, joint.x);
    });

    let padding = 50;

    if (
      !isOnScreen(
        new DOMRect(
          left - padding,
          top - padding,
          right - left + padding * 2,
          bottom - top + padding * 2
        )
      )
    ) {
      continue;
    }

    rendered.push(polygonId);

    //draw shape
    ctx.beginPath();

    console.log("starting path");

    polygon.joints.forEach((joint, i) => {
      let currentJoint = joints[joint];
      console.log(joint, currentJoint);
      if (i == 0) {
        ctx.moveTo(zoomedX(currentJoint.x), zoomedZ(currentJoint.z));
      } else {
        ctx.lineTo(zoomedX(currentJoint.x), zoomedZ(currentJoint.z));
      }
    });

    console.log("finished path");

    if (polygonId == addingPoly) ctx.lineTo(mouse.x, mouse.y);

    ctx.closePath();

    //get type from config
    let appearanceList = types[polygon.type]?.appearances;

    console.log("type", polygon.type);
    console.log(types);

    if (appearanceList == undefined) return;

    console.log("ready to paint");

    //paint type to canvas
    appearanceList.forEach((appearance) => {
      // TODO check dark mode
      // TODO check zoom

      console.log("appearance", appearance);

      let numLayers = Math.max(
        appearance.properties.length,
        appearance.functions.length
      );

      console.log("layers to paint:", numLayers);

      for (let i = 0; i < numLayers; i++) {
        ctx.save();

        setProperties(appearance.properties[i]);
        setProperties(appearance.functions[i]);

        // TODO function ovverrides

        console.log("painting");

        ctx.fill();
        ctx.stroke();

        ctx.restore();
      }
    });
  }
}

/**
 * drawLines - draw all lines to the canvas
 */
function drawLines() {
  if (!ctx || !canvas) return;

  let paintingLines = true;
  let indexToPaint = 0;

  while (paintingLines) {
    paintingLines = false;

    for (let lineId in lines) {
      let line = lines[lineId];

      let top = Infinity;
      let bottom = -Infinity;
      let left = Infinity;
      let right = -Infinity;

      line.joints.forEach((jointId) => {
        let joint = joints[jointId];
        top = Math.min(top, joint.z);
        bottom = Math.max(bottom, joint.z);
        left = Math.min(left, joint.x);
        right = Math.max(right, joint.x);
      });

      let padding = 50;

      if (
        !isOnScreen(
          new DOMRect(
            left - padding,
            top - padding,
            right - left + padding * 2,
            bottom - top + padding * 2
          )
        )
      ) {
        continue;
      }

      rendered.push(lineId);

      //draw line
      ctx.beginPath();
      line.joints.forEach((joint, i) => {
        let currentJoint = joints[joint];

        if (i == 0) {
          ctx.moveTo(zoomedX(currentJoint.x), zoomedZ(currentJoint.z));
        } else {
          ctx.lineTo(zoomedX(currentJoint.x), zoomedZ(currentJoint.z));
        }
      });

      if (addingLine == lineId) {
        ctx.lineTo(mouse.x, mouse.y);
      }

      //get type from config
      let appearanceList = types[line.type]?.appearances;
      if (appearanceList == undefined) return;

      appearanceList.forEach((appearance) => {
        // TODO check dark mode
        // TODO check zoom

        //paint type to canvas

        if (
          appearance.properties[indexToPaint] != undefined &&
          appearance.functions[indexToPaint] != undefined
        )
          paintingLines = true;

        ctx.save();

        setProperties(appearance.properties[indexToPaint]);
        setProperties(appearance.functions[indexToPaint]);

        if (line.width)
          ctx.lineWidth = zoomed(
            line.width +
              (parseInt(appearance.properties[indexToPaint]?.lineWidth) ?? 0)
          );

        ctx.stroke();

        ctx.restore();
      });
    }

    indexToPaint++;
  }
}

/**
 * applyRotationToText - calculate the area and position of a
 * bit of text's bounding box
 *
 * @param text the text in the box
 * @param x the x position of the center of the box
 * @param x the z position of the center of the box
 * @param rotation how far to rotate the box in radians
 * @return rect approximately surrounding the rotated text
 */
function applyRotationToText(
  text: string,
  x: number,
  z: number,
  rotation: number
) {
  if (!ctx) return;

  let textWidth = ctx.measureText(text).width;

  // get all corners (we only need two)
  let points = [
    { x: textWidth / 2, y: fontSize / 2 },
    { x: -textWidth / 2, y: fontSize / 2 },
    { x: -textWidth / 2, y: -fontSize / 2 },
    { x: textWidth / 2, y: -fontSize / 2 },
  ];

  let finalRect = {
    top: Infinity,
    left: Infinity,
    bottom: -Infinity,
    right: -Infinity,
  };

  points.forEach((point) => {
    //rotate it
    let rx = point.x * Math.cos(rotation) - point.y * Math.sin(rotation);
    let ry = point.y * Math.cos(rotation) - point.x * Math.sin(rotation);

    //set rect accordingly
    finalRect.top = Math.min(z + ry, finalRect.top);
    finalRect.left = Math.min(x + rx, finalRect.left);
    finalRect.bottom = Math.max(z + ry, finalRect.bottom);
    finalRect.right = Math.max(x + rx, finalRect.right);
  });

  // that's all we need, now calculate the bounding box
  return new DOMRect(
    finalRect.left,
    finalRect.top,
    finalRect.right - finalRect.left,
    finalRect.bottom - finalRect.top
  );
}

/**
 * checkTextOverlap - approximate whether a bit of text would overlap with
 * some other text
 *
 * @param  box bounding box of text
 * @return true if text overlaps
 */
function checkTextOverlap(box: DOMRect) {
  for (let i = 0; i < textAreas.length; i++) {
    let a = textAreas[i];
    let b = box;

    if (
      b != undefined &&
      a.left <= b.right &&
      a.right >= b.left &&
      a.top <= b.bottom &&
      a.bottom >= b.top
    ) {
      return true;
    }
  }
  return false;
}

/**
 * getTextAngle - calculate the angle between two joints
 *
 * @param  jointA first joint
 * @param  jointB second joint
 * @return the angle between them in radians
 */
function getTextAngle(jointA: Joint, jointB: Joint) {
  if (jointA.x > jointB.x) {
    let temp = jointA;
    jointA = jointB;
    jointB = temp;
  }

  let dx = jointB.x - jointA.x;
  let dz = jointB.z - jointA.z;

  return Math.atan2(dz, dx);
}

/**
 * fillText - description
 *
 * @param  text text to draw
 * @param  x position of the center of the box
 * @param  z position of the center of the box
 * @param  rotation rotation in radians
 * @return false if draw failed
 */
function fillText(text: string, x: number, z: number, rotation: number) {
  if (!ctx || !canvas) return false;

  x = zoomedX(x);
  z = zoomedZ(z);

  let newRect = applyRotationToText(text, x, z, rotation);

  if (!isOnScreen_INV(newRect)) {
    return false;
  }
  if (checkTextOverlap(newRect)) return false;

  //save text box to check overlap
  if (newRect) textAreas.push(newRect);

  ctx.save();

  ctx.strokeStyle = "#0f0";
  ctx.strokeRect(newRect.x, newRect.y, newRect.width, newRect.height);

  ctx.translate(x, z); //translate to center of shape
  //  ctx.rotate((Math.PI / 180) * rotation); //rotate in degrees.
  ctx.rotate(rotation); //rotate in radians
  ctx.translate(-x, -z); //translate center back to 0,0

  ctx.textBaseline = "middle";
  ctx.fillStyle = "#222";
  ctx.strokeStyle = "#eee";
  ctx.lineWidth = 2;
  ctx.textAlign = "center";

  ctx.strokeText(text, x, z);
  ctx.fillText(text, x, z);

  ctx.restore();

  return true;
}

/**
 * getDistanceSquared - returns the distance squared between two joints
 *
 * @param  jointA first joint
 * @param  jointB second joint
 * @return distance squared
 */
function getDistanceSquared(jointA: Joint, jointB: Joint) {
  return (jointA.x - jointB.x) ** 2 + (jointA.z - jointB.z) ** 2;
}

/**
 * pointAlongLine - calculates the position of text given the distance along
 * the line between two joints
 *
 * @param  jointA first joint
 * @param  jointB second joint
 * @param  distance  how far along the line to place the point
 * @return coordinates
 */
function pointAlongLine(jointA: Joint, jointB: Joint, distance: number) {
  let lineDistance = Math.sqrt(getDistanceSquared(jointA, jointB));
  let ratio = distance / lineDistance;

  let newX = jointA.x + (jointB.x - jointA.x) * ratio;
  let newZ = jointA.z + (jointB.z - jointA.z) * ratio;

  return {
    x: newX,
    z: newZ,
  };
}

/**
 * renderAllText - renders all text to the canvas
 */
function renderAllText() {
  if (!ctx || !canvas) return;

  // draw polygons first
  for (let polygonId in polygons) {
    if (!rendered.includes(polygonId)) continue;

    let polygon = polygons[polygonId]; //find the bounding box of the polygon
    if (polygon.name == undefined) return;
    let sumX = 0;
    let sumY = 0;
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    let count = 0;

    polygon.joints.forEach((joint) => {
      let currentJoint = joints[joint];

      top = Math.min(top, currentJoint.z);
      bottom = Math.max(bottom, currentJoint.z);
      left = Math.min(left, currentJoint.x);
      right = Math.max(right, currentJoint.x);

      sumX += currentJoint.x;
      sumY += currentJoint.z;
      count++;
    });

    if (
      isOnScreen(new DOMRect(left, top, right - left, bottom - top)) &&
      bottom - top > fontSize &&
      right - left > zoomed_INV(ctx.measureText(polygon.name).width)
    ) {
      fillText(polygon.name, sumX / count, sumY / count, 0);
    }
  }

  //draw line texts
  for (let lineId in lines) {
    if (!rendered.includes(lineId)) continue;
    let line = lines[lineId];

    if (line.name == undefined) return;
    let totalDistances = [0];
    let totalDistance = 0;
    //calculate the length of the line
    line.joints.forEach((joint, i) => {
      if (i != 0) {
        let currentJoint = joints[joint];
        let prevJoint = joints[line.joints[i - 1]];
        let segmentDistance = Math.sqrt(
          getDistanceSquared(currentJoint, prevJoint)
        );
        totalDistance += segmentDistance;
        totalDistances[i] = totalDistance;
      }
    });

    let textWidth = zoomed_INV(ctx.measureText(line.name).width);
    let textSpace = textWidth * 3;

    let remainder = totalDistance % textSpace;

    let numLines = Math.round(totalDistance / textSpace / 2) * 2 + 1;

    //calculate positions of texts and draw them
    for (let i = 0; i <= numLines; i++) {
      let offset = textSpace * i - textSpace / 2;
      offset += remainder / 2;

      if (offset < 0) {
        if (textWidth < totalDistance) {
          let currentJoint = joints[line.joints[0]];
          let prevJoint = joints[line.joints[1]];
          let angle = getTextAngle(prevJoint, currentJoint);
          fillText(
            line.name,
            (currentJoint.x + prevJoint.x) / 2,
            (currentJoint.z + prevJoint.z) / 2,
            angle
          );
        }
      }

      let trailingJointIndex = 0;

      for (let j = 0; j < totalDistances.length; j++) {
        if (totalDistances[j] > offset) {
          trailingJointIndex = j;
          j = Infinity;
        }
      }

      if (trailingJointIndex == 0) continue;

      let currentJoint = joints[line.joints[trailingJointIndex]];
      let prevJoint = joints[line.joints[trailingJointIndex - 1]];
      let angle = getTextAngle(prevJoint, currentJoint);

      offset -= totalDistances[trailingJointIndex - 1];

      let textPosition = pointAlongLine(prevJoint, currentJoint, offset);

      fillText(line.name, textPosition.x, textPosition.z, angle);
    }
  }
}

function renderTilesInRange(rect: DOMRect, zoom: number) {
  let hasLoadedInFrame = false;

  let tileWidth = 2 ** (8 - zoom) * 32;

  for (
    let x = zoomedX_INV(rect.left);
    x < zoomedX_INV(rect.right) + tileWidth;
    x += tileWidth
  ) {
    for (
      let z = zoomedZ_INV(rect.top);
      z < zoomedZ_INV(rect.bottom) + tileWidth;
      z += tileWidth
    ) {
      let actualX = Math.floor(x / tileWidth) * tileWidth;
      let actualZ = Math.floor(z / tileWidth) * tileWidth;

      let tile = getTileUrl({
        x: Math.floor(x / tileWidth),
        z: Math.floor(z / tileWidth),
        zoom,
      });

      if (dynmapTiles[tile.id] == undefined) {
        if (!hasLoadedInFrame) {
          dynmapTiles[tile.id] = new Image();
          dynmapTiles[tile.id].src = tile.url;
          dynmapTiles[tile.id].onload = function () {
            requestAnimationFrame(animate);
          };
        }
      } else {
        try {
          ctx.drawImage(
            dynmapTiles[tile.id],
            zoomedX(actualX),
            zoomedZ(actualZ),
            zoomed(tileWidth),
            zoomed(tileWidth)
          );
        } catch {
          ctx.fillStyle = "#000";
          ctx.fillRect(
            zoomedX(actualX),
            zoomedZ(actualZ),
            zoomed(tileWidth),
            zoomed(tileWidth)
          );
        }
      }
    }
  }
}

function nextPowerOfTwo(n) {
  let k = 1;
  while (k < n) {
    k = k << 1;
  }
  return k;
}

function renderMap() {
  let desiredTileWidth = zoomed_INV(100);

  let neededTileWidth = nextPowerOfTwo(desiredTileWidth);

  let zoom = -Math.log2(neededTileWidth / 32) + 8;

  zoom = Math.min(8, zoom);
  zoom = Math.max(1, zoom);

  for (let i = 1; i <= zoom; i++) {
    renderTilesInRange(canvas.getBoundingClientRect(), i);
  }
}

/**
 * setDefaultStyles - load default styles into ctx
 */
function setDefaultStyles() {
  if (!ctx) return;
  ctx.font = `${fontSize}px Manrope`;
  ctx.imageSmoothingEnabled = false;
}

export function initRenderer() {
  loadDatabase();
  retinaFix();
  setDefaultStyles();
  startEditing();
}

/* ---- EDITING FUNCTIONS ---- */

export function startEditing() {
  editing = true;
}

function distanceToJointSquared(joint: Joint, x: number, z: number) {
  return Math.abs((joint.x - x) ** 2 + (joint.z - z) ** 2);
}

function editorProcessMouse() {
  let closestJointId = undefined;
  let closestJoint = undefined;
  let closestDistance = Infinity;

  for (let jointId in joints) {
    let joint = joints[jointId];
    let distance = distanceToJointSquared(joint, mouse.rx, mouse.rz);
    if (distance < zoomed_INV(10) ** 2 && distance < closestDistance) {
      closestJointId = jointId;
      closestJoint = joint;
      closestDistance = distance;
    }
  }

  if (closestJointId == undefined) {
    canvas.style.cursor = "unset";
    return true;
  } else {
    if (mouse.button == 0) {
      canvas.style.cursor = "grabbing";

      joints[closestJointId].x = mouse.rx;
      joints[closestJointId].z = mouse.rz;

      if (docsToSave.filter((x) => x.id == closestJointId).length == 0)
        docsToSave.push({
          id: closestJointId,
          collection: "joints",
          source: joints,
        });

      requestAnimationFrame(animate);
      startSave();

      return false;
    } else {
      canvas.style.cursor = "grab";
    }
  }

  return true;
}

async function processEditorClick() {
  if (addingLine) {
    let newJoint = makeNewJoint();

    docsToSave.push({
      id: newJoint,
      collection: "joints",
      source: joints,
    });

    joints[newJoint] = {
      x: mouse.rx,
      z: mouse.rz,
    };

    lines[addingLine].joints.push(newJoint);
    startSave();
  }

  if (addingPoly) {
    let newJoint = makeNewJoint();

    docsToSave.push({
      id: newJoint,
      collection: "joints",
      source: joints,
    });

    joints[newJoint] = {
      x: mouse.rx,
      z: mouse.rz,
    };

    polygons[addingPoly].joints.push(newJoint);
    startSave();
  }

  requestAnimationFrame(animate);
}

export function addLine() {
  let newLine = makeNewLine();

  docsToSave.push({
    id: newLine,
    collection: "lines",
    source: lines,
  });

  lines[newLine] = {
    type: lines[Object.keys(lines)[0]].type,
    name: "New Line",
    joints: [],
  };

  addingLine = newLine;

  requestAnimationFrame(animate);
}

export function addPoly() {
  let newPoly = makeNewPoly();

  docsToSave.push({
    id: newPoly,
    collection: "polygons",
    source: polygons,
  });

  polygons[newPoly] = {
    type: polygons[Object.keys(polygons)[0]].type,
    name: "New Poly",
    joints: [],
  };

  addingPoly = newPoly;

  requestAnimationFrame(animate);
}

export function finishAdding() {
  addingLine = undefined;
  addingPoly = undefined;
}

/* ---- DATABASE COMMUNICATORS ---- */

function loadDatabase() {
  if (databaseType == "firestore") {
    onSnapshot(collection(firestore, "joints"), (res) => {
      res.forEach((doc) => {
        console.log("JOINT", doc.id, doc.data());

        joints[doc.id] = doc.data() as Joint;
      });
      requestAnimationFrame(animate);
    });

    onSnapshot(collection(firestore, "lines"), (res) => {
      res.forEach((doc) => {
        console.log("LINE", doc.id, doc.data());

        lines[doc.id] = doc.data() as Line;
      });
      requestAnimationFrame(animate);
    });

    onSnapshot(collection(firestore, "polygons"), (res) => {
      res.forEach((doc) => {
        console.log("POLYGON", doc.id, doc.data());

        polygons[doc.id] = doc.data() as Polygon;
      });
      requestAnimationFrame(animate);
    });

    onSnapshot(collection(firestore, "types"), (res) => {
      res.forEach((doc) => {
        console.log("TYPE", doc.id, doc.data());

        types[doc.id] = doc.data() as VisualType;
      });
      requestAnimationFrame(animate);
    });
  }

  if (databaseType == "realtime") {
    console.log("realtime");

    const worldsRef = ref(database, "worlds/" + worldId);
    onValue(worldsRef, (snapshot) => {
      const data = snapshot.val();

      console.log(JSON.stringify(data));

      for (let jointId in data.joints) {
        console.log("JOINT", jointId, data.joints[jointId]);

        joints[jointId] = data.joints[jointId] as Joint;
      }

      for (let lineId in data.lines) {
        console.log("LINE", lineId, data.lines[lineId]);

        lines[lineId] = data.lines[lineId] as Line;
      }

      for (let polygonId in data.polygons) {
        console.log("POLYGON", polygonId, data.polygons[polygonId]);

        polygons[polygonId] = data.polygons[polygonId] as Polygon;
      }

      for (let typeId in data.types) {
        console.log("POLYGON", typeId, data.types[typeId]);

        types[typeId] = data.types[typeId] as VisualType;
      }

      requestAnimationFrame(animate);
    });
  }
}

function startSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveChanges, 5000);
  document.getElementById("saveState").textContent = "Saving";
  document.getElementById("saveState").classList.add("saving");
}

function saveChanges() {
  let waiting = 0;

  if (databaseType == "firestore") {
    docsToSave.forEach((set) => {
      waiting++;
      setDoc(doc(firestore, set.collection, set.id), set.source[set.id]).then(
        (res) => {
          waiting--;

          if (waiting <= 0) {
            document.getElementById("saveState").textContent = "Saved";
            document.getElementById("saveState").classList.remove("saving");

            saveTimeout = setTimeout(hideSaveState, 30 * 1000);
          }
        }
      );
    });
  }

  if (databaseType == "realtime") {
    docsToSave.forEach((item) => {
      waiting++;

      set(
        ref(database, `worlds/${worldId}/${item.collection}/${item.id}`),
        item.source[item.id]
      ).then(() => {
        waiting--;

        if (waiting <= 0) {
          document.getElementById("saveState").textContent = "Saved";
          document.getElementById("saveState").classList.remove("saving");

          saveTimeout = setTimeout(hideSaveState, 30 * 1000);
        }
      });
    });
  }
}

function makeNewJoint() {
  if (databaseType == "firestore") {
    return doc(collection(firestore, "joints")).id;
  }
  if (databaseType == "realtime") {
    return push(child(ref(database, "worlds/" + worldId), "joints")).key;
  }
}

function makeNewLine() {
  if (databaseType == "firestore") {
    return doc(collection(firestore, "lines")).id;
  }
  if (databaseType == "realtime") {
    return push(child(ref(database, "worlds/" + worldId), "lines")).key;
  }
}

function makeNewPoly() {
  if (databaseType == "firestore") {
    return doc(collection(firestore, "polygons")).id;
  }
  if (databaseType == "realtime") {
    return push(child(ref(database, "worlds/" + worldId), "polygons")).key;
  }
}

function makeNewType() {
  if (databaseType == "firestore") {
    return doc(collection(firestore, "types")).id;
  }
  if (databaseType == "realtime") {
    return push(child(ref(database, "worlds/" + worldId), "types")).key;
  }
}

function hideSaveState() {
  document.getElementById("saveState").textContent = "";
}
