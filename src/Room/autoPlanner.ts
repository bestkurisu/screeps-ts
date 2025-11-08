/**
 * 房间自动布局规划器
 * 使用最小割算法计算防御性建筑（rampart）的最佳位置
 *
 * 原始代码由 Saruss 编写，Chobobobo 适配为 TypeScript
 * 本版本进行了重构和优化
 */

import { errorMapper } from "@/utils/framework/errorMapper";

// 地形类型常量（导出以便测试使用）
export const UNWALKABLE = -1; // 不可行走（墙壁）
export const NORMAL = 0; // 普通可行走地形
export const PROTECTED = 1; // 受保护区域
export const TO_EXIT = 2; // 通向出口的区域
export const EXIT = 3; // 出口区域
export const EXPOSED = 5; // 暴露区域（不安全）
export const RAMPART_MIN = 9; // 需要建造 rampart 的位置

// 8 方向偏移量（上、左上、左、左下、下、右下、右、右上）
export const SURROUND_OFFSETS: ReadonlyArray<[number, number]> = [
  [0, -1], [-1, -1], [-1, 0], [-1, 1],
  [0, 1], [1, 1], [1, 0], [1, -1]
];

// 房间尺寸常量（导出以便测试使用）
export const ROOM_SIZE = 50;
export const ROOM_MAX_INDEX = 49;
const GRAPH_VERTEX_COUNT = 2 * ROOM_SIZE * ROOM_SIZE + 2; // 每个瓦片有上下两个顶点，加上源点和汇点
const SOURCE_VERTEX = 2 * ROOM_SIZE * ROOM_SIZE; // 源点位置
const SINK_VERTEX = 2 * ROOM_SIZE * ROOM_SIZE + 1; // 汇点位置
const TOP_OFFSET = 0; // 顶部顶点偏移
const BOT_OFFSET = ROOM_SIZE * ROOM_SIZE; // 底部顶点偏移

// 可视化开关
const VISUALIZATION = false;

/**
 * 边界定义
 */
interface Bounds {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * 位置坐标
 */
interface Position {
  x: number;
  y: number;
}

/**
 * 图的边结构
 */
interface Edge {
  v: number; // 目标顶点
  r: number; // 反向边索引
  c: number; // 容量
  f: number; // 流量
  u?: number; // 源顶点（用于最小割计算）
}

/**
 * 图数据结构，实现 Dinic 算法计算最大流/最小割
 */
class Graph {
  private readonly v: number; // 顶点数量
  private readonly level: number[]; // 层级数组（用于 BFS）
  private readonly edges: Edge[][]; // 邻接表

  constructor(vertexCount: number) {
    this.v = vertexCount;
    this.level = new Array(vertexCount);
    this.edges = Array(vertexCount).fill(0).map(() => []);
  }

  /**
   * 添加新边
   * @param u 源顶点
   * @param v 目标顶点
   * @param c 容量
   */
  addEdge(u: number, v: number, c: number): void {
    // 正向边
    this.edges[u].push({ v, r: this.edges[v].length, c, f: 0 });
    // 反向边（用于残差图）
    this.edges[v].push({ v: u, r: this.edges[u].length - 1, c: 0, f: 0 });
  }

  /**
   * BFS：计算层级图，判断是否存在从 s 到 t 的路径
   * @param s 源点
   * @param t 汇点
   * @returns 是否存在路径
   */
  bfs(s: number, t: number): boolean {
    if (t >= this.v) return false;

    // 重置层级
    this.level.fill(-1);
    this.level[s] = 0;

    // 使用队列进行 BFS（使用索引而非 shift 以提高性能）
    const queue: number[] = [s];
    let queueIndex = 0;

    while (queueIndex < queue.length) {
      const u = queue[queueIndex++];
      const edges = this.edges[u];

      for (let i = 0; i < edges.length; i++) {
        const edge = edges[i];
        if (this.level[edge.v] < 0 && edge.f < edge.c) {
          this.level[edge.v] = this.level[u] + 1;
          queue.push(edge.v);
        }
      }
    }

    return this.level[t] >= 0;
  }

  /**
   * DFS：沿路径发送流量
   * @param u 当前顶点
   * @param f 当前路径上的流量
   * @param t 汇点
   * @param count 每个顶点已探索的边数
   * @returns 发送的流量
   */
  dfsFlow(u: number, f: number, t: number, count: number[]): number {
    if (u === t) return f; // 到达汇点

    const edges = this.edges[u];
    while (count[u] < edges.length) {
      const edge = edges[count[u]];

      // 检查边是否在层级图中且还有剩余容量
      if (this.level[edge.v] === this.level[u] + 1 && edge.f < edge.c) {
        const flowTillHere = Math.min(f, edge.c - edge.f);
        const flowToT = this.dfsFlow(edge.v, flowTillHere, t, count);

        if (flowToT > 0) {
          // 更新正向边流量
          edge.f += flowToT;
          // 更新反向边流量（残差图）
          this.edges[edge.v][edge.r].f -= flowToT;
          return flowToT;
        }
      }

      count[u]++;
    }

    return 0;
  }

