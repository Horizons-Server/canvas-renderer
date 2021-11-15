let config = {
  dataFiles: ["demo.json"],

  /**
   * Component types define the visual style of drawn components
   * any canvas properties can be configured
   *
   * styles are drawn from top to bottom, which allows for
   * multiple strokes of varying sizes
   */
  componentTypes: {
    building: {
      appearance: {
        light: [
          {
            // FORMAT
            // ctxProperty: propertyValue
            // OR
            // ctxFunction: [parameterA, parameterB, etc]
            fillStyle: "#ccc",
            lineWidth: "4",
            strokeStyle: "#000",
          },
          {
            fillStyle: "#ccc",
            lineWidth: "2",
            strokeStyle: "#0f0",
          },
        ],
      },
    },
    park: {
      appearance: {
        light: [
          {
            fillStyle: "#0f0",
            lineWidth: "2",
            strokeStyle: "#000",
          },
        ],
      },
    },
  },

  /**
   * Connection types define the visual style of drawn connections
   * any canvas properties can be configured
   *
   * connections have no fill, only stroke
   *
   * styles are drawn from top to bottom, which allows for
   * multiple strokes of varying sizes
   *
   * to allow for smooth transitions between connections, connections
   * are painted synonymously
   *
   */
  connectionTypes: {
    road: {
      appearance: {
        light: [
          {
            lineWidth: "2",
            strokeStyle: "#000",
          },
          {
            lineWidth: "0",
            strokeStyle: "#ccc",
          },
        ],
      },
    },
    rail: {
      appearance: {
        light: [
          {
            lineWidth: "2",
            strokeStyle: "#ccc",
            setLineDash: [[2, 20]],
            lineCap: "butt",
          },
          {
            lineWidth: "-8",
            strokeStyle: "#ccc",
          },
        ],
      },
    },
  },

  /**
   * default styles will be used as default on all objects
   * unless they override
   */
  defaultStyles: {
    lineCap: "round",
    lineJoin: "round",
  },
};

/**
 * eventually this will be a uuid
 */
type id = string;

/**
 * Nodes are points, used to make connections and components
 */
interface SingleNode {
  id: id;
  x: number;
  z: number;
  connections: id[]; //should be kept up-to-date, but not used for rendering
}

type Nodes = {
  [key: string]: SingleNode;
};

/**
 * Connections are lines, like roads or rails
 */
interface Connection {
  id: id;
  type: string; //one of the types in the config
  name?: string;
  description?: string;
  width?: number; //width of line (is added to type width)
  nodes: id[]; //points of the line
}

type Connections = Connection[];

/**
 * Components are polygons, like buildings or parks
 */
interface Component {
  id: id;
  type: string; //one of the types in the config
  name?: string;
  description?: string;
  nodes: id[]; //points of the polygon
  colorOverride?: string; //override the fill color for a specific component
  strokeOverride?: string; //override the stroke color for a specific component
}

type Components = Component[];
