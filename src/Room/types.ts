import { CreepRole } from "@/Creep/types";

declare global {
  interface Room {
    myOwned: () => boolean; // 是否是我拥有的房间
    countRole: (role?: CreepRole) => number; // 统计房间内角色数量
    roles: { [role in CreepRole]: number }; // 房间内角色数组
    cpuUsed: number; // 房间内 cpu 使用量
  }

  interface RoomMemory {
    sites: number; // 房间内建造工地数量
  }
}