  /**
   * 计算最小割
   * 使用 Dinic 算法计算最大流，返回最小割的流量值
   * @param s 源点
   * @param t 汇点
   * @returns 最小割的流量值，如果 s === t 返回 -1
   */
  calcMinCut(s: number, t: number): number {
    if (s === t) return -1;

    let returnValue = 0;
    const count = new Array(this.v + 1).fill(0);

    // 重复执行 BFS 和 DFS 直到找不到增广路径
    while (this.bfs(s, t)) {
      count.fill(0);
      let flow: number;
      do {
        flow = this.dfsFlow(s, Number.MAX_VALUE, t, count);
        if (flow > 0) returnValue += flow;
      } while (flow > 0);
    }

    return returnValue;
  }

  /**
   * BFS 计算最小割的边
   * 标记从源点可达的顶点，返回最小割中的边
   * @param s 源点
   * @returns 最小割中的顶点索引数组
   */
  bfsTheCut(s: number): number[] {
    // 重置层级数组用于标记可达性
    this.level.fill(-1);
    this.level[s] = 1;

    // BFS 标记所有从源点可达的顶点
    const queue: number[] = [s];
    let queueIndex = 0;
    const edgesInCut: Edge[] = [];

    while (queueIndex < queue.length) {
      const u = queue[queueIndex++];
      const edges = this.edges[u];

      for (let i = 0; i < edges.length; i++) {
        const edge = edges[i];

        // 如果边还有剩余容量，标记目标顶点为可达
        if (edge.f < edge.c) {
          if (this.level[edge.v] < 1) {
            this.level[edge.v] = 1;
            queue.push(edge.v);
          }
        }

        // 如果边已满且容量大于 0，可能是最小割中的边
        if (edge.f === edge.c && edge.c > 0) {
          edge.u = u;
          edgesInCut.push(edge);
        }
      }
    }

    // 只返回那些阻塞且指向不可达顶点的边
    const minCut: number[] = [];
    for (let i = 0; i < edgesInCut.length; i++) {
      if (this.level[edgesInCut[i].v] === -1) {
        minCut.push(edgesInCut[i].u!);
      }
    }

    return minCut;
  }
}

/**
 * 地形数据接口（用于纯函数）
 */
export interface TerrainData {
  get(x: number, y: number): number;
}

/**
 * 从地形数据创建房间二维数组（纯函数版本）
 * @param terrainData 地形数据
 * @param bounds 边界范围
 * @returns 二维数组，标记不同类型的地形
 */
export function createRoom2DArrayFromTerrain(
  terrainData: TerrainData,
  bounds: Bounds = { x1: 0, y1: 0, x2: 49, y2: 49 }
): number[][] {
  const room2D = Array(ROOM_SIZE).fill(0).map(() => Array(ROOM_SIZE).fill(UNWALKABLE));

  // 标记可行走区域
  for (let x = bounds.x1; x <= bounds.x2; x++) {
    for (let y = bounds.y1; y <= bounds.y2; y++) {
      if (terrainData.get(x, y) !== TERRAIN_MASK_WALL) {
        room2D[x][y] = NORMAL;

        // 标记边界为通向出口
        if (x === bounds.x1 || y === bounds.y1 || x === bounds.x2 || y === bounds.y2) {
          room2D[x][y] = TO_EXIT;
        }

        // 标记实际出口
        if (x === 0 || y === 0 || x === ROOM_MAX_INDEX || y === ROOM_MAX_INDEX) {
          room2D[x][y] = EXIT;
        }
      }
    }
  }

  // 标记出口附近的区域（不能建造墙壁/rampart 的地方）
  // 处理左右边界
  for (let y = 1; y < ROOM_MAX_INDEX; y++) {
    if (room2D[0][y - 1] === EXIT || room2D[0][y] === EXIT || room2D[0][y + 1] === EXIT) {
      room2D[1][y] = TO_EXIT;
    }
    if (room2D[ROOM_MAX_INDEX][y - 1] === EXIT ||
        room2D[ROOM_MAX_INDEX][y] === EXIT ||
        room2D[ROOM_MAX_INDEX][y + 1] === EXIT) {
      room2D[ROOM_MAX_INDEX - 1][y] = TO_EXIT;
    }
  }

  // 处理上下边界
  for (let x = 1; x < ROOM_MAX_INDEX; x++) {
    if (room2D[x - 1][0] === EXIT || room2D[x][0] === EXIT || room2D[x + 1][0] === EXIT) {
      room2D[x][1] = TO_EXIT;
    }
    if (room2D[x - 1][ROOM_MAX_INDEX] === EXIT ||
        room2D[x][ROOM_MAX_INDEX] === EXIT ||
        room2D[x + 1][ROOM_MAX_INDEX] === EXIT) {
      room2D[x][ROOM_MAX_INDEX - 1] = TO_EXIT;
    }
  }

  return room2D;
}

/**
 * 创建房间地形的二维数组（包装函数，从游戏对象获取数据）
 * @param roomname 房间名称
 * @param bounds 边界范围
 * @returns 二维数组，标记不同类型的地形
 */
function createRoom2DArray(roomname: string, bounds: Bounds = { x1: 0, y1: 0, x2: 49, y2: 49 }): number[][] {
  const terrain = new Room.Terrain(roomname);
  return createRoom2DArrayFromTerrain(terrain, bounds);
}

/**
 * 将顶点索引转换为坐标
 */
export function vertexToPosition(vertex: number): Position {
  return {
    x: vertex % ROOM_SIZE,
    y: Math.floor(vertex / ROOM_SIZE)
  };
}

/**
 * 将坐标转换为顶点索引
 */
export function positionToVertex(x: number, y: number): number {
  return y * ROOM_SIZE + x;
}

/**
 * 创建图结构
 * @param roomname 房间名称
 * @param coords 需要保护的位置坐标数组
 * @param bounds 边界范围
 * @returns 图对象，如果边界无效则返回 null
 */
function createGraph(roomname: string, coords: number[][], bounds: Bounds): Graph | null {
  // 验证边界
  if (bounds.x1 >= bounds.x2 || bounds.y1 >= bounds.y2 ||
      bounds.x1 < 0 || bounds.y1 < 0 ||
      bounds.x2 > ROOM_MAX_INDEX || bounds.y2 > ROOM_MAX_INDEX) {
    console.log(`[autoPlanner] 错误：无效的边界 ${JSON.stringify(bounds)}`);
    return null;
  }

  const roomArray = createRoom2DArray(roomname, bounds);

  // 标记需要保护的位置
  for (const coord of coords) {
    if (roomArray[coord[0]]?.[coord[1]] === NORMAL) {
      roomArray[coord[0]][coord[1]] = PROTECTED;
    }
  }

  // 可视化（如果启用）
  if (VISUALIZATION) {
    errorMapper(() => {
      const visual = new RoomVisual(roomname);
      for (let x = 0; x < ROOM_SIZE; x++) {
        for (let y = 0; y < ROOM_SIZE; y++) {
          const value = roomArray[x][y];
          if (value === UNWALKABLE) {
            visual.circle(x, y, { radius: 0.5, fill: "#111166", opacity: 0.3 });
          } else if (value === NORMAL) {
            visual.circle(x, y, { radius: 0.5, fill: "#e8e863", opacity: 0.3 });
          } else if (value === PROTECTED) {
            visual.circle(x, y, { radius: 0.5, fill: "#75e863", opacity: 0.3 });
          } else if (value === TO_EXIT) {
            visual.circle(x, y, { radius: 0.5, fill: "#b063e8", opacity: 0.3 });
          }
        }
      }
    });
  }

  // 创建图
  const graph = new Graph(GRAPH_VERTEX_COUNT);
  const infinity = Number.MAX_VALUE;

  // 为每个瓦片创建顶点和边
  // 每个瓦片有两个顶点：top（顶部）和 bot（底部）
  // top -> bot 的边容量为 1（表示使用这个瓦片）
  // bot -> 相邻瓦片的 top 的边容量为无穷（表示可以穿过）
  for (let x = 1; x < ROOM_MAX_INDEX; x++) {
    for (let y = 1; y < ROOM_MAX_INDEX; y++) {
      const top = positionToVertex(x, y) + TOP_OFFSET;
      const bot = top + BOT_OFFSET;
      const tileType = roomArray[x][y];

      if (tileType === NORMAL) {
        // 普通瓦片：创建 top -> bot 边
        graph.addEdge(top, bot, 1);

        // 连接到相邻瓦片
        for (const [dx, dy] of SURROUND_OFFSETS) {
          const nx = x + dx;
          const ny = y + dy;
          const neighborType = roomArray[nx]?.[ny];
          if (neighborType === NORMAL || neighborType === TO_EXIT) {
            graph.addEdge(bot, positionToVertex(nx, ny) + TOP_OFFSET, infinity);
          }
        }
      } else if (tileType === PROTECTED) {
        // 受保护瓦片：从源点连接到 top，然后 top -> bot
        graph.addEdge(SOURCE_VERTEX, top, infinity);
        graph.addEdge(top, bot, 1);

        // 连接到相邻瓦片
        for (const [dx, dy] of SURROUND_OFFSETS) {
          const nx = x + dx;
          const ny = y + dy;
          const neighborType = roomArray[nx]?.[ny];
          if (neighborType === NORMAL || neighborType === TO_EXIT) {
            graph.addEdge(bot, positionToVertex(nx, ny) + TOP_OFFSET, infinity);
          }
        }
      } else if (tileType === TO_EXIT) {
        // 通向出口的瓦片：从 top 连接到汇点
        graph.addEdge(top, SINK_VERTEX, infinity);
      }
    }
  }

  return graph;
}

/**
 * 删除死胡同中的不必要切块
 * @param roomname 房间名称
 * @param cutTilesArray 切块位置数组（会被修改）
 */
function deleteTilesToDeadEnds(roomname: string, cutTilesArray: Position[]): void {
  const roomArray = createRoom2DArray(roomname);

  // 将所有切块标记为不可行走
  for (let i = cutTilesArray.length - 1; i >= 0; i--) {
    const tile = cutTilesArray[i];
    if (roomArray[tile.x]?.[tile.y] !== undefined) {
      roomArray[tile.x][tile.y] = UNWALKABLE;
    }
  }

  // 从出口开始进行洪水填充，标记所有可达的区域
  const unvisitedPos: number[] = [];

  // 收集所有出口附近的 TO_EXIT 位置
  for (let y = 1; y < ROOM_MAX_INDEX; y++) {
    if (roomArray[1]?.[y] === TO_EXIT) unvisitedPos.push(positionToVertex(1, y));
    if (roomArray[ROOM_MAX_INDEX - 1]?.[y] === TO_EXIT) {
      unvisitedPos.push(positionToVertex(ROOM_MAX_INDEX - 1, y));
    }
  }
  for (let x = 1; x < ROOM_MAX_INDEX; x++) {
    if (roomArray[x]?.[1] === TO_EXIT) unvisitedPos.push(positionToVertex(x, 1));
    if (roomArray[x]?.[ROOM_MAX_INDEX - 1] === TO_EXIT) {
      unvisitedPos.push(positionToVertex(x, ROOM_MAX_INDEX - 1));
    }
  }

  // BFS 标记所有可达区域
  while (unvisitedPos.length > 0) {
    const index = unvisitedPos.pop()!;
    const pos = vertexToPosition(index);
    const x = pos.x;
    const y = pos.y;

    for (const [dx, dy] of SURROUND_OFFSETS) {
      const nx = x + dx;
      const ny = y + dy;
      if (roomArray[nx]?.[ny] === NORMAL) {
        unvisitedPos.push(positionToVertex(nx, ny));
        roomArray[nx][ny] = TO_EXIT;
      }
    }
  }

  // 移除那些周围没有 TO_EXIT 的切块（死胡同）
  for (let i = cutTilesArray.length - 1; i >= 0; i--) {
    const tile = cutTilesArray[i];
    let leadsToExit = false;

    for (const [dx, dy] of SURROUND_OFFSETS) {
      const nx = tile.x + dx;
      const ny = tile.y + dy;
      if (roomArray[nx]?.[ny] === TO_EXIT) {
        leadsToExit = true;
        break;
      }
    }

    if (!leadsToExit) {
      cutTilesArray.splice(i, 1);
    }
  }
}

/**
 * 计算最小割的瓦片位置
 * @param roomname 房间名称
 * @param coords 需要保护的位置坐标数组
 * @param bounds 边界范围
 * @param verbose 是否输出详细信息
 * @returns 需要建造 rampart 的位置数组
 */
function getCutTiles(
  roomname: string,
  coords: number[][],
  bounds: Bounds = { x1: 0, y1: 0, x2: 49, y2: 49 },
  verbose = false
): Position[] {
  const graph = createGraph(roomname, coords, bounds);
  if (!graph) return [];

  const count = graph.calcMinCut(SOURCE_VERTEX, SINK_VERTEX);
  if (verbose) {
    console.log(`[autoPlanner] 最小割中的瓦片数量: ${count}`);
  }

  const positions: Position[] = [];
  if (count > 0) {
    const cutEdges = graph.bfsTheCut(SOURCE_VERTEX);

    // 将顶点索引转换为坐标
    for (const vertex of cutEdges) {
      positions.push(vertexToPosition(vertex));
    }
  }

  // 如果不是整个房间，尝试检测并删除死胡同中的切块
  const isWholeRoom = bounds.x1 === 0 && bounds.y1 === 0 &&
                      bounds.x2 === ROOM_MAX_INDEX && bounds.y2 === ROOM_MAX_INDEX;
  if (positions.length > 0 && !isWholeRoom) {
    deleteTilesToDeadEnds(roomname, positions);
  }

  // 可视化结果
  if (VISUALIZATION && positions.length > 0) {
    errorMapper(() => {
      const visual = new RoomVisual(roomname);
      for (const pos of positions) {
        visual.circle(pos.x, pos.y, { radius: 0.5, fill: "#ff7722", opacity: 0.9 });
      }
    });
  }

  return positions;
}

/**
 * 计算房间的防御布局
 * @param roomname 房间名称
 * @param protectedPos 需要保护的位置数组
 * @param controllerPos 控制器位置
 * @returns [rampart 位置数组, 成本矩阵]
 */
export function calculate(
  roomname: string,
  protectedPos: [number, number][],
  controllerPos: [number, number]
): [Position[], CostMatrix] {
  const roomArray = createRoom2DArray(roomname);

  // 扩展保护区域：将保护位置向外扩展 3 格
  const protectedArr: number[][] = Array(ROOM_SIZE).fill(0).map(() => Array(ROOM_SIZE).fill(0));
  const expandedProtectedPos: [number, number][] = [];

  // 初始化保护数组和扩展队列
  for (const pos of protectedPos) {
    protectedArr[pos[0]][pos[1]] = 1;
    expandedProtectedPos.push([pos[0], pos[1]]);
  }

  // BFS 扩展保护区域
  const frontier: [number, number][] = [...expandedProtectedPos];
  let frontierIndex = 0;

  while (frontierIndex < frontier.length) {
    const p = frontier[frontierIndex++];
    const currentLevel = protectedArr[p[0]][p[1]];

    for (const [dx, dy] of SURROUND_OFFSETS) {
      const x = p[0] + dx;
      const y = p[1] + dy;

      if (x >= 0 && x < ROOM_SIZE && y >= 0 && y < ROOM_SIZE &&
          protectedArr[x]?.[y] === 0) {
        const newLevel = currentLevel + 1;
        protectedArr[x][y] = newLevel;
        expandedProtectedPos.push([x, y]);

        if (newLevel <= 3) {
          frontier.push([x, y]);
        }
      }
    }
  }

  // 添加控制器周围的位置
  for (const [dx, dy] of SURROUND_OFFSETS) {
    const x = controllerPos[0] + dx;
    const y = controllerPos[1] + dy;
    if (x >= 0 && x < ROOM_SIZE && y >= 0 && y < ROOM_SIZE) {
      expandedProtectedPos.push([x, y]);
    }
  }

  // 计算最小割位置
  const positions = getCutTiles(roomname, expandedProtectedPos);

  // 标记 rampart 位置
  for (const pos of positions) {
    if (roomArray[pos.x]?.[pos.y] !== undefined) {
      roomArray[pos.x][pos.y] = RAMPART_MIN;
    }
  }

  // BFS 查找暴露区域（从出口开始，无法到达 rampart 的区域）
  const exposedFrontier: [number, number][] = [];
  const explored = Array(ROOM_SIZE).fill(0).map(() => Array(ROOM_SIZE).fill(false));

  // 初始化：将所有出口加入队列
  for (let x = 0; x < ROOM_SIZE; x++) {
    for (let y = 0; y < ROOM_SIZE; y++) {
      if (roomArray[x]?.[y] === EXIT) {
        exposedFrontier.push([x, y]);
        roomArray[x][y] = EXPOSED;
        explored[x][y] = true;
      }
    }
  }

  // BFS 标记所有暴露区域
  let exposedIndex = 0;
  while (exposedIndex < exposedFrontier.length) {
    const p = exposedFrontier[exposedIndex++];

    for (const [dx, dy] of SURROUND_OFFSETS) {
      const x = p[0] + dx;
      const y = p[1] + dy;

      if (x >= 0 && x < ROOM_SIZE && y >= 0 && y < ROOM_SIZE &&
          !explored[x][y] &&
          roomArray[x]?.[y] !== undefined &&
          roomArray[x][y] !== UNWALKABLE &&
          roomArray[x][y] !== RAMPART_MIN) {
        roomArray[x][y] = EXPOSED;
        exposedFrontier.push([x, y]);
        explored[x][y] = true;
      }
    }
  }

  // 创建成本矩阵：暴露区域设置为不可行走
  const costMatrix = new PathFinder.CostMatrix();
  for (let x = 0; x < ROOM_SIZE; x++) {
    for (let y = 0; y < ROOM_SIZE; y++) {
      if (roomArray[x]?.[y] === EXPOSED) {
        costMatrix.set(x, y, 0xff);
      }
    }
  }

  return [positions, costMatrix];
}

// ==================== 建筑布局规划相关 ====================

/**
 * 建筑布局定义
 */
export interface RoomLayout {
  spawn: [number, number][];
  extension: [number, number][];
  extractor: [number, number][];
  factory: [number, number][];
  lab: [number, number][];
  tower: [number, number][];
  link: [number, number][];
  nuker: [number, number][];
  observer: [number, number][];
  powerSpawn: [number, number][];
  storage: [number, number][];
  terminal: [number, number][];
  container: [number, number][];
  road: [number, number][];
}

/**
 * 建筑群定义（相对坐标）
 */
interface BuildingCluster {
  [structureType: string]: [number, number][];
}

// 存储建筑群：storage + link
const storageCluster: BuildingCluster = {
  [STRUCTURE_STORAGE]: [[0, 0]],
  [STRUCTURE_LINK]: [[0, 1]]
};

// 实验室建筑群：10 个 lab
const labCluster: BuildingCluster = {
  [STRUCTURE_LAB]: [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0], [0, 0], [1, 0],
    [-1, 1], [0, 1], [1, 1],
    [0, 2]
  ]
};

