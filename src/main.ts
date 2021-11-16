//globals
let connections: Connections = [];
let components: Components = [];
let nodes: Nodes = {};
const canvas = document.querySelector("canvas");
if (!canvas) throw new Error("Canvas not Found");
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Could not create context");
canvas.width = innerWidth;
canvas.height = innerHeight;
let canvasOffsetX = 0;
let canvasOffsetY = 0;
let fontSize = 15;
let mouse = {
  x: 0,
  y: 0,
  offsetX: 0,
  offsetY: 0,
};
let isDragging = false;
let textAreas: DOMRect[] = [];

let verbose = false;
let firstTime = {};
let perfTotal = {};
let perfCount = {};
let perfAvgs = {};
let perfMax = {};
let perfMin = {};

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

setInterval(viewTimings, 1000);

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

addEventListener("resize", () => {
  canvasOffsetX = 0;
  canvasOffsetY = 0;
  retinaFix();
});

addEventListener("mousemove", function (e) {
  if (isDragging) {
    mouse.offsetY += e.clientY - mouse.y;
    mouse.offsetX += e.clientX - mouse.x;
    mouse.y = e.clientY;
    mouse.x = e.clientX;

    requestAnimationFrame(animate);
  }
});

addEventListener("mousedown", function (e) {
  isDragging = true;

  {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }
});

addEventListener("mouseup", function () {
  isDragging = false;
});

/**
 * animate - draws a new frame
 */
function animate() {
  if (!ctx || !canvas) return;

  timings("frame");

  timings("clearRect");

  ctx.fillStyle = "#" + Math.floor(Math.random() * 16777215).toString(16);
  ctx.fillRect(-canvasOffsetX, -canvasOffsetY, canvas.width, canvas.height);
  textAreas = [];
  timings("clearRect");

  timings("offset");
  //handle offset
  if (isDragging) {
    ctx.translate(mouse.offsetX, mouse.offsetY);
    canvasOffsetX += mouse.offsetX;
    canvasOffsetY += mouse.offsetY;
  }
  mouse.offsetX = 0;
  mouse.offsetY = 0;
  timings("offset");

  //handle drawing
  timings("drawComponents");
  drawComponents();
  timings("drawComponents");

  timings("drawConnections");
  drawConnections();
  timings("drawConnections");

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
  if (!ctx) return;

  let propertiesToChange = Object.keys(properties);
  propertiesToChange.forEach((property) => {
    if (
      typeof ctx[property] == "function" &&
      Array.isArray(properties[property])
    ) {
      ctx[property](...properties[property]); //handle function props
    } else {
      ctx[property] = properties[property]; //handle normal props
    }
  });
}

/**
 * drawComponents - draws all components to the canvas
 */
function drawComponents() {
  if (!ctx || !canvas) return;

  components.forEach((component) => {
    //draw shape
    ctx.beginPath();
    component.nodes.forEach((node, i) => {
      let currentNode = nodes[node];
      if (i == 0) {
        ctx.moveTo(currentNode.x, currentNode.z);
      } else {
        ctx.lineTo(currentNode.x, currentNode.z);
      }
    });
    ctx.closePath();

    //get type from config
    let typeList = config.componentTypes[component.type]?.appearance?.light;
    if (typeList == undefined) return;

    //paint type to canvas
    typeList.forEach((type: any) => {
      ctx.save();

      setProperties(type);

      if (component.colorOverride != undefined)
        ctx.fillStyle = component.colorOverride;
      if (component.strokeOverride != undefined)
        ctx.strokeStyle = component.strokeOverride;

      ctx.fill();
      ctx.stroke();

      ctx.restore();
    });
  });
}

/**
 * drawConnections - draw all connections to the canvas
 */
