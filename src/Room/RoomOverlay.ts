import { CreepRole } from "@/Creep/types";
import { Color, COLOR_VALUE } from "@/utils/color";

const COLOR = COLOR_VALUE[Color.Gray];
const TEXT_SIZE = 0.8;
const CHAR_WIDTH = TEXT_SIZE * 0.4;
const CHAR_HEIGHT = TEXT_SIZE * 0.9;

const defTextStyle: TextStyle = {
  font: TEXT_SIZE,
  color: COLOR,
  opacity: 0.8,
  align: "left"
};

export class RoomOverlay {
  universalOverlay() {
    let rv = new RoomVisual();
    // show bucket, gcl, gpl
    rv.text("BKT", 1, 2, defTextStyle);
    barGraph(rv, Game.cpu.bucket / 10000, 4.5, 2);
    rv.text(`${Game.cpu.bucket} / 10000`, 16.5, 2, defTextStyle);

    rv.text("GCL", 1, 3, defTextStyle);
    barGraph(rv, Game.gcl.progress / Game.gcl.progressTotal, 4.5, 3);
    rv.text(`level: ${Game.gcl.level}`, 12.5, 3, defTextStyle);
    rv.text(formattedProgress(Game.gcl.progress, Game.gcl.progressTotal), 16.5, 3, defTextStyle);

    rv.text("GPL", 1, 4, defTextStyle);
    barGraph(rv, Game.gpl.progress / Game.gpl.progressTotal, 4.5, 4);
    rv.text(`level: ${Game.gpl.level}`, 12.5, 4, defTextStyle);
    rv.text(formattedProgress(Game.gpl.progress, Game.gpl.progressTotal), 16.5, 4, defTextStyle);
  }

  roomOverlay(room: Room) {
    let rv = new RoomVisual(room.name);
    if (room.myOwned()) {
      rv.text("RCL", 1, 6, defTextStyle);
      barGraph(
        rv,
        room.controller!.level === 8 ? 1 : room.controller!.progress / room.controller!.progressTotal,
        4.5,
        6
      );
      rv.text(`level: ${room.controller!.level}`, 12.5, 6, defTextStyle);
      rv.text(formattedProgress(room.controller!.progress, room.controller!.progressTotal), 16.5, 6, defTextStyle);
      let s = section(rv, 1, 8, 10, `Room Stats: ${room.name}`).text("Creeps", room.countRole().toString());
      for (let role in room.roles) {
        if (room.roles[role as CreepRole] > 0) s.text("    " + role, room.roles[role as CreepRole]);
      }
      s.text("Sites", room.memory.sites);
      s.text("CPU", _.round(room.cpuUsed, 2)).show();
    }
  }

  run() {
    this.universalOverlay();
    for (let name in Game.rooms) {
      this.roomOverlay(Game.rooms[name]);
    }
  }
}

/**
 * 画横向柱状图
 * @param rv {RoomVisual}
 * @param progress {number} 进度百分比
 * @param x {number} 起始点x坐标
 * @param y {number} 起始点y坐标
 * @param width {number} 宽度
 * @param scale {number} 缩放比例
 */
function barGraph(rv: RoomVisual, progress: number, x: number, y: number, width: number = 7, scale: number = 1) {
  let text = _.round(100 * progress, 2) + "%";
  // box around stat
  rv.rect(x, y - CHAR_HEIGHT * scale, width, 1.1 * scale * CHAR_HEIGHT, {
    stroke: COLOR,
    fill: "transparent"
  });
  rv.rect(x, y - CHAR_HEIGHT * scale, progress * width, 1.1 * scale * CHAR_HEIGHT, {
    stroke: "transparent",
    fill: COLOR,
    opacity: 0.3
  });
  rv.text(text, x + width / 2, y - 0.1 * CHAR_HEIGHT, {
    font: TEXT_SIZE,
    align: "center",
    color: COLOR,
    opacity: 0.8
  });
}

/**
 * 格式化进度条
 * @param progress 当前进度
 * @param progressTotal 总进度
 */
function formattedProgress(progress: number, progressTotal: number) {
  let unit = "";
  let rounding = 2;
  if (progressTotal > 1000000000) {
    progressTotal /= 1000000000;
    progress /= 1000000000;
    unit = "B";
    rounding = 3;
  } else if (progressTotal > 1000000) {
    progressTotal /= 1000000;
    progress /= 1000000;
    unit = "M";
    rounding = 3;
  } else if (progressTotal > 10000) {
    progressTotal /= 1000;
    progress /= 1000;
    unit = "K";
    rounding = 3;
  }
  progressTotal = _.round(progressTotal, rounding);
  progress = _.round(progress, rounding);
  return `${progress}${unit} / ${progressTotal}${unit}`;
}

function section(rv: RoomVisual, x: number, y: number, width: number, name: string) {
  let iy = y;
  let height = 0;
  rv.text(name, x + CHAR_WIDTH, y + 0.1 * CHAR_HEIGHT, defTextStyle);
  y++;
  height++;

  function text(title: string, content: string) {
    rv.text(title + ":", x + CHAR_WIDTH, y, defTextStyle);
    rv.text(content, x + width - CHAR_WIDTH, y, {
      font: TEXT_SIZE,
      color: COLOR,
      opacity: 0.8,
      align: "right"
    });
    y++;
    height++;
    return this;
  }

  function show() {
    rv.rect(x, iy - CHAR_HEIGHT, width, height, {
      stroke: COLOR,
      fill: "transparent",
      opacity: 0.8
    });
    rv.rect(x, iy - CHAR_HEIGHT, width, 1, {
      stroke: "transparent",
      fill: COLOR,
      opacity: 0.3
    });
  }

  return { text, show };
}