// 防御塔建筑群：3 个 tower
const towerCluster: BuildingCluster = {
  [STRUCTURE_TOWER]: [
    [-1, -1], [0, -1], [1, -1]
  ]
};

// 扩展建筑群：5 个 extension
const extensionCluster: BuildingCluster = {
  [STRUCTURE_EXTENSION]: [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0], [1, 0]
  ]
};

// 观察者建筑群：1 个 observer
const observerCluster: BuildingCluster = {
  [STRUCTURE_OBSERVER]: [[0, 0]]
};

/**
 * 初始化二维数组
 * @param defaultValue 默认值
 * @returns 50x50 的二维数组
 */
export function initArr<T>(defaultValue: T): T[][] {
  return Array(ROOM_SIZE).fill(0).map(() => Array(ROOM_SIZE).fill(defaultValue));
}

/**
 * 检查位置是否在墙壁或边缘（纯函数版本）
 */
export function isOnWallOrEdgePure(x: number, y: number, terrainData: TerrainData): boolean {
  if (x <= 0 || x >= ROOM_MAX_INDEX || y <= 0 || y >= ROOM_MAX_INDEX) {
    return true;
  }
  return terrainData.get(x, y) === TERRAIN_MASK_WALL;
}

/**
 * 检查位置是否靠近墙壁或边缘（纯函数版本）
 */
