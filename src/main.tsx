import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { LoadingScreen } from "./components/LoadingScreen";
import { NativeConfigurationGate } from "./components/NativeConfigurationGate";
import { nativeConfigurationError } from "./lib/nativeRuntime";
import { isNativeApp } from "./lib/nativePlatform";
const AppRoot = lazy(() => import("./components/AppRoot"));
import { AppErrorBoundary } from "./components/AppErrorBoundary";

import { release } from "./lib/release";
import "./styles.css";
import "./native/native.css";
import { watchNativeAppearance } from "./native/nativeAppearance";

if (isNativeApp()) document.documentElement.dataset.native = "ios";

if (isNativeApp()) {
  watchNativeAppearance();
} else {
const savedTheme = localStorage.getItem("roadshow-theme") || "light";
const initialDark = savedTheme === "dark" || (savedTheme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
document.documentElement.dataset.theme = initialDark ? "dark" : "light";
document.documentElement.dataset.accent = localStorage.getItem("roadshow-color-scheme") || "forest";
}
document.title = `Roadshow Driver · ${release.label} ${release.version}`;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <NativeConfigurationGate error={nativeConfigurationError}><Suspense fallback={<LoadingScreen label="Opening app…" />}><AppRoot /></Suspense></NativeConfigurationGate>
    </AppErrorBoundary>
  </StrictMode>,
);
