export function getTileUrl(coords: { x: number; z: number; zoom: number }) {
  let Zcoord = 2 ** (8 - coords.zoom);
  let Xcoord = coords.x * 1;
  let Ycoord = coords.z * -1;

  let group = {
    x: Math.floor((Xcoord * Zcoord) / 32),
    y: Math.floor((Ycoord * Zcoord) / 32),
  };

  let numberInGroup = {
    x: Math.floor(Xcoord * Zcoord),
    y: Math.floor(Ycoord * Zcoord),
  };

  /* console.log(coords);
     console.log(group);
     console.log(numberInGroup);*/

  let zzz = "";

  for (var i = 8; i > coords.zoom; i--) {
    zzz += "z";
  }

  if (coords.zoom != 8) zzz += "_";

  let url = `https://dynmap.minecartrapidtransit.net/tiles/new/flat/${group.x}_${group.y}/${zzz}${numberInGroup.x}_${numberInGroup.y}.png`;
  //console.log(url)

  return {
    id:
      group.x +
      "." +
      group.y +
      "." +
      zzz +
      "." +
      numberInGroup.x +
      "." +
      numberInGroup.y,
    url,
  };
}
