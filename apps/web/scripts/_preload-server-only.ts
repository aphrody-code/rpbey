import { plugin } from "bun";
plugin({
  name: "server-only-stub",
  setup(build) {
    build.module("server-only", () => ({ exports: {}, loader: "object" }));
  },
});
