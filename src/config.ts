type ApplicationType = "polygon" | "line" | "any" | "none";

interface Appearance {
  darkMode: boolean;
  lightMode: boolean;
  maxZoom: number;
  minZoom: number;
  functions: {
    [key: string]: string[];
  }[];
  properties: {
    [key: string]: string;
  }[];
}

/**
 * Joints are points, used to make lines and components
 */
export interface VisualType {
  appliesTo: ApplicationType;
  name: string;
  description: string;
  appearances: Appearance[];
}

export type VisualTypes = {
  [key: string]: VisualType;
};

/**
 * Joints are points, used to make lines and components
 */
export interface Joint {
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
  type: string; //one of the types in the config
  name?: string;
  description?: string;
  width?: number; //width of line (is added to type width)
  joints: string[]; //points of the line
}

export type Lines = {
  [key: string]: Line;
};

/**
 * Components are polygons, like buildings or parks
 */
export interface Polygon {
  type: string; //one of the types in the config
  name?: string;
  description?: string;
  joints: string[]; //points of the polygon
  overrides?: {
    functions: {
      [key: string]: string[];
    };
    properties: {
      [key: string]: string;
    };
  };
}

export type Polygons = {
  [key: string]: Polygon;
};
