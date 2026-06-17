/* Topic: Components | Subtopic: Functional Components
   Topic: JSX | Subtopic: JSX Basics and Conditional Rendering
   Topic: Hooks | Subtopic: useState, useEffect, useRef, useMemo, useContext
   Topic: State Management | Subtopic: useReducer and Context API
   Topic: Styling | Subtopic: Shortest-Arc Kinematic Angular Coordinate Mapping */
import React, {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import styles from "./App.module.css";

const STORAGE_KEY = "motion-calibration-sandbox-v8";
const TelemetryContext = createContext(null);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const formatAxis = (value) => (Number.isFinite(value) ? value : 0).toFixed(1);

const wrapDelta = (diff) => {
  let d = diff;
  while (d <= -180) d += 360;
  while (d > 180) d -= 360;
  return d;
};

const initialSettings = {
  permission: "idle",
  sensorSupport: "unknown",
  orientation: "portrait",
  filterType: "smoothed",
  controlMode: "sliders",
  bias: { alpha: 0, beta: 0, gamma: 0 },
  manual: { alpha: 0, beta: 0, gamma: 0 },
};

const initialTelemetry = {
  source: "Waiting for connection",
  raw: { alpha: 0, beta: 0, gamma: 0, accX: 0, accY: 0, accZ: 0 },
  calibrated: { alpha: 0, beta: 0, gamma: 0 },
  filtered: { pitch: 0, roll: 0, yaw: 0 },
  status: "Awaiting selection",
  csvRows: [],
};

function loadSettings() {
  if (typeof window === "undefined") return initialSettings;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return initialSettings;
    const parsed = JSON.parse(saved);
    return { ...initialSettings, ...parsed };
  } catch {
    return initialSettings;
  }
}

function reducer(state, action) {
  switch (action.type) {
    case "SET_PERMISSION":
      return { ...state, permission: action.payload };
    case "SET_SUPPORT":
      return { ...state, sensorSupport: action.payload };
    case "SET_ORIENTATION":
      return { ...state, orientation: action.payload };
    case "SET_FILTER_TYPE":
      return { ...state, filterType: action.payload };
    case "SET_CONTROL_MODE":
      return { ...state, controlMode: action.payload };
    case "SET_BIAS":
      return { ...state, bias: action.payload };
    case "SET_MANUAL_ALL":
      return { ...state, manual: { ...action.payload } };
    case "RESET_CALIBRATION":
      return { ...state, bias: { alpha: 0, beta: 0, gamma: 0 } };
    case "RESET_SETTINGS":
      return initialSettings;
    default:
      return state;
  }
}