function drawConnections() {
  if (!ctx || !canvas) return;

  let paintingConnections = true;
  let indexToPaint = 0;

  while (paintingConnections) {
    paintingConnections = false;

    connections.forEach((connection) => {
      //draw line
      ctx.beginPath();
      connection.nodes.forEach((node, i) => {
        let currentNode = nodes[node];

        if (i == 0) {
          ctx.moveTo(currentNode.x, currentNode.z);
        } else {
          ctx.lineTo(currentNode.x, currentNode.z);
        }
      });

      //get type from config
      let typeList = config.connectionTypes[connection.type]?.appearance?.light;
      if (typeList == undefined) return;

      let type = typeList[indexToPaint];

      if (!type) return;

      //paint type to canvas
      paintingConnections = true;

      ctx.save();

      setProperties(type);

      if (connection.width)
        ctx.lineWidth = connection.width + (parseInt(type.lineWidth) ?? 0);

      ctx.stroke();

      ctx.restore();
    });

    indexToPaint++;
  }
}

/**
 * applyRotationToBox - calculate the area and position of a
 * bit of text's bounding box
 *
 * @param texet the text in the box
 * @param x the x position of the center of the box
 * @param x the z position of the center of the box
 * @param rotation how far to rotate the box in radians
 * @return rect approximately surrounding the rotated text
 */
function applyRotationToBox(
  text: string,
  x: number,
  z: number,
  rotation: number
) {
  if (!ctx) return;

  let textWidth = ctx.measureText(text).width;

  // "magic formula"
  // uses ratios to approximate the size of the bounding box
  let halfHeight =
    fontSize / 2 + (rotation / (Math.PI / 2)) * (textWidth / 2 - fontSize / 2);
  let halfWidth =
    fontSize / 2 +
    ((Math.PI / 2 - rotation) / (Math.PI / 2)) * (textWidth / 2 - fontSize / 2);

  //convert to DOMRect
  return new DOMRect(
    x - halfWidth,
    z - halfHeight,
    halfWidth * 2,
    halfHeight * 2
  );
}

/**
 * checkTextOverlap - approximate whether a bit of text would overlap with
 * some other text
 *
 * @param  text     the bit of text in the box
 * @param  x position of the center of the box
 * @param  z position of the center of the box
 * @param  rotation rotation in radians
 * @return true if text overlaps
 */
