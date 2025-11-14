import React, { useEffect, useRef } from "react";
import * as PIXI from "pixi.js";
import { Live2DModel } from "pixi-live2d-display";

if (PIXI.Ticker) {
  Live2DModel.registerTicker(PIXI.Ticker);
}

const Live2DAvatar = ({ width = 400, height = 400 }) => {
  const containerRef = useRef(null);
  const appRef = useRef(null);
  const modelRef = useRef(null);
  const animateRef = useRef(null);
  const wsRef = useRef(null);

  const mouthStateRef = useRef({
    targetOpen: 0,
    targetForm: 0,
    currentOpen: 0,
    currentForm: 0,
    lastUpdateTime: 0
  });

  useEffect(() => {
    window.mouthStateRef = mouthStateRef;
    console.log("✅ mouthStateRef установлен");
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const app = new PIXI.Application({
          width,
          height,
          backgroundAlpha: 0,
          antialias: true,
          resolution: window.devicePixelRatio || 1,
        });
        if (!mounted || !containerRef.current) return;
        containerRef.current.appendChild(app.view);
        appRef.current = app;

        const model = await Live2DModel.from(
          "/haru_greeter_pro_jp/runtime/haru_greeter_t05.model3.json",
          { autoInteract: false }
        );
        if (!mounted) return;

        const core = model.internalModel.coreModel;
        const internal = model.internalModel;

        if (internal.motionManager?.stopAllMotions) internal.motionManager.stopAllMotions();
        if (internal.motionManager && "update" in internal.motionManager) internal.motionManager.update = () => { };
        if ("eyeBlink" in internal) internal.eyeBlink = undefined;
        if ("breath" in internal) internal.breath = undefined;
        if ("physics" in internal) internal.physics = undefined;

        core.setParameterValueById("ParamMouthOpenY", 0);
        core.setParameterValueById("ParamMouthForm", 0);

        model.anchor.set(0.5, 0.15);
        model.position.set(width / 2, height / 2);
        model.scale.set(0.4);

        app.stage.addChild(model);
        modelRef.current = model;

        window.mouthStateRef = mouthStateRef;
        window.live2DModel = model;

        // Создаем WebSocket и делаем его доступным глобально
        const ws = new WebSocket("ws://localhost:8000/ws/lipsync");
        wsRef.current = ws;
        window.lipsyncWebSocket = ws; // ✅ Делаем доступным в App.jsx

        ws.onopen = () => console.log("✅ LipSync WS connected");
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.error) return console.warn("⚠️ Server error:", data.error);

            if (data.type === "lipsync" && data.data) {
              const mouth = data.data;
              mouthStateRef.current.targetOpen = mouth.open;
              mouthStateRef.current.targetForm = mouth.form;
              mouthStateRef.current.lastUpdateTime = Date.now();
              console.log(`[WS] 👄 Mouth: open=${mouth.open.toFixed(2)}, form=${mouth.form.toFixed(2)}`);
            }

            // Отправляем подтверждение серверу
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "ack" }));
            }
          } catch (err) {
            console.error("❌ LipSync JSON error:", err);
          }
        };
        
        ws.onerror = (err) => console.error("❌ LipSync WS error:", err);
        ws.onclose = () => {
          console.warn("⚠️ LipSync WS closed");
          mouthStateRef.current.targetOpen = 0;
          mouthStateRef.current.targetForm = 0;
          window.lipsyncWebSocket = null;
        };

        // Idle анимации и рта
        let blinkTimer = 0;
        let blinkInterval = 2000 + Math.random() * 2000;

        const animate = (delta) => {
          if (!modelRef.current) return;
          const now = performance.now() / 1000;
          const core = model.internalModel.coreModel;

          // Idle движения
          const breath = Math.sin(now * 1.2) * 0.3;
          core.setParameterValueById("ParamBodyAngleX", breath * 3);
          core.setParameterValueById("ParamBodyAngleY", Math.sin(now * 0.9) * 1.5);
          core.setParameterValueById("ParamBreath", 0.5 + 0.5 * Math.sin(now * 1.2));
          core.setParameterValueById("ParamAngleX", Math.sin(now * 0.7) * 8 + Math.sin(now * 3.3) * 1);
          core.setParameterValueById("ParamAngleY", Math.sin(now * 0.9) * 6);
          core.setParameterValueById("ParamAngleZ", Math.sin(now * 0.5) * 3);
          core.setParameterValueById("ParamEyeBallX", Math.sin(now * 0.8) * 0.25 + Math.sin(now * 3.5) * 0.08);
          core.setParameterValueById("ParamEyeBallY", Math.sin(now * 0.6) * 0.2);

          // Blink
          blinkTimer += delta * 16.67;
          if (blinkTimer > blinkInterval) {
            const blinkProgress = (blinkTimer - blinkInterval) / 160;
            const eye = 1 - Math.sin(Math.min(blinkProgress, 1) * Math.PI);
            core.setParameterValueById("ParamEyeBlinkLeft", eye);
            core.setParameterValueById("ParamEyeBlinkRight", eye);
            if (blinkProgress >= 1) {
              blinkTimer = 0;
              blinkInterval = 1800 + Math.random() * 2500;
            }
          }

          // Брови и волосы
          const browNoise = Math.sin(now * 2.7) * 0.08;
          core.setParameterValueById("ParamBrowLY", 0.15 + browNoise);
          core.setParameterValueById("ParamBrowRY", 0.15 + browNoise);
          core.setParameterValueById("ParamEyeSmile", Math.max(0, Math.sin(now * 0.5)) * 0.15);
          const sway = Math.sin(now * 1.5) * 0.12 + Math.sin(now * 3.2) * 0.04;
          core.setParameterValueById("ParamHairFront", sway);
          core.setParameterValueById("ParamHairSide", -sway * 0.8);
          core.setParameterValueById("ParamHairBack", sway * 1.1);

          // 👄 Mouth animation (интерполяция)
          const mouthState = mouthStateRef.current;
          const timeSinceUpdate = Date.now() - mouthState.lastUpdateTime;
          
          // Если давно не было обновлений, закрываем рот
          if (timeSinceUpdate > 300 && mouthState.lastUpdateTime > 0) {
            mouthState.targetOpen = 0;
            mouthState.targetForm = 0;
          }

          // Плавная интерполяция
          const lerpSpeed = 0.3; // Уменьшено для более плавной анимации
          mouthState.currentOpen += (mouthState.targetOpen - mouthState.currentOpen) * lerpSpeed;
          mouthState.currentForm += (mouthState.targetForm - mouthState.currentForm) * lerpSpeed;

          // Применяем к модели (с масштабированием)
          const scaledOpen = mouthState.currentOpen * 1.0;
          const scaledForm = mouthState.currentForm * 1.0;

          core.setParameterValueById("ParamMouthOpenY", scaledOpen);
          core.setParameterValueById("ParamMouthForm", scaledForm);

          core.update();
        };

        app.ticker.add(animate);
        animateRef.current = animate;

      } catch (err) {
        console.error("❌ Ошибка загрузки Live2D модели:", err);
      }
    })();

    return () => {
      mounted = false;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
        window.lipsyncWebSocket = null;
      }
      if (appRef.current) {
        if (animateRef.current) appRef.current.ticker.remove(animateRef.current);
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
      modelRef.current = null;
    };
  }, [width, height]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        position: "relative",
      }}
    />
  );
};

export default Live2DAvatar;