function useTelemetryStore() {
  const [settings, dispatch] = useReducer(reducer, undefined, loadSettings);
  const [telemetry, setTelemetry] = useState(initialTelemetry);

  const chassisRef = useRef(null);
  const pitchTextRef = useRef(null);
  const rollTextRef = useRef(null);
  const yawTextRef = useRef(null);

  const alphaInputRef = useRef(null);
  const betaInputRef = useRef(null);
  const gammaInputRef = useRef(null);
  const alphaValRef = useRef(null);
  const betaValRef = useRef(null);
  const gammaValRef = useRef(null);

  const refs = useMemo(
    () => ({
      chassisRef,
      pitchTextRef,
      rollTextRef,
      yawTextRef,
      alphaInputRef,
      betaInputRef,
      gammaInputRef,
      alphaValRef,
      betaValRef,
      gammaValRef,
    }),
    [],
  );

  const dragManualRef = useRef({
    alpha: settings.manual.alpha,
    beta: settings.manual.beta,
    gamma: settings.manual.gamma,
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const commitManualState = useCallback(() => {
    dispatch({ type: "SET_MANUAL_ALL", payload: { ...dragManualRef.current } });
  }, []);

  const liveRef = useRef({
    alpha: 0,
    beta: 0,
    gamma: 0,
    accX: 0,
    accY: 0,
    accZ: 0,
  });
  const filterRef = useRef({ pitch: 0, roll: 0, yaw: 0 });

  const historyRef = useRef([]);
  const lastLoggedValuesRef = useRef({ pitch: 999, roll: 999, yaw: 999 });
  const lastHistoryLogTimeRef = useRef(0);

  useEffect(() => {
    const updateOrientation = () => {
      const landscape = window.innerWidth > window.innerHeight;
      dispatch({
        type: "SET_ORIENTATION",
        payload: landscape ? "landscape" : "portrait",
      });
    };
    updateOrientation();
    window.addEventListener("resize", updateOrientation);
    window.addEventListener("orientationchange", updateOrientation);
    return () => {
      window.removeEventListener("resize", updateOrientation);
      window.removeEventListener("orientationchange", updateOrientation);
    };
  }, []);

  useEffect(() => {
    const support =
      typeof window !== "undefined" &&
      ("DeviceOrientationEvent" in window || "DeviceMotionEvent" in window);
    dispatch({
      type: "SET_SUPPORT",
      payload: support ? "supported" : "unsupported",
    });
  }, []);

  const requestPermission = useCallback(async () => {
    try {
      const orientationCtor = window.DeviceOrientationEvent;
      if (orientationCtor?.requestPermission) {
        const result = await orientationCtor.requestPermission();
        dispatch({ type: "SET_PERMISSION", payload: result });
        if (result === "granted")
          dispatch({ type: "SET_CONTROL_MODE", payload: "hardware" });
      } else {
        dispatch({ type: "SET_PERMISSION", payload: "granted" });
        dispatch({ type: "SET_CONTROL_MODE", payload: "hardware" });
      }
    } catch {
      dispatch({ type: "SET_PERMISSION", payload: "denied" });
    }
  }, []);

  const zeroCalibrate = useCallback(async () => {
    const samples = [];
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => window.requestAnimationFrame(r));
      samples.push({
        alpha: liveRef.current.alpha,
        beta: liveRef.current.beta,
        gamma: liveRef.current.gamma,
      });
    }
    const sum = samples.reduce(
      (acc, s) => ({
        alpha: acc.alpha + s.alpha,
        beta: acc.beta + s.beta,
        gamma: acc.gamma + s.gamma,
      }),
      { alpha: 0, beta: 0, gamma: 0 },
    );
    dispatch({
      type: "SET_BIAS",
      payload: {
        alpha: sum.alpha / samples.length,
        beta: sum.beta / samples.length,
        gamma: sum.gamma / samples.length,
      },
    });
  }, []);

  const exportCsv = useCallback(() => {
    const rows = historyRef.current;
    if (!rows.length) return;
    const header = [
      "timestamp",
      "alpha",
      "beta",
      "gamma",
      "pitch",
      "roll",
      "yaw",
    ];
    const csv = [header.join(",")]
      .concat(
        rows.map((r) =>
          [r.time, r.alpha, r.beta, r.gamma, r.pitch, r.roll, r.yaw].join(","),
        ),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "telemetry-log.csv";
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    if (settings.permission !== "granted") return undefined;
    const handleOrientation = (e) => {
      if (Number.isFinite(e.alpha)) liveRef.current.alpha = e.alpha;
      if (Number.isFinite(e.beta)) liveRef.current.beta = e.beta;
      if (Number.isFinite(e.gamma)) liveRef.current.gamma = e.gamma;
    };
    const handleMotion = (e) => {
      const acc = e.accelerationIncludingGravity || e.acceleration || {};
      if (Number.isFinite(acc.x)) liveRef.current.accX = acc.x;
      if (Number.isFinite(acc.y)) liveRef.current.accY = acc.y;
      if (Number.isFinite(acc.z)) liveRef.current.accZ = acc.z;
    };
    window.addEventListener("deviceorientation", handleOrientation, true);
    window.addEventListener("devicemotion", handleMotion, true);
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation, true);
      window.removeEventListener("devicemotion", handleMotion, true);
    };
  }, [settings.permission]);

  useEffect(() => {
    let frameId;
    let lastRenderFlush = 0;
    const renderThrottleInterval = 33; // ~30 FPS state update rate to protect CPU metrics

    const loop = (now) => {
      const cfg = settingsRef.current;
      const live = liveRef.current;

      const useHardware =
        cfg.controlMode === "hardware" && cfg.permission === "granted";

      let sourceAlpha = useHardware ? live.alpha : dragManualRef.current.alpha;
      let sourceBeta = useHardware ? live.beta : dragManualRef.current.beta;
      let sourceGamma = useHardware ? live.gamma : dragManualRef.current.gamma;

      const calibrated = {
        alpha: sourceAlpha - cfg.bias.alpha,
        beta: sourceBeta - cfg.bias.beta,
        gamma: sourceGamma - cfg.bias.gamma,
      };

      const k = cfg.filterType === "smoothed" ? 0.82 : 0;

      let deltaPitch = wrapDelta(calibrated.beta - filterRef.current.pitch);
      let deltaRoll = wrapDelta(calibrated.gamma - filterRef.current.roll);
      let deltaYaw = wrapDelta(calibrated.alpha - filterRef.current.yaw);

      const nextPitch = filterRef.current.pitch + (1 - k) * deltaPitch;
      const nextRoll = filterRef.current.roll + (1 - k) * deltaRoll;
      const nextYaw = filterRef.current.yaw + (1 - k) * deltaYaw;

      filterRef.current = { pitch: nextPitch, roll: nextRoll, yaw: nextYaw };

      // Fixed vertical tracking configuration matching user physical gesture intents
      const finalPitch = -nextPitch;
      const finalRoll = nextRoll;
      const finalYaw = nextYaw;

      // Real-time direct CSS manipulation (0% React rendering overhead)
      if (chassisRef.current) {
        chassisRef.current.style.transform = `rotateX(${finalPitch}deg) rotateY(${finalRoll}deg) rotateZ(${-finalYaw}deg)`;
      }
      if (pitchTextRef.current)
        pitchTextRef.current.innerText = (-finalPitch).toFixed(1) + "°";
      if (rollTextRef.current)
        rollTextRef.current.innerText = finalRoll.toFixed(1) + "°";
      if (yawTextRef.current)
        yawTextRef.current.innerText = finalYaw.toFixed(1) + "°";

      if (alphaInputRef.current) alphaInputRef.current.value = sourceAlpha;
      if (betaInputRef.current) betaInputRef.current.value = sourceBeta;
      if (gammaInputRef.current) gammaInputRef.current.value = sourceGamma;

      if (alphaValRef.current)
        alphaValRef.current.innerText = sourceAlpha.toFixed(0) + "°";
      if (betaValRef.current)
        betaValRef.current.innerText = sourceBeta.toFixed(0) + "°";
      if (gammaValRef.current)
        gammaValRef.current.innerText = sourceGamma.toFixed(0) + "°";

      // Movement-driven delta tracking loop
      const movementDelta =
        Math.abs(finalPitch - lastLoggedValuesRef.current.pitch) +
        Math.abs(finalRoll - lastLoggedValuesRef.current.roll) +
        Math.abs(finalYaw - lastLoggedValuesRef.current.yaw);

      if (movementDelta > 0.15 && now - lastHistoryLogTimeRef.current > 60) {
        lastHistoryLogTimeRef.current = now;
        lastLoggedValuesRef.current = {
          pitch: finalPitch,
          roll: finalRoll,
          yaw: finalYaw,
        };

        const msString = String(Math.floor(performance.now() % 1000)).padStart(
          3,
          "0",
        );
        const timestampWithMs =
          new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }) +
          "." +
          msString;

        const newEntry = {
          time: timestampWithMs,
          alpha: formatAxis(calibrated.alpha),
          beta: formatAxis(calibrated.beta),
          gamma: formatAxis(calibrated.gamma),
          pitch: formatAxis(-finalPitch),
          roll: formatAxis(finalRoll),
          yaw: formatAxis(finalYaw),
        };
        historyRef.current = [newEntry, ...historyRef.current].slice(0, 40);
      }

      if (now - lastRenderFlush >= renderThrottleInterval) {
        lastRenderFlush = now;
        setTelemetry({
          source: useHardware
            ? "Hardware Sensors"
            : "Desktop Sliders Simulation",
          raw: {
            alpha: sourceAlpha,
            beta: sourceBeta,
            gamma: sourceGamma,
            accX: live.accX,
            accY: live.accY,
            accZ: live.accZ,
          },
          calibrated,
          filtered: { pitch: -finalPitch, roll: finalRoll, yaw: finalYaw },
          status: useHardware
            ? "Live hardware active"
            : "Simulated studio active",
          csvRows: historyRef.current,
        });
      }

      frameId = window.requestAnimationFrame(loop);
    };
    frameId = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(frameId);
  }, [refs]);

  return {
    settings,
    telemetry,
    refs,
    dragManualRef,
    commitManualState,
    actions: { requestPermission, zeroCalibrate, exportCsv, dispatch },
  };
}

