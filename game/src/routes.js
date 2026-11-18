// Routing: small waypoint graphs over the roads (cars) and the water (boats),
// so an autopilot — or a police unit — can drive from one side of the delta
// to the other instead of nosing into the river. Plain breadth-first search
// over hand-placed nodes; the graphs are tiny, so it runs in microseconds.

/** Road nodes: intersections and ends of the drivable streets. */
const ROAD_NODES = [
  [100, 1040], [540, 1040], [940, 1040], [1340, 1040], [1675, 1040], [1990, 1040],
  [2440, 1040], [2840, 1040], [3100, 1040],
  [1340, 100], [1340, 430], [1340, 1575], [1340, 2040], [1340, 2300],
  [540, 830], [540, 1575], [540, 1900],
  [940, 830], [940, 1575], [940, 1900],
  [1990, 100], [1990, 430], [1990, 760], [1990, 2040], [1990, 2300],
  [2440, 430], [2440, 760], [2440, 1900], [2440, 2300],
  [2840, 430], [2840, 760], [2840, 1900], [2840, 2300],
  [100, 2040], [1675, 2040], [3100, 2040],
  [700, 430], [700, 1040], [1150, 1040],
  // The stilt-row node sits EAST of the houses, in the gap between house 2
  // and house 3: the old spot (1190,1350) was the mission target itself, in a
  // pocket south of house 2 that no car can enter, so every route to it ended
  // in a straight line through a wall and the car pinned itself to the house.
  [1300, 1375], [2635, 640], [1880, 1890], [1470, 1900],
  [700, 1160], [2515, 1060], [2410, 1180], [1100, 960],
];

/** Road edges: pairs of node indices joined by one street. */
const ROAD_EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8],
  [9, 10], [10, 3], [3, 11], [11, 12], [12, 13],
  [14, 1], [1, 15], [15, 16],
  [17, 2], [2, 18], [18, 19],
  [20, 21], [21, 5], [5, 22], [22, 23], [23, 24],
  [25, 6], [6, 26], [26, 27], [27, 28],
  [29, 7], [7, 30], [30, 31], [31, 32],
  [33, 12], [12, 35], [35, 34],
  [10, 36], [3, 37], [37, 2], [2, 38], [38, 3],
  [39, 11], [40, 26], [41, 23], [42, 12], [43, 37], [44, 6], [45, 6], [46, 38],
];

/** Water nodes: junctions and ends of the river and bayou channels. */
const WATER_NODES = [
  [1675, 150], [1675, 760], [1675, 1040], [1675, 1575], [1675, 2040], [1675, 2250],
  [200, 1575], [1400, 1575], [2000, 760], [3100, 760], [800, 2120], [1300, 2120],
];

/** Water edges: pairs of node indices joined by one channel. */
const WATER_EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5],
  [6, 7], [7, 3],
  [1, 8], [8, 9],
  [10, 11], [11, 4],
];

function buildGraph(nodes, edges) {
  const adj = nodes.map(() => []);
  for (const [a, b] of edges) {
    adj[a].push(b);
    adj[b].push(a);
  }
  return adj;
}

const ROAD_GRAPH = buildGraph(ROAD_NODES, ROAD_EDGES);
const WATER_GRAPH = buildGraph(WATER_NODES, WATER_EDGES);

function nearestNode(nodes, x, y) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < nodes.length; i += 1) {
    const d = (nodes[i][0] - x) ** 2 + (nodes[i][1] - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function bfs(nodes, adj, from, to) {
  // A raw node is [x, y], not {x, y}: returning it as-is made the waypoint's
  // .x undefined, which poisoned the steering angle to NaN and the car
  // itself to NaN. Always return proper {x, y} points.
  if (from === to) return [{ x: nodes[from][0], y: nodes[from][1] }];
  const prev = new Array(nodes.length).fill(-1);
  const queue = [from];
  prev[from] = from;
  while (queue.length > 0) {
    const cur = queue.shift();
    for (const next of adj[cur]) {
      if (prev[next] !== -1) continue;
      prev[next] = cur;
      if (next === to) {
        const path = [];
        let n = to;
        while (n !== from) {
          path.unshift({ x: nodes[n][0], y: nodes[n][1] });
          n = prev[n];
        }
        return path;
      }
      queue.push(next);
    }
  }
  return [];
}

/**
 * A route of waypoints from (fx, fy) to (tx, ty) for a car ('land') or a boat
 * ('water'). The first waypoint is the nearest graph node to the start, the
 * last is the target itself. Returns [] when no route exists.
 */
export function findRoute(fx, fy, tx, ty, kind) {
  const nodes = kind === 'water' ? WATER_NODES : ROAD_NODES;
  const adj = kind === 'water' ? WATER_GRAPH : ROAD_GRAPH;
  const from = nearestNode(nodes, fx, fy);
  const to = nearestNode(nodes, tx, ty);
  const path = bfs(nodes, adj, from, to);
  path.push({ x: tx, y: ty });
  return path;
}
