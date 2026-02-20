import fs from "fs";
import path from "path";
import { AudioAssets, CLASS_APPEARANCE, NPC_APPEARANCE, ITEMS } from "./packages/shared/src/index";

// Configuration
const PUBLIC_DIR = "apps/client/public";
const GRAFICOS_DIR = path.join(PUBLIC_DIR, "graficos");
const AUDIO_DIR = path.join(PUBLIC_DIR, "audio");
const INDICES_DIR = path.join(PUBLIC_DIR, "indices");
const UNUSED_DIR = "unused_assets";

const PRELOADER_PATH = "apps/client/src/scenes/PreloaderScene.ts";
const SOUND_MANAGER_PATH = "apps/client/src/assets/SoundManager.ts";

const IS_CLEANUP = process.argv.includes("--cleanup");

// --- Helper Types ---

interface StaticGrh {
  id: number;
  grafico: number;
}

interface AnimGrh {
  id: number;
  frames: number[];
}

type GrhEntry = StaticGrh | AnimGrh | 0;

interface DirectionEntry {
  id: number;
  down: number;
  up: number;
  left: number;
  right: number;
}

interface BodyEntry extends DirectionEntry {
  offHeadX: number;
  offHeadY: number;
}

interface FxEntry {
  id: number;
  animacion: number;
}

type IndexEntry = DirectionEntry | BodyEntry | FxEntry | 0;

// --- Logic ---