export function isNearWallOrEdgePure(x: number, y: number, terrainData: TerrainData): boolean {
  if (x <= 1 || x >= ROOM_MAX_INDEX - 1 || y <= 1 || y >= ROOM_MAX_INDEX - 1) {
    return true;
  }
  // 检查周围是否有墙壁
  for (const [dx, dy] of SURROUND_OFFSETS) {
    if (terrainData.get(x + dx, y + dy) === TERRAIN_MASK_WALL) {
      return true;
    }
  }
  return false;
}

/**
 * 检查位置是否在墙壁或边缘（包装函数）
 */
function isOnWallOrEdge(x: number, y: number, terrain: any): boolean {
  return isOnWallOrEdgePure(x, y, terrain);
}

/**
 * 检查位置是否靠近墙壁或边缘（包装函数）
 */
function isNearWallOrEdge(x: number, y: number, terrain: any): boolean {
  return isNearWallOrEdgePure(x, y, terrain);
}

/**
 * 使用 BFS 计算成本数组（距离越远成本越高，纯函数版本）
 * @param costArr 成本数组（会被修改）
 * @param startX 起始 X 坐标
 * @param startY 起始 Y 坐标
 * @param maxRange 最大范围
 * @param terrainData 地形数据
 */
export function getCostArrayPure(
  costArr: number[][],
  startX: number,
  startY: number,
  maxRange: number,
  terrainData: TerrainData
): void {
  const frontier: [number, number, number][] = [[startX, startY, 0]];
  let frontierIndex = 0;
  const explored = initArr(false);

  explored[startX][startY] = true;
  costArr[startX][startY] = 0;

  while (frontierIndex < frontier.length) {
    const [x, y, cost] = frontier[frontierIndex++];

    if (cost >= maxRange) continue;

    for (const [dx, dy] of SURROUND_OFFSETS) {
      const nx = x + dx;
      const ny = y + dy;

      if (nx >= 0 && nx < ROOM_SIZE && ny >= 0 && ny < ROOM_SIZE &&
          !explored[nx][ny] &&
          terrainData.get(nx, ny) !== TERRAIN_MASK_WALL) {
        explored[nx][ny] = true;
        const newCost = cost + 1;
        costArr[nx][ny] = newCost;
        if (newCost < maxRange) {
          frontier.push([nx, ny, newCost]);
        }
      }
    }
  }
}

