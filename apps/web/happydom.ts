// Preload `bun test` (cf. bunfig.toml [test].preload) — enregistre happy-dom
// pour exposer document/window/etc. dans le scope global (tests DOM/composants).
// https://bun.com/docs/test/dom
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
