// Entry-punkt for den FRITTSTÅENDE dxf-viewer-worker-bunten (bygges av
// scripts/build-dxf-worker.mjs via esbuild — IKKE del av Next sin webpack-graf,
// se DxfViewerTegning.tsx for hvorfor). Biblioteket krever at worker-skriptet
// kaller SetupWorker() øverst og ikke gjør noe annet (DxfViewer.js:863).
import { DxfViewer } from "dxf-viewer";

DxfViewer.SetupWorker();