function useTelemetry() {
  return useContext(TelemetryContext);
}

export default function App() {
  const store = useTelemetryStore();
  return (
    <TelemetryContext.Provider value={store}>
      <div className={styles.appShell}>
        <HardwareConsole />
        <TelemetryStage />
        <SensorTelemetryHUD />
        <LiveCsvLedgerStream />
      </div>
    </TelemetryContext.Provider>
  );
}

const HardwareConsole = memo(function HardwareConsole() {
  const { settings, telemetry } = useTelemetry();
  return (
    <header className={styles.headerDeck}>
      <div className={styles.brandGroup}>
        <span className={styles.badgeKicker}>
          ITM Skills University • Sem II Case Study
        </span>
        <h1 className={styles.mainTitle}>Device Screen Orientation Sandbox</h1>
        <div className={styles.statusPills}>
          <span className={styles.pill}>
            <span
              className={`${styles.dot} ${settings.controlMode === "hardware" ? styles.activeDot : ""}`}
            />
            Active: {telemetry.source}
          </span>
          <span className={styles.pill}>Layout: {settings.orientation}</span>
        </div>
      </div>
      <SensorPermissionActionStrip />
    </header>
  );
});

const SensorPermissionActionStrip = memo(
  function SensorPermissionActionStrip() {
    const { actions, settings } = useTelemetry();
    return (
      <div className={styles.actionStrip}>
        <button
          className={styles.btnPrimary}
          onClick={actions.requestPermission}
        >
          {settings.permission === "granted"
            ? "IMU Authorized"
            : "Connect iPhone Sensors"}
        </button>
        <button className={styles.btnGhost} onClick={actions.zeroCalibrate}>
          Zero-Calibrate Sensor
        </button>
        <button className={styles.btnGhost} onClick={actions.exportCsv}>
          Export CSV Log
        </button>
        <button
          className={styles.btnDanger}
          onClick={() => actions.dispatch({ type: "RESET_CALIBRATION" })}
        >
          Clear Bias
        </button>
      </div>
    );
  },
);