async function main() {
  console.log("🔍 Starting Asset Verification...");

  const usedPngs = new Set<number>();
  const usedAudio = new Set<string>();

  // 1. Gather Graphics needed from indices and shared config
  const graficosIdx: GrhEntry[] = JSON.parse(fs.readFileSync(path.join(INDICES_DIR, "graficos.json"), "utf8"));
  const cuerposIdx: IndexEntry[] = JSON.parse(fs.readFileSync(path.join(INDICES_DIR, "cuerpos.json"), "utf8"));
  const cabezasIdx: IndexEntry[] = JSON.parse(fs.readFileSync(path.join(INDICES_DIR, "cabezas.json"), "utf8"));
  const armasIdx: IndexEntry[] = JSON.parse(fs.readFileSync(path.join(INDICES_DIR, "armas.json"), "utf8"));
  const escudosIdx: IndexEntry[] = JSON.parse(fs.readFileSync(path.join(INDICES_DIR, "escudos.json"), "utf8"));
  const cascosIdx: IndexEntry[] = JSON.parse(fs.readFileSync(path.join(INDICES_DIR, "cascos.json"), "utf8"));
  const fxsIdx: IndexEntry[] = JSON.parse(fs.readFileSync(path.join(INDICES_DIR, "fxs.json"), "utf8"));

  const visitedGrh = new Set<number>();

  function traceGrh(grhId: number) {
    if (!grhId || visitedGrh.has(grhId)) return;
    visitedGrh.add(grhId);
    const entry = graficosIdx[grhId];
    if (!entry) return;
    if ("grafico" in entry) {
      usedPngs.add((entry as StaticGrh).grafico);
    } else if ("frames" in entry) {
      for (const fid of (entry as AnimGrh).frames) traceGrh(fid);
    }
  }

  function traceDirectionEntry(entry: IndexEntry | null) {
    if (!entry || typeof entry === "number") return;
    if ("down" in entry) {
      traceGrh(entry.down);
      traceGrh(entry.up);
      traceGrh(entry.left);
      traceGrh(entry.right);
    }
  }

  // From Shared Config
  for (const cls of Object.values(CLASS_APPEARANCE)) {
    traceDirectionEntry(cuerposIdx[cls.bodyId]);
    traceDirectionEntry(cabezasIdx[cls.headId]);
  }
  for (const npc of Object.values(NPC_APPEARANCE)) {
    traceDirectionEntry(cuerposIdx[npc.bodyId]);
    if (npc.headId) traceDirectionEntry(cabezasIdx[npc.headId]);
  }
  for (const item of Object.values(ITEMS)) {
    if (item.aoWeaponId) traceDirectionEntry(armasIdx[item.aoWeaponId]);
    if (item.aoShieldId) traceDirectionEntry(escudosIdx[item.aoShieldId]);
    if (item.aoHelmetId) traceDirectionEntry(cascosIdx[item.aoHelmetId]);
  }
  // All FXs are currently loaded in Preloader
  for (let i = 1; i < fxsIdx.length; i++) {
    const fx = fxsIdx[i];
    if (fx && typeof fx === "object" && "animacion" in fx) {
      traceGrh(fx.animacion);
    }
  }

  console.log(`✓ Identified ${usedPngs.size} required graphics.`);

  // 2. Gather Audio needed from the AudioAssets manifest
  // All files in the manifest are loaded by PreloaderScene via Object.entries(AudioAssets)
  for (const audioPath of Object.values(AudioAssets)) {
    usedAudio.add(audioPath as string);
  }

  console.log(`✓ Identified ${usedAudio.size} required audio files.`);

  // 3. Verify Files exist & Identify Unused
  let missingCount = 0;
  let unusedCount = 0;

  // Graphics
  const allGraficos = fs.readdirSync(GRAFICOS_DIR).filter(f => f.endsWith(".webp"));
  for (const pngNum of usedPngs) {
    const filename = `${pngNum}.webp`;
    if (!fs.existsSync(path.join(GRAFICOS_DIR, filename))) {
      console.error(`❌ MISSING GRAPHIC: ${filename}`);
      missingCount++;
    }
  }

  const unusedGraficos = allGraficos.filter(f => {
    const num = parseInt(path.parse(f).name);
    return !usedPngs.has(num);
  });

  // Audio
  for (const audioPath of usedAudio) {
    if (!fs.existsSync(path.join(PUBLIC_DIR, audioPath))) {
      console.error(`❌ MISSING AUDIO: ${audioPath}`);
      missingCount++;
    }
  }

  // Recursive readdir for audio
  function getFiles(dir: string, base: string = ""): string[] {
    const results: string[] = [];
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const relativePath = path.join(base, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results.push(...getFiles(fullPath, relativePath));
      } else {
        results.push(relativePath);
      }
    }
    return results;
  }

  const allAudio = getFiles(AUDIO_DIR, "audio");
  const unusedAudio = allAudio.filter(f => !usedAudio.has(f));

  console.log("");
  console.log(`Summary:`);
  console.log(`- Missing: ${missingCount}`);
  console.log(`- Unused Graphics: ${unusedGraficos.length}`);
  console.log(`- Unused Audio: ${unusedAudio.length}`);

  if (IS_CLEANUP) {
    console.log(`\n🧹 Cleaning up...`);
    
    if (!fs.existsSync(UNUSED_DIR)) fs.mkdirSync(UNUSED_DIR);

    // Move Unused Graphics
    const unusedGraficosDir = path.join(UNUSED_DIR, "graficos");
    if (!fs.existsSync(unusedGraficosDir)) fs.mkdirSync(unusedGraficosDir);
    for (const f of unusedGraficos) {
      fs.renameSync(path.join(GRAFICOS_DIR, f), path.join(unusedGraficosDir, f));
    }

    // Move Unused Audio
    const unusedAudioDir = path.join(UNUSED_DIR, "audio");
    if (!fs.existsSync(unusedAudioDir)) fs.mkdirSync(unusedAudioDir);
    for (const f of unusedAudio) {
      const targetPath = path.join(UNUSED_DIR, f);
      const targetDir = path.dirname(targetPath);
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      fs.renameSync(path.join(PUBLIC_DIR, f), targetPath);
    }

    console.log(`✓ Moved unused assets to ${UNUSED_DIR}/`);
  }

  if (missingCount > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
