import { describe, expect, it } from "vitest";
import { seatPlacement, SEAT_SLOT_CLASS } from "./layout";

describe("seatPlacement", () => {
  it("puts a single bot at the top of the ring", () => {
    expect(seatPlacement(0, 1)).toBe("top");
  });

  it("puts two bots on the left and right", () => {
    expect(seatPlacement(0, 2)).toBe("left");
    expect(seatPlacement(1, 2)).toBe("right");
  });

  it("puts three bots left, top, right in clockwise turn order", () => {
    expect(seatPlacement(0, 3)).toBe("left");
    expect(seatPlacement(1, 3)).toBe("top");
    expect(seatPlacement(2, 3)).toBe("right");
  });

  it("clamps unexpected counts and indices to a valid seat", () => {
    expect(seatPlacement(0, 0)).toBe("top");
    expect(seatPlacement(99, 3)).toBe("right");
    expect(seatPlacement(-1, 3)).toBe("left");
  });

  it("gives every slot a desktop grid placement", () => {
    expect(SEAT_SLOT_CLASS.left).toContain("lg:col-start-1");
    expect(SEAT_SLOT_CLASS.top).toContain("lg:col-start-2");
    expect(SEAT_SLOT_CLASS.right).toContain("lg:col-start-3");
  });
});