const TelemetryStage = memo(function TelemetryStage() {
  return (
    <main className={styles.stageGrid}>
      <SpatialAttitudeVirtualChassis />
      <div className={styles.sideControlsColumn}>
        <SignalFilterHyperparameterForm />
        <ManualSimulationPanel />
        <ImuTelemetrySpreadsheet />
      </div>
    </main>
  );
});

const SignalFilterHyperparameterForm = memo(
  function SignalFilterHyperparameterForm() {
    const { settings, actions } = useTelemetry();
    return (
      <section className={styles.cardPanel}>
        <h2 className={styles.cardHeading}>Signal Filtering Configuration</h2>
        <p className={styles.cardSub}>
          Toggle processing mathematics instantly.
        </p>
        <div className={styles.toggleRow}>
          <button
            className={`${styles.toggleBtn} ${settings.filterType === "raw" ? styles.toggleActive : ""}`}
            onClick={() =>
              actions.dispatch({ type: "SET_FILTER_TYPE", payload: "raw" })
            }
          >
            Raw Register Output
          </button>
          <button
            className={`${styles.toggleBtn} ${settings.filterType === "smoothed" ? styles.toggleActive : ""}`}
            onClick={() =>
              actions.dispatch({ type: "SET_FILTER_TYPE", payload: "smoothed" })
            }
          >
            Smoothed Processing
          </button>
        </div>
      </section>
    );
  },
);