/**
 * 使用 BFS 计算成本数组（包装函数，从游戏对象获取数据）
 */
function getCostArray(
  costArr: number[][],
  startX: number,
  startY: number,
  maxRange: number,
  roomname: string
): void {
  const terrain = new Room.Terrain(roomname);
  getCostArrayPure(costArr, startX, startY, maxRange, terrain);
}

/**
 * 检查是否可以放置建筑群（纯函数版本，不检查现有建筑）
 */
export function canPutPure(
  x: number,
  y: number,
  cluster: BuildingCluster,
  built: boolean[][],
  terrainData: TerrainData
): boolean {
  // 检查建筑群中每个位置
  for (const structureType in cluster) {
    const offsets = cluster[structureType];
    for (const [dx, dy] of offsets) {
      const nx = x + dx;
      const ny = y + dy;

      // 边界检查
      if (nx < 0 || nx >= ROOM_SIZE || ny < 0 || ny >= ROOM_SIZE) {
        return false;
      }

      // 检查是否已建造
      if (built[nx][ny]) {
        return false;
      }

      // 检查地形
      if (terrainData.get(nx, ny) === TERRAIN_MASK_WALL) {
        return false;
      }
    }
  }

  return true;
}

/**
 * 检查是否可以放置建筑群（包装函数，包含游戏对象检查）
 */
