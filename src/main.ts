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

let perfTotal = 0;
let perfCount = 0;

/**
 * animate - draws a new frame
 */
function animate() {
  if (!ctx || !canvas) return;

  let start = performance.now();

  //clear rect
  ctx.clearRect(-canvasOffsetX, -canvasOffsetY, canvas.width, canvas.height);

  //handle offset
  if (isDragging) {
    ctx.translate(mouse.offsetX, mouse.offsetY);
    canvasOffsetX += mouse.offsetX;
    canvasOffsetY += mouse.offsetY;
  }
  mouse.offsetX = 0;
  mouse.offsetY = 0;

  //handle drawing
  drawComponents();
  drawConnections();
  renderAllText();

  let end = performance.now();
  perfCount++;
  perfTotal += end - start;

  console.log("frame took", end - start, "ms (/16ms)");
  console.log("AVG frame took", perfTotal / perfCount, "ms (/16ms)");
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

function fillText(text: string, x: number, y: number, rotation: number) {
  if (!ctx || !canvas) return;

  ctx.save();

  ctx.translate(x, y); //translate to center of shape
  //  ctx.rotate((Math.PI / 180) * rotation); //rotate 25 degrees.
  ctx.rotate(rotation);
  ctx.translate(-x, -y); //translate center back to 0,0

  ctx.textBaseline = "middle";

  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.fillText(text, x, y);

  ctx.restore();
}

function getTextAngle(nodeA: SingleNode, nodeB: SingleNode) {
  if (nodeA.x > nodeB.x) {
    let temp = nodeA;
    nodeA = nodeB;
    nodeB = temp;
  }

  let dx = Math.abs(nodeA.x - nodeB.x);
  let dz = Math.abs(nodeA.z - nodeB.z);

  return Math.atan2(dz, dx);
}

function renderAllText() {
  if (!ctx || !canvas) return;
  connections.forEach((connection) => {
    if (connection.name == undefined) return;

    connection.nodes.forEach((node, i) => {
      let currentNode = nodes[node];

      if (i != 0) {
        let prevNode = nodes[connection.nodes[i - 1]];
        let angle = getTextAngle(prevNode, currentNode);

        if (connection.name == undefined || currentNode == undefined) return;

        fillText(connection.name, currentNode.x, currentNode.z, angle);
      }
    });
  });

  components.forEach((component) => {
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
