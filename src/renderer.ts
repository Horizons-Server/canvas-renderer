import {
  Joint,
  Joints,
  Polygon,
  Polygons,
  Line,
  Lines,
  VisualType,
  VisualTypes,
} from "./config";
import { getFirestore, collection, onSnapshot } from "firebase/firestore";

// globals
// canvas and ctx
const canvas = document.querySelector("canvas");
if (!canvas) throw new Error("Canvas not Found");
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Could not create context");

// data
let lines: Lines = {};
let polygons: Polygons = {};
let joints: Joints = {};
let types: VisualTypes = {};

// consts
const db = getFirestore();
canvas.width = innerWidth;
canvas.height = innerHeight;

// lets

let fontSize = 15;
let textAreas: DOMRect[] = [];
let editing = false;
let mouse = {
  x: 0,
  y: 0,
  rx: 0,
  ry: 0,
  offsetX: 0,
  offsetY: 0,
  button: 0,
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
let timingsInterval: any;

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

// lazy programmers globals
var scale = 1;
var wx = 0; // world zoom origin
var wy = 0;
var sx = 0; // mouse screen pos
var sy = 0;

function zoomed(number) {
  if (typeof number != "number") {
    return number;
  }

  // just scale
  return number * scale;
  // return Math.floor(number * scale);
}
// converts from world coord to screen pixel coord
function zoomedX(number) {
  // scale & origin X
  return (number - wx) * scale + sx;
  // return Math.floor((number - wx) * scale + sx);
}

function zoomedZ(number) {
  // scale & origin Y
  return (number - wy) * scale + sy;
  // return Math.floor((number - wy) * scale + sy);
}

// Inverse does the reverse of a calculation. Like (3 - 1) * 5 = 10   the inverse is 10 * (1/5) + 1 = 3
// multiply become 1 over ie *5 becomes * 1/5  (or just /5)
// Adds become subtracts and subtract become add.
// and what is first become last and the other way round.

// inverse function converts from screen pixel coord to world coord
function zoomed_INV(number) {
  if (typeof number != "number") {
    return number;
  }

  // just scale
  // return Math.floor(number / scale);
  return number / scale;
}

function zoomedX_INV(number) {
  // scale & origin INV
  return (number - sx) * (1 / scale) + wx;
  // return Math.floor((number - sx) * (1 / scale) + wx);

  // or return Math.floor((number - sx) / scale + wx);
}

function zoomedZ_INV(number) {
  // scale & origin INV
  return (number - sy) * (1 / scale) + wy;
  // return Math.floor((number - sy) * (1 / scale) + wy);

  // or return Math.floor((number - sy) / scale + wy);
}

function move(e: MouseEvent) {
  // mouse move event
  if (e.type === "mousedown") {
    mouse.button = 1;
  } else if (e.type === "mouseup" || e.type === "mouseout") {
    mouse.button = 0;
  }

  mouse.bounds = canvas.getBoundingClientRect();
  mouse.x = e.clientX - mouse.bounds.left;
  mouse.y = e.clientY - mouse.bounds.top;
  var xx = mouse.rx; // get last real world pos of mouse
  var yy = mouse.ry;

  mouse.rx = zoomedX_INV(mouse.x); // get the mouse real world pos via inverse scale and translate
  mouse.ry = zoomedZ_INV(mouse.y);
  if (mouse.button === 1) {
    // is mouse button down
    wx -= mouse.rx - xx; // move the world origin by the distance
    // moved in world coords
    wy -= mouse.ry - yy;
    // recaculate mouse world
    mouse.rx = zoomedX_INV(mouse.x);
    mouse.ry = zoomedZ_INV(mouse.y);
    requestAnimationFrame(animate);
  }
}

function trackWheel(e) {
  if (e.deltaY < 0) {
    scale = Math.min(100, scale * 1.1); // zoom in
  } else {
    scale = Math.max(0.01, scale * (1 / 1.1)); // zoom out is inverse of zoom in
  }

  wx = mouse.rx; // set world origin
  wy = mouse.ry;
  sx = mouse.x; // set screen origin
  sy = mouse.y;
  mouse.rx = zoomedX_INV(mouse.x); // recalc mouse world (real) pos
  mouse.ry = zoomedZ_INV(mouse.y);

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
}

// setInterval(viewTimings, 1000);

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
  ctx.fillStyle = "#ccc";
  ctx.fillRect(0, 0, innerWidth, innerHeight);

  ctx.fillStyle = "whitesmoke";
  ctx.fillRect(50, 50, innerWidth - 100, innerHeight - 100);

  ctx.fillStyle = "white";
  ctx.fillRect(100, 100, innerWidth - 200, innerHeight - 200);

  textAreas = [];

  timings("clearRect");

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
    zoomedX(box.right) < 100 ||
    zoomedX(box.left) > innerWidth - 100 ||
    zoomedZ(box.bottom) < 100 ||
    zoomedZ(box.top) > innerHeight - 100
  ) {
    return false;
  }
  return true;
}

