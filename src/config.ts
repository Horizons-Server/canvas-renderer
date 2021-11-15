let config = {
  dataFiles: ["demo.json"],
  componentTypes: {
    building: {
      appearance: {
        light: {
          fillStyle: "#ccc",
          lineWidth: "1",
          strokeStyle: "#000",
          peepee: 10,
        },
      },
    },
  },
  connectionTypes: {
    road: {
      appearance: {
        light: [
          { lineWidth: "3", strokeStyle: "#000", lineCap: "round" },
          { lineWidth: "1", strokeStyle: "#ccc", lineCap: "round" },
        ],
      },
    },
  },
};

interface SingleNode {
  id: string;
  x: number;
  y: number;
  connections: string[];
}

type Nodes = {
  [key: string]: SingleNode;
};

interface Connection {
  id: string;
  type: string;
  name: string;
  width: number;
  nodes: string[];
}

type Connections = Connection[];

interface Component {
  id: string;
  type: string;
  name: string;
  description: string;
  nodes: string[];
  colorOverride?: string;
  strokeOverride?: string;
}

type Components = Component[];