function canPut(
  x: number,
  y: number,
  cluster: BuildingCluster,
  built: boolean[][],
  room: Room,
  matrix: number[][],
  terrain: any
): boolean {
  // 先进行纯函数检查
  if (!canPutPure(x, y, cluster, built, terrain)) {
    return false;
  }

  // 检查是否有其他建筑（需要游戏对象）
  for (const structureType in cluster) {
    const offsets = cluster[structureType];
    for (const [dx, dy] of offsets) {
      const nx = x + dx;
      const ny = y + dy;
      const lookResult = room.lookAt(nx, ny);
      for (const obj of lookResult) {
        if (obj.type === LOOK_STRUCTURES || obj.type === LOOK_CONSTRUCTION_SITES) {
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * 放置建筑群
 */
export function put(
  x: number,
  y: number,
  layout: RoomLayout,
  cluster: BuildingCluster,
  built: boolean[][]
): void {
  for (const structureType in cluster) {
    const offsets = cluster[structureType];
    const layoutKey = structureType as keyof RoomLayout;

    if (!layout[layoutKey]) {
      layout[layoutKey] = [];
    }

    for (const [dx, dy] of offsets) {
      const nx = x + dx;
      const ny = y + dy;
      layout[layoutKey].push([nx, ny]);
      built[nx][ny] = true;
    }
  }
}

/**
 * 在成本矩阵中找到最小值位置（满足条件）
 */
export function findMin(
  matrix: number[][],
  predicate: (x: number, y: number) => boolean
): [number, number] {
  let minValue = Number.MAX_VALUE;
  let minX = 0;
  let minY = 0;

  for (let x = 0; x < ROOM_SIZE; x++) {
    for (let y = 0; y < ROOM_SIZE; y++) {
      const value = matrix[x]?.[y] ?? Number.MAX_VALUE;
      if (value < minValue && predicate(x, y)) {
        minValue = value;
        minX = x;
        minY = y;
      }
    }
  }

  return [minX, minY];
}

/**
 * 多个数组相加
 */
export function addArrays(...arrays: number[][][]): number[][] {
  const result = initArr(0);
  for (const arr of arrays) {
    for (let x = 0; x < ROOM_SIZE; x++) {
      for (let y = 0; y < ROOM_SIZE; y++) {
        result[x][y] += arr[x]?.[y] ?? 0;
      }
    }
  }
  return result;
}

/**
 * 数组乘以标量
 */
export function multiplyArray(arr: number[][], scalar: number): number[][] {
  const result = initArr(0);
  for (let x = 0; x < ROOM_SIZE; x++) {
    for (let y = 0; y < ROOM_SIZE; y++) {
      result[x][y] = (arr[x]?.[y] ?? 0) * scalar;
    }
  }
  return result;
}

/**
 * 序列化位置
 */
export function serialize(pos: RoomPosition): string {
  return `${pos.x},${pos.y}`;
}

/**
 * 生成房间的建筑布局
 * @param roomname 房间名称
 * @param sources 资源位置数组
 * @param mineral 矿物位置
 * @param controller 控制器位置
 * @param roomMemory 房间内存对象（会被修改）
 * @returns 建筑布局
 */
export function buildLayout(
  roomname: string,
  sources: { pos: { x: number; y: number } }[],
  mineral: { pos: { x: number; y: number } },
  controller: { pos: { x: number; y: number } },
  roomMemory: any
): RoomLayout {
  let result: RoomLayout = {
    spawn: [], extension: [], extractor: [], factory: [],
    lab: [], tower: [], link: [], nuker: [], observer: [],
    powerSpawn: [], storage: [], terminal: [], container: [], road: []
  };

  errorMapper(() => {
    const room = Game.rooms[roomname];
    if (!room) {
      console.log(`[autoPlanner] 错误：房间 ${roomname} 不存在`);
      result = {
        spawn: [], extension: [], extractor: [], factory: [],
        lab: [], tower: [], link: [], nuker: [], observer: [],
        powerSpawn: [], storage: [], terminal: [], container: [], road: []
      };
      return;
    }

    const layout: RoomLayout = {
      spawn: [],
      extension: [],
      extractor: [],
      factory: [],
      lab: [],
      tower: [],
      link: [],
      nuker: [],
      observer: [],
      powerSpawn: [],
      storage: [],
      terminal: [],
      container: [],
      road: []
    };

    const built = initArr(false);
    const sourceArr = initArr(0);
    const mineralArr = initArr(0);
    const controllerArr = initArr(0);
    const storageArr = initArr(0);

    // 计算资源成本数组
    for (const source of sources) {
      getCostArray(sourceArr, source.pos.x, source.pos.y, 3, roomname);
    }

    // 放置提取器
    layout.extractor.push([mineral.pos.x, mineral.pos.y]);
    getCostArray(mineralArr, mineral.pos.x, mineral.pos.y, 2, roomname);

    // 计算控制器成本数组
    getCostArray(controllerArr, controller.pos.x, controller.pos.y, 4, roomname);

    const terrain = new Room.Terrain(roomname);

    // 计算到墙壁的距离数组
    const wallArr = initArr(0);
    const wallFrontier: [number, number][] = [];
    const wallExplored = initArr(false);

    // 初始化：将所有墙壁和边缘位置加入队列
    for (let x = 0; x < ROOM_SIZE; x++) {
      for (let y = 0; y < ROOM_SIZE; y++) {
        if (isOnWallOrEdge(x, y, terrain)) {
          wallFrontier.push([x, y]);
          wallExplored[x][y] = true;
        }
      }
    }

    // BFS 计算到墙壁的距离
    let wallIndex = 0;
    while (wallIndex < wallFrontier.length) {
      const [x, y] = wallFrontier[wallIndex++];
      const neighbors: [number, number][] = [
        [x - 1, y - 1], [x - 1, y], [x - 1, y + 1],
        [x, y - 1], [x, y + 1],
        [x + 1, y - 1], [x + 1, y], [x + 1, y + 1]
      ];

      for (const [nx, ny] of neighbors) {
        if (nx > 0 && nx < ROOM_MAX_INDEX && ny > 0 && ny < ROOM_MAX_INDEX &&
            !wallExplored[nx][ny]) {
          wallArr[nx][ny] = (wallArr[x][y] + 10) * 0.75;
          wallFrontier.push([nx, ny]);
          wallExplored[nx][ny] = true;
        }
      }
    }

    // 找到存储位置
    let matrix = addArrays(
      sourceArr,
      multiplyArray(mineralArr, 0.25),
      controllerArr,
      multiplyArray(wallArr, -1)
    );

    let [x, y] = findMin(matrix, (x, y) => {
      return canPut(x, y, storageCluster, built, room, matrix, terrain);
    });

    getCostArray(storageArr, x, y, 0, roomname);
    put(x, y, layout, storageCluster, built);
    const storagePos = new RoomPosition(x, y, roomname);

    // 连接到存储的函数
    const connectToStorage = (targetX: number, targetY: number): void => {
      const position = new RoomPosition(targetX, targetY, roomname);
      const path = room.findPath(position, storagePos, {
        ignoreCreeps: true,
        ignoreDestructibleStructures: true,
        ignoreRoads: true,
        swampCost: 1,
        heuristicWeight: 1,
        range: 1
      });

      for (const p of path) {
        if (!built[p.x][p.y]) {
          layout.road.push([p.x, p.y]);
          built[p.x][p.y] = true;
        }
      }
    };

    // 找到实验室位置
    matrix = addArrays(
      mineralArr,
      multiplyArray(storageArr, 5),
      multiplyArray(sourceArr, 0.01),
      multiplyArray(controllerArr, 0.01)
    );

    [x, y] = findMin(matrix, (x, y) => {
      return canPut(x, y, labCluster, built, room, matrix, terrain);
    });

    put(x, y, layout, labCluster, built);
    const centers: [number, number][] = [[x, y]];

    // 防御塔矩阵
    const towerMatrix = addArrays(
      multiplyArray(mineralArr, 0.01),
      storageArr,
      multiplyArray(sourceArr, 0.01),
      multiplyArray(controllerArr, 0.01)
    );

    // 放置防御塔群
    const putTowerCluster = (): void => {
      [x, y] = findMin(towerMatrix, (x, y) => {
        return canPut(x, y, towerCluster, built, room, matrix, terrain);
      });
      centers.push([x, y]);
      put(x, y, layout, towerCluster, built);
    };

    // 扩展建筑矩阵
    const extensionMatrix = addArrays(
      multiplyArray(mineralArr, 0.01),
      multiplyArray(storageArr, 4),
      sourceArr,
      multiplyArray(controllerArr, 0.01)
    );

    // 放置扩展建筑群
    const putExtensionCluster = (): void => {
      [x, y] = findMin(extensionMatrix, (x, y) => {
        return canPut(x, y, extensionCluster, built, room, matrix, terrain);
      });
      centers.push([x, y]);
      put(x, y, layout, extensionCluster, built);
    };

    // 放置 6 组防御塔和扩展
    for (let i = 0; i < 6; i++) {
      putTowerCluster();
      putExtensionCluster();
    }

    // 放置观察者
    matrix = addArrays(
      multiplyArray(mineralArr, 0.01),
      storageArr,
      multiplyArray(sourceArr, 0.01),
      multiplyArray(controllerArr, 0.01)
    );

    [x, y] = findMin(matrix, (x, y) => {
      return canPut(x, y, observerCluster, built, room, matrix, terrain);
    });

    centers.push([x, y]);
    put(x, y, layout, observerCluster, built);

    // 连接所有建筑群到存储
    for (const center of centers) {
      connectToStorage(center[0], center[1]);
    }

    // 放置容器和链接
    const placeContainer = (target: { pos: { x: number; y: number } }): void => {
      const range = target === controller ? 3 : 1;
      const targetPos = new RoomPosition(target.pos.x, target.pos.y, roomname);
      const path = room.findPath(storagePos, targetPos, {
        ignoreCreeps: true,
        ignoreDestructibleStructures: true,
        ignoreRoads: true,
        swampCost: 1,
        heuristicWeight: 1,
        range
      });

      // 放置道路
      for (let i = 0; i < path.length - 1; i++) {
        if (!built[path[i].x][path[i].y]) {
          layout.road.push([path[i].x, path[i].y]);
          built[path[i].x][path[i].y] = true;
        }
      }

      // 放置容器
      const containerPos = path[path.length - 1];
      layout.container.push([containerPos.x, containerPos.y]);
      built[containerPos.x][containerPos.y] = true;

      // 保存容器位置到内存
      const targetId = (target as any).id;
      if (targetId) {
        if (!roomMemory[targetId]) {
          roomMemory[targetId] = {};
        }
        roomMemory[targetId].containerPos = serialize(new RoomPosition(containerPos.x, containerPos.y, roomname));
      }

      // 如果是矿物，不需要链接
      if (target === mineral) {
        return;
      }

      // 尝试放置链接（优先不在墙壁附近）
      let linkBuilt = false;
      for (const [dx, dy] of SURROUND_OFFSETS) {
        const lx = containerPos.x + dx;
        const ly = containerPos.y + dy;
        if (!isNearWallOrEdge(lx, ly, terrain) && !built[lx][ly]) {
          layout.link.push([lx, ly]);
          if (targetId && roomMemory[targetId]) {
            roomMemory[targetId].linkPos = serialize(new RoomPosition(lx, ly, roomname));
          }
          linkBuilt = true;
          break;
        }
      }

      // 如果第一次尝试失败，放宽条件
      if (!linkBuilt) {
        for (const [dx, dy] of SURROUND_OFFSETS) {
          const lx = containerPos.x + dx;
          const ly = containerPos.y + dy;
          if (!isOnWallOrEdge(lx, ly, terrain) && !built[lx][ly]) {
            layout.link.push([lx, ly]);
            if (targetId && roomMemory[targetId]) {
              roomMemory[targetId].linkPos = serialize(new RoomPosition(lx, ly, roomname));
            }
            linkBuilt = true;
            break;
          }
        }
      }
    };

    placeContainer(controller);
    for (const source of sources) {
      placeContainer(source);
    }
    placeContainer(mineral);

    result = layout;
  });

  return result;
}