//uses screen coords
function isOnScreen_INV(box: DOMRect) {
  if (
    box.right < 100 ||
    box.left > innerWidth - 100 ||
    box.bottom < 100 ||
    box.top > innerHeight - 100
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

    console.log(left, top, right, bottom);

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
    //draw shape
    ctx.beginPath();
    polygon.joints.forEach((joint, i) => {
      let currentJoint = joints[joint];
      if (i == 0) {
        ctx.moveTo(zoomedX(currentJoint.x), zoomedZ(currentJoint.z));
      } else {
        ctx.lineTo(zoomedX(currentJoint.x), zoomedZ(currentJoint.z));
      }
    });
    ctx.closePath();

    //get type from config
    let appearanceList = types[polygon.type]?.appearances;
    if (appearanceList == undefined) return;

    //paint type to canvas
    appearanceList.forEach((appearance) => {
      // TODO check dark mode
      // TODO check zoom

      let numLayers = Math.max(
        appearance.properties.length,
        appearance.functions.length
      );

      for (let i = 0; i < numLayers; i++) {
        ctx.save();

        setProperties(appearance.properties[i]);
        setProperties(appearance.functions[i]);

        // TODO function ovverrides

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

  //get top right corner
  let px = textWidth / 2;
  let py = fontSize / 2;

  //rotate it
  let rx = px * Math.cos(rotation) - py * Math.sin(rotation);
  let ry = py * Math.cos(rotation) - px * Math.sin(rotation);

  // that's all we need, now calculate the bounding box
  return new DOMRect(
    x - rx,
    z - Math.abs(ry),
    Math.abs(2 * rx),
    Math.abs(2 * ry)
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

  ctx.translate(x, z); //translate to center of shape
  //  ctx.rotate((Math.PI / 180) * rotation); //rotate in degrees.
  ctx.rotate(rotation); //rotate in radians
  ctx.translate(-x, -z); //translate center back to 0,0

  ctx.textBaseline = "middle";
  ctx.fillStyle = "#000";
  ctx.strokeStyle = "#eee";
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
    let polygon = polygons[polygonId]; //find the bounding box of the polygon
    if (polygon.name == undefined) return;
    let sumX = 0;
    let sumY = 0;
    let left = joints[polygon.joints[0]].x;
    let top = joints[polygon.joints[0]].z;
    let right = joints[polygon.joints[0]].x;
    let bottom = joints[polygon.joints[0]].z;
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
    )
      fillText(polygon.name, sumX / count, sumY / count, 0);
  }

  //draw line texts
  for (let lineId in lines) {
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

    //calculate positions of texts and draw them
    for (let i = 0; i <= totalDistance / textSpace; i++) {
      let offset = textSpace * i - textSpace / 2;
      offset += remainder / 2;

      if (offset < 0) {
        if (textWidth < totalDistance) {
          let currentJoint = joints[line.joints[0]];
          let prevJoint = joints[line.joints[1]];
          let angle = getTextAngle(prevJoint, currentJoint);
          let textPosition = pointAlongLine(
            prevJoint,
            currentJoint,
            totalDistance / 2
          );
          fillText(line.name, textPosition.x, textPosition.z, angle);
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

/**
 * setDefaultStyles - load default styles into ctx
 */
function setDefaultStyles() {
  if (ctx) ctx.font = `${fontSize}px arial`;
}

export function initRenderer() {
  loadFirestore();
  retinaFix();
  setDefaultStyles();
  startEditing();
}

function loadFirestore() {
  onSnapshot(collection(db, "joints"), (res) => {
    res.forEach((doc) => {
      console.log("JOINT", doc.id, doc.data());

      joints[doc.id] = doc.data() as Joint;
    });
    requestAnimationFrame(animate);
  });

  onSnapshot(collection(db, "lines"), (res) => {
    res.forEach((doc) => {
      console.log("LINE", doc.id, doc.data());

      lines[doc.id] = doc.data() as Line;
    });
    requestAnimationFrame(animate);
  });

  onSnapshot(collection(db, "polygons"), (res) => {
    res.forEach((doc) => {
      console.log("POLYGON", doc.id, doc.data());

      polygons[doc.id] = doc.data() as Polygon;
    });
    requestAnimationFrame(animate);
  });

  onSnapshot(collection(db, "types"), (res) => {
    res.forEach((doc) => {
      console.log("TYPE", doc.id, doc.data());

      types[doc.id] = doc.data() as VisualType;
    });
    requestAnimationFrame(animate);
  });
}

export function startEditing() {
  editing = true;
}

function distanceToJointSquared(joint: Joint, x: number, z: number) {
  return Math.abs((joint.x - x) ** 2 + (joint.z - z) ** 2);
}

function editorProcessMouse(x: number, z: number) {
  let closestJointId = undefined;
  let closestJoint = undefined;
  let closestDistance = Infinity;

  for (let jointId in joints) {
    let joint = joints[jointId];
    let distance = distanceToJointSquared(joint, x, z);
    if (distance < 50 ** 2 && distance < closestDistance) {
      closestJointId = jointId;
      closestJoint = joint;
      closestDistance = distance;
    }
  }

  if (closestJointId == undefined) {
    canvas.style.cursor = "unset";
    return true;
  } else {
    if (mouse.button == 1) {
      canvas.style.cursor = "grabbing";
      return false;
    } else {
      canvas.style.cursor = "grab";
    }
  }

  return true;
}
