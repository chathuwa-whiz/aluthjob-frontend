import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { polling } from "../api/queries";

// follow progress quickly so tests do not wait whole seconds between updates
polling.ms = 15;

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});