const ManualSimulationPanel = memo(function ManualSimulationPanel() {
  const { settings, actions, refs, dragManualRef, commitManualState } =
    useTelemetry();
  return (
    <section className={styles.cardPanel}>
      <h2 className={styles.cardHeading}>Interactive Input Source</h2>
      <p className={styles.cardSub}>
        Switch tracking feeds or manually adjust values below.
      </p>

      <div className={styles.toggleRow} style={{ marginBottom: "16px" }}>
        <button
          className={`${styles.toggleBtn} ${settings.controlMode === "sliders" ? styles.toggleActive : ""}`}
          onClick={() =>
            actions.dispatch({ type: "SET_CONTROL_MODE", payload: "sliders" })
          }
        >
          Use Studio Sliders
        </button>
        <button
          className={`${styles.toggleBtn} ${settings.controlMode === "hardware" ? styles.toggleActive : ""}`}
          disabled={settings.permission !== "granted"}
          onClick={() =>
            actions.dispatch({ type: "SET_CONTROL_MODE", payload: "hardware" })
          }
          style={{
            opacity: settings.permission === "granted" ? 1 : 0.4,
            cursor:
              settings.permission === "granted" ? "pointer" : "not-allowed",
          }}
        >
          Use Live Hardware {settings.permission !== "granted" && "(Locked)"}
        </button>
      </div>

      <div
        className={styles.sliderStack}
        style={{
          opacity: settings.controlMode === "sliders" ? 1 : 0.5,
          transition: "opacity 0.2s ease",
        }}
      >
        {[
          {
            axis: "alpha",
            label: "α Yaw (Z)",
            inputRef: refs.alphaInputRef,
            valRef: refs.alphaValRef,
          },
          {
            axis: "beta",
            label: "β Pitch (X)",
            inputRef: refs.betaInputRef,
            valRef: refs.betaValRef,
          },
          {
            axis: "gamma",
            label: "γ Roll (Y)",
            inputRef: refs.gammaInputRef,
            valRef: refs.gammaValRef,
          },
        ].map(({ axis, label, inputRef, valRef }) => (
          <div key={axis} className={styles.sliderRow}>
            <label className={styles.sliderLabel}>{label}</label>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              ref={inputRef}
              disabled={settings.controlMode !== "sliders"}
              defaultValue={settings.manual[axis]}
              onInput={(e) => {
                dragManualRef.current[axis] = Number(e.target.value);
                if (valRef.current)
                  valRef.current.innerText = e.target.value + "°";
              }}
              onMouseUp={commitManualState}
              onTouchEnd={commitManualState}
              className={styles.sliderInput}
            />
            <span ref={valRef} className={styles.sliderValue}>
              {settings.manual[axis]}°
            </span>
          </div>
        ))}
      </div>
    </section>
  );
});

