/**
 * Point d'entrée du client Discord Activity gacha.
 * Monte l'Application PixiJS dans #app et lance le flux d'auth + room.
 */
import { GachaApp } from "./app";

const mount = document.getElementById("app");
if (!mount) {
  throw new Error("#app introuvable");
}

const app = new GachaApp();
void app.start(mount).catch((err: unknown) => {
  console.error("[gacha-client] boot échoué", err);
  const boot = document.getElementById("boot");
  if (boot) boot.querySelector("span")!.textContent = "Échec du chargement";
});
