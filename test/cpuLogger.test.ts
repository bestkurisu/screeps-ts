import { describe, it, expect, beforeEach, vi } from "vitest";
import { collectCost, switchShowCost, SHOW_BASE_CPU_COST, showCpuCost } from "@/utils/framework/cpuLogger";

describe("cpuLogger", () => {
  beforeEach(() => {
    // 重置 showCpuCost 状态
    switchShowCost();
  });

  describe("collectCost", () => {
    it("应该执行函数并返回结果", () => {
      const testFunc = vi.fn(() => 42);
      const result = collectCost("test", "base", testFunc);

      expect(result).toBe(42);
      expect(testFunc).toHaveBeenCalledTimes(1);
    });

    it("应该传递参数给函数", () => {
      const testFunc = vi.fn((a: number, b: number) => a + b);
      const result = collectCost("test", "base", testFunc, 1, 2);

      expect(result).toBe(3);
      expect(testFunc).toHaveBeenCalledWith(1, 2);
    });

    it("当 showCpuCost 不匹配时不应该输出日志", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      switchShowCost("other");

      collectCost("test", "base", () => {});

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("switchShowCost", () => {
    it("应该切换 showCpuCost 状态", () => {
      expect(switchShowCost("base")).toBe("base");
      expect(switchShowCost("base")).toBe(false);
      expect(switchShowCost("base")).toBe("base");
    });

    it("当传入 undefined 时应该关闭", () => {
      switchShowCost("base");
      expect(switchShowCost()).toBe(false);
    });
  });
});

