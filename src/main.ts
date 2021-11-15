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

function drawComponents() {
  if (!ctx || !canvas) return;

  components.forEach((component) => {
    ctx.beginPath();
    component.nodes.forEach((node, i) => {
      let currentNode = nodes[node];
      if (i == 0) {
        ctx.moveTo(currentNode.x, currentNode.y);
      } else {
        ctx.lineTo(currentNode.x, currentNode.y);
      }
    });
    ctx.closePath();

    //@ts-ignore TS goes wild on this line
    let type = config.componentTypes[component.type]?.appearance?.light;
    if (type == undefined) return;

    let propertiesToChange = Object.keys(type);

    propertiesToChange.forEach((property) => {
      //@ts-ignore ctx won't err if config's wrong
      ctx[property] = type[property];
    });

    if (component.colorOverride != undefined)
      ctx.fillStyle = component.colorOverride;
    if (component.strokeOverride != undefined)
      ctx.strokeStyle = component.strokeOverride;

    ctx.fill();
    ctx.stroke();
  });
}

function drawConnections() {
  if (!ctx || !canvas) return;

  connections.forEach((connection) => {
    ctx.beginPath();
    connection.nodes.forEach((node, i) => {
      let currentNode = nodes[node];
      if (i == 0) {
        ctx.moveTo(currentNode.x, currentNode.y);
      } else {
        ctx.lineTo(currentNode.x, currentNode.y);
      }
    });

    //@ts-ignore TS goes wild on this line
    let typeList = config.connectionTypes[connection.type]?.appearance?.light;
    if (typeList == undefined) return;

    typeList.forEach((type: string[]) => {
      let propertiesToChange = Object.keys(type);
      propertiesToChange.forEach((property) => {
        //@ts-ignore ctx won't err if config's wrong
        ctx[property] = type[property];
      });

      ctx.lineWidth += connection.width;

      ctx.stroke();
    });
  });
}

function loadJson() {
  config.dataFiles.forEach((fileName) => {
    fetch("../data/" + fileName).then((res) => {
      res.json().then((json) => {
        //@ts-ignore
        components.push(...json.components);
        //@ts-ignore
        connections.push(...json.connections);
        //@ts-ignore
        nodes = Object.assign(nodes, json.nodes);

        requestAnimationFrame(animate);
      });
    });
  });
}

loadJson();