const SpatialAttitudeVirtualChassis = memo(
  function SpatialAttitudeVirtualChassis() {
    const { settings, actions, refs, dragManualRef, commitManualState } =
      useTelemetry();
    const isDraggingRef = useRef(false);
    const prevMousePosRef = useRef({ x: 0, y: 0 });
    const settingsRef = useRef(settings);

    useEffect(() => {
      settingsRef.current = settings;
    }, [settings]);

    const handleMouseDown = (e) => {
      isDraggingRef.current = true;
      prevMousePosRef.current = { x: e.clientX, y: e.clientY };
      if (settingsRef.current.controlMode !== "sliders") {
        actions.dispatch({ type: "SET_CONTROL_MODE", payload: "sliders" });
      }
    };

    const handleTouchStart = (e) => {
      if (e.touches.length === 0) return;
      isDraggingRef.current = true;
      prevMousePosRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
      if (settingsRef.current.controlMode !== "sliders") {
        actions.dispatch({ type: "SET_CONTROL_MODE", payload: "sliders" });
      }
    };

    useEffect(() => {
      const handleGlobalMouseMove = (e) => {
        if (!isDraggingRef.current) return;

        const deltaX = e.clientX - prevMousePosRef.current.x;
        const deltaY = e.clientY - prevMousePosRef.current.y;
        prevMousePosRef.current = { x: e.clientX, y: e.clientY };

        // Fixed: Strict boundary clamping blocks out-of-bounds angles from accumulating
        if (e.shiftKey) {
          dragManualRef.current.alpha = clamp(
            dragManualRef.current.alpha + deltaX * 0.4,
            -180,
            180,
          );
        } else {
          dragManualRef.current.gamma = clamp(
            dragManualRef.current.gamma + deltaX * 0.4,
            -180,
            180,
          );
        }
        dragManualRef.current.beta = clamp(
          dragManualRef.current.beta + deltaY * 0.4,
          -180,
          180,
        );
      };

      const handleGlobalMouseUp = () => {
        if (isDraggingRef.current) {
          isDraggingRef.current = false;
          commitManualState();
        }
      };

      const handleGlobalTouchMove = (e) => {
        if (!isDraggingRef.current || e.touches.length === 0) return;
        const touch = e.touches[0];
        const deltaX = touch.clientX - prevMousePosRef.current.x;
        const deltaY = touch.clientY - prevMousePosRef.current.y;
        prevMousePosRef.current = { x: touch.clientX, y: touch.clientY };

        if (e.touches.length > 1) {
          dragManualRef.current.alpha = clamp(
            dragManualRef.current.alpha + deltaX * 0.4,
            -180,
            180,
          );
        } else {
          dragManualRef.current.gamma = clamp(
            dragManualRef.current.gamma + deltaX * 0.4,
            -180,
            180,
          );
        }
        dragManualRef.current.beta = clamp(
          dragManualRef.current.beta + deltaY * 0.4,
          -180,
          180,
        );
      };

      window.addEventListener("mousemove", handleGlobalMouseMove);
      window.addEventListener("mouseup", handleGlobalMouseUp);
      window.addEventListener("touchmove", handleGlobalTouchMove, {
        passive: true,
      });
      window.addEventListener("touchend", handleGlobalMouseUp);

      return () => {
        window.removeEventListener("mousemove", handleGlobalMouseMove);
        window.removeEventListener("mouseup", handleGlobalMouseUp);
        window.removeEventListener("touchmove", handleGlobalTouchMove);
        window.removeEventListener("touchend", handleGlobalMouseUp);
      };
    }, [commitManualState, dragManualRef]);

    const totalLayers = 8;

    return (
      <section className={`${styles.cardPanel} ${styles.viewportContainer}`}>
        <h2 className={styles.cardHeading}>
          3D Spatial Vector Laboratory Staging
        </h2>
        <p className={styles.cardSub}>
          Drag inside the canvas block to pivot the smartphone chassis. Hold
          Shift while dragging to adjust Yaw.
        </p>

        <div
          className={styles.perspectiveLabBench}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          <div className={styles.chassisWrapper} ref={refs.chassisRef}>
            <div className={styles.phoneBody3D}>
              {Array.from({ length: totalLayers }).map((_, index) => {
                const zOffset = -8 + index * (16 / (totalLayers - 1));
                const isFront = index === totalLayers - 1;
                const isBack = index === 0;

                return (
                  <div
                    key={index}
                    className={`${styles.phoneLayer3D} ${isFront ? styles.layerFront : isBack ? styles.layerBack : styles.layerMiddle}`}
                    style={{ transform: `translateZ(${zOffset}px)` }}
                  >
                    {isFront && (
                      <div className={styles.phoneScreenGlass}>
                        <div className={styles.phoneInternalHeader}>
                          <div className={styles.notchCamera} />
                        </div>
                        <div className={styles.screenChassisMetrics}>
                          <div className={styles.chassisMetricRow}>
                            <span>PITCH:</span>
                            <strong ref={refs.pitchTextRef}>0.0°</strong>
                          </div>
                          <div className={styles.chassisMetricRow}>
                            <span>ROLL:</span>
                            <strong ref={refs.rollTextRef}>0.0°</strong>
                          </div>
                          <div className={styles.chassisMetricRow}>
                            <span>YAW:</span>
                            <strong ref={refs.yawTextRef}>0.0°</strong>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    );
  },
);

const ImuTelemetrySpreadsheet = memo(function ImuTelemetrySpreadsheet() {
  const { telemetry } = useTelemetry();
  return (
    <section className={styles.cardPanel}>
      <h2 className={styles.cardHeading}>In-Memory State Ledger</h2>
      <div className={styles.tableResponsive}>
        <table className={styles.denseTable}>
          <thead>
            <tr>
              <th>Coordinate Vector Channel</th>
              <th>Computed Readout</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Raw Mechanical Register [α, β, γ]</td>
              <td>
                {formatAxis(telemetry.raw.alpha)}°,{" "}
                {formatAxis(telemetry.raw.beta)}°,{" "}
                {formatAxis(telemetry.raw.gamma)}°
              </td>
            </tr>
            <tr>
              <td>Compensated Zero-Bias Offsets</td>
              <td>
                {formatAxis(telemetry.calibrated.alpha)}°,{" "}
                {formatAxis(telemetry.calibrated.beta)}°,{" "}
                {formatAxis(telemetry.calibrated.gamma)}°
              </td>
            </tr>
            <tr>
              <td>Stabilized Kinematic Output [P, R, Y]</td>
              <td>
                {formatAxis(telemetry.filtered.pitch)}°,{" "}
                {formatAxis(telemetry.filtered.roll)}°,{" "}
                {formatAxis(telemetry.filtered.yaw)}°
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
});

const SensorTelemetryHUD = memo(function SensorTelemetryHUD() {
  const { settings, telemetry } = useTelemetry();
  return (
    <footer className={styles.cardPanel}>
      <h2 className={styles.cardHeading}>System Status Diagnostics Summary</h2>
      <div className={styles.hudGridSystem}>
        <div className={styles.hudTile}>
          <span>State Flag Indicator</span># {telemetry.status}
        </div>
        <span className={styles.hudDivider} />
        <div className={styles.hudTile}>
          <span>Screen Flag Mode</span># {settings.orientation.toUpperCase()}
        </div>
        <span className={styles.hudDivider} />
        <div className={styles.hudTile}>
          <span>Calibration Bias Constants</span>
          <strong>
            α:{formatAxis(settings.bias.alpha)}° | β:
            {formatAxis(settings.bias.beta)}° | γ:
            {formatAxis(settings.bias.gamma)}°
          </strong>
        </div>
      </div>
    </footer>
  );
});

const LiveCsvLedgerStream = memo(function LiveCsvLedgerStream() {
  const { telemetry } = useTelemetry();
  const visibleRows = useMemo(
    () => telemetry.csvRows.slice(0, 5),
    [telemetry.csvRows],
  );

  return (
    <section className={styles.cardPanel} style={{ marginTop: "4px" }}>
      <h2 className={styles.cardHeading}>
        Real-Time CSV Output Buffer Preview
      </h2>
      <p className={styles.cardSub}>
        Running snapshot log of unique spatial coordinate sequences compiled in
        memory.
      </p>
      <div className={styles.terminalConsoleLogBox}>
        <div className={styles.terminalHeaderLine}>
          timestamp, raw_alpha, raw_beta, raw_gamma, out_pitch, out_roll,
          out_yaw
        </div>
        {visibleRows.length === 0 ? (
          <div className={styles.terminalEmptyState}>
            [Move device or adjust controls to populate memory history trace
            entries...]
          </div>
        ) : (
          visibleRows.map((row, idx) => (
            <div key={idx} className={styles.terminalDataRow}>
              {row.time}, {row.alpha}°, {row.beta}°, {row.gamma}°, {row.pitch}°,{" "}
              {row.roll}°, {row.yaw}°
            </div>
          ))
        )}
      </div>
    </section>
  );
});