function checkTextOverlap(
  text: string,
  x: number,
  z: number,
  rotation: number
) {
  for (let i = 0; i < textAreas.length; i++) {
    let a = textAreas[i];
    let b = applyRotationToBox(text, x, z, rotation);

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

  if (checkTextOverlap(text, x, z, rotation)) return false;

  //save text box to check overlap
  let newRect = applyRotationToBox(text, x, z, rotation);
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
 * getTextAngle - calculate the angle between two points
 *
 * @param  nodeA first node
 * @param  nodeB second node
 * @return the angle between them in radians
 */
function getTextAngle(nodeA: SingleNode, nodeB: SingleNode) {
  if (nodeA.x > nodeB.x) {
    let temp = nodeA;
    nodeA = nodeB;
    nodeB = temp;
  }

  let dx = nodeB.x - nodeA.x;
  let dz = nodeB.z - nodeA.z;

  return Math.atan2(dz, dx);
}

/**
 * getDistanceSquared - returns the distance squared between two nodes
 *
 * @param  nodeA first node
 * @param  nodeB second node
 * @return distance squared
 */
function getDistanceSquared(nodeA: SingleNode, nodeB: SingleNode) {
  return (nodeA.x - nodeB.x) ** 2 + (nodeA.z - nodeB.z) ** 2;
}

/**
 * pointAlongLine - calculates the position of text given the distance along
 * the line between two nodes
 *
 * @param  nodeA first node
 * @param  nodeB second node
 * @param  distance  how far along the line to place the point
 * @return coordinates
 */
function pointAlongLine(
  nodeA: SingleNode,
  nodeB: SingleNode,
  distance: number
) {
  let lineDistance = Math.sqrt(getDistanceSquared(nodeA, nodeB));
  let ratio = distance / lineDistance;

  let newX = nodeA.x + (nodeB.x - nodeA.x) * ratio;
  let newZ = nodeA.z + (nodeB.z - nodeA.z) * ratio;

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

  // draw components first
  components.forEach((component) => {
    //find the bounding box of the component
    if (component.name == undefined) return;
    let sumX = 0;
    let sumY = 0;
    let left = nodes[component.nodes[0]].x;
    let top = nodes[component.nodes[0]].z;
    let right = nodes[component.nodes[0]].x;
    let bottom = nodes[component.nodes[0]].z;
    let count = 0;
    component.nodes.forEach((node) => {
      let currentNode = nodes[node];

      top = Math.min(top, currentNode.z);
      bottom = Math.max(bottom, currentNode.z);
      left = Math.min(left, currentNode.x);
      right = Math.max(right, currentNode.x);

      sumX += currentNode.x;
      sumY += currentNode.z;
      count++;
    });

    if (
      bottom - top > fontSize &&
      right - left > ctx.measureText(component.name).width
    )
      fillText(component.name, sumX / count, sumY / count, 0);
  });

  //draw connection texts
  connections.forEach((connection) => {
    if (connection.name == undefined) return;

    let textWidth = ctx.measureText(connection.name).width;
    let textSpace = textWidth * 2;
    let totalDistances = [0];
    let totalDistance = 0;

    //calculate the length of the connection
    connection.nodes.forEach((node, i) => {
      if (i != 0) {
        let currentNode = nodes[node];
        let prevNode = nodes[connection.nodes[i - 1]];
        let segmentDistance = Math.sqrt(
          getDistanceSquared(currentNode, prevNode)
        );
        totalDistance += segmentDistance;
        totalDistances[i] = totalDistance;
      }
    });

    let remainder = textSpace % totalDistance;

    //calculate positions of texts and draw them
    for (let i = 0; i <= totalDistance / textSpace; i++) {
      let offset = textSpace * i - textSpace / 2;
      offset += remainder / 2;

      if (offset < 0) {
        if (textWidth < totalDistance) {
          let currentNode = nodes[connection.nodes[0]];
          let prevNode = nodes[connection.nodes[1]];
          let angle = getTextAngle(prevNode, currentNode);
          let textPosition = pointAlongLine(
            prevNode,
            currentNode,
            totalDistance / 2
          );
          fillText(connection.name, textPosition.x, textPosition.z, angle);
        }
      }

      let indexOfTrailingNode = 0;

      for (let j = 0; j < totalDistances.length; j++) {
        if (totalDistances[j] > offset) {
          indexOfTrailingNode = j;
          j = Infinity;
        }
      }

      if (indexOfTrailingNode == 0) return;

      let currentNode = nodes[connection.nodes[indexOfTrailingNode]];
      let prevNode = nodes[connection.nodes[indexOfTrailingNode - 1]];
      let angle = getTextAngle(prevNode, currentNode);

      offset -= totalDistances[indexOfTrailingNode - 1];

      let textPosition = pointAlongLine(prevNode, currentNode, offset);

      fillText(connection.name, textPosition.x, textPosition.z, angle);
    }
  });
}

/**
 * loadJson - load all data files
 */
function loadJson() {
  config.dataFiles.forEach((fileName) => {
    fetch("../data/" + fileName).then((res) => {
      res.json().then((json) => {
        components.push(...json.components);
        connections.push(...json.connections);
        nodes = Object.assign(nodes, json.nodes);

        requestAnimationFrame(animate);
      });
    });
  });
}

/**
 * setDefaultStyles - load default styles into ctx
 */
function setDefaultStyles() {
  setProperties(config.defaultStyles);
  if (ctx) ctx.font = `${fontSize}px arial`;
}

loadJson();
retinaFix();
setDefaultStyles();
