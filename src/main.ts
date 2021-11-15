//globals
let connections: Connections = [];
let components: Components = [];
let nodes: Nodes = {};
const canvas = document.querySelector("canvas");
if (!canvas) throw new Error("Canvas not Found");
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Could not create context");
ctx.save();
canvas.width = innerWidth;
canvas.height = innerHeight;
let mouse = {
  x: 0,
  y: 0,
  offsetX: 0,
  offsetY: 0,
};
let isDragging = false;

addEventListener("resize", () => {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
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

function animate() {
  if (!ctx || !canvas) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (isDragging) ctx.translate(mouse.offsetX, mouse.offsetY);

  mouse.offsetX = 0;
  mouse.offsetY = 0;

  drawComponents();
  drawConnections();

  console.log("FRAME");
}

function setProperties(properties: { [key: string]: any }) {
  if (!ctx) return;

  let propertiesToChange = Object.keys(properties);
  propertiesToChange.forEach((property) => {
    if (
      typeof ctx[property] == "function" &&
      Array.isArray(properties[property])
    ) {
      ctx[property](...properties[property]);
    } else {
      ctx[property] = properties[property];
    }
  });
}

function drawComponents() {
  if (!ctx || !canvas) return;

  components.forEach((component) => {
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

    let typeList = config.componentTypes[component.type]?.appearance?.light;
    if (typeList == undefined) return;

    typeList.forEach((type: any) => {
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

function drawConnections() {
  if (!ctx || !canvas) return;

  connections.forEach((connection) => {
    ctx.beginPath();
    connection.nodes.forEach((node, i) => {
      let currentNode = nodes[node];

      if (i == 0) {
        ctx.moveTo(currentNode.x, currentNode.z);
      } else {
        ctx.lineTo(currentNode.x, currentNode.z);
      }
    });

    let typeList = config.connectionTypes[connection.type]?.appearance?.light;
    if (typeList == undefined) return;

    typeList.forEach((type: any) => {
      ctx.save();

      setProperties(type);

      if (connection.width) ctx.lineWidth += connection.width;

      ctx.stroke();

      ctx.restore();
    });
  });
}

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

function setDefaultStyles() {
  setProperties(config.defaultStyles);
}

loadJson();
setDefaultStyles();
