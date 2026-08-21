import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// With `globals: false`, React Testing Library can't auto-register cleanup,
// so unmount each rendered tree to keep tests isolated.
afterEach(() => {
  cleanup();
});