import { setupVerdaccio, teardownVerdaccio } from "../helpers/verdaccio.js";

export async function runVerdaccio() {
  return await setupVerdaccio();
}

export async function stopVerdaccio() {
  await teardownVerdaccio();
}
