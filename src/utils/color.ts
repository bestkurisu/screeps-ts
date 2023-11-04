export enum Color {
  Red = 1,
  Green,
  Yellow,
  Blue,
  Gray
}

/**
 * 在绘制控制台信息时使用的颜色
 */
export const COLOR_VALUE: { [name in Color]: string } = {
  [Color.Red]: "#ef9a9a",
  [Color.Green]: "#6b9955",
  [Color.Yellow]: "#c5c599",
  [Color.Blue]: "#8dc5e3",
  [Color.Gray]: "#cccccc"
};
export const colorful = function (content: string | number, colorName: Color | null, bold = false): string {
  const colorStyle = colorName ? `color: ${COLOR_VALUE[colorName]};` : "";
  const boldStyle = bold ? "font-weight: bold;" : "";

  return `<text style="${[colorStyle, boldStyle].join(" ")}">${content}</text>`;
};
export const green = (content: string | number, bold?: boolean) => colorful(content, Color.Green, bold);
export const red = (content: string | number, bold?: boolean) => colorful(content, Color.Red, bold);
export const yellow = (content: string | number, bold?: boolean) => colorful(content, Color.Yellow, bold);
export const blue = (content: string | number, bold?: boolean) => colorful(content, Color.Blue, bold);
export const grey = (content: string | number, bold?: boolean) => colorful(content, Color.Gray, bold);
export const bold = (content: string | number) => colorful(content, null, true);
