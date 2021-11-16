let config = {
  dataFiles: ["demo.json"],
  /**
   * Component types define the visual style of drawn components
   * any canvas properties can be configured
   *
   * styles are drawn from top to bottom, which allows for
   * multiple strokes of varying sizes
   */
  polygonTypes: {
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
   * Line types define the visual style of drawn lines
   * any canvas properties can be configured
   *
   * lines have no fill, only stroke
   *
   * styles are drawn from top to bottom, which allows for
   * multiple strokes of varying sizes
   *
   * to allow for smooth transitions between lines, lines
   * are painted synonymously
   *
   */
  lineTypes: {
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
   * unless they get overriden of course
   */
  defaultStyles: {
    lineCap: "round",
    lineJoin: "round",
  },
};

export { config };

/**
 * eventually this will be a uuid
 */
export type id = string;

/**
 * Joints are points, used to make lines and components
 */
export interface Joint {
  componentType: "joint";
  id: id;
  x: number;
  z: number;
}

export type Joints = {
  [key: string]: Joint;
};

/**
 * lines, like roads or rails
 */
export interface Line {
  componentType: "Line";
  id: id;
  type: string; //one of the types in the config
  name?: string;
  description?: string;
  width?: number; //width of line (is added to type width)
  joints: id[]; //points of the line
}

export type Lines = Line[];

/**
 * Components are polygons, like buildings or parks
 */
export interface Polygon {
  componentType: "Polygon";
  id: id;
  type: string; //one of the types in the config
  name?: string;
  description?: string;
  joints: id[]; //points of the polygon
  colorOverride?: string; //override the fill color for a specific component
  strokeOverride?: string; //override the stroke color for a specific component
}

export type Polygons = Polygon[];
