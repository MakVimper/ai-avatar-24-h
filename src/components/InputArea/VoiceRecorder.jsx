// src/components/VoiceRecorder.jsx
import { useRef } from "react";
import axios from "axios";

const VoiceRecorder = ({ onTextReceived }) => {
  const mediaRecorderRef = useRef(null);
  const chunks = useRef([]);
  const isRecording = useRef(false);

  const start = async () => {
    if (isRecording.current) return;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new MediaRecorder(stream);
    chunks.current = [];

    mediaRecorderRef.current.ondataavailable = (e) => {
      chunks.current.push(e.data);
    };

    mediaRecorderRef.current.onstop = async () => {
      const blob = new Blob(chunks.current, { type: "audio/webm" });

      const formData = new FormData();
      formData.append("file", blob, "audio.webm");

      const res = await axios.post("http://localhost:8000/stt", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (onTextReceived) onTextReceived(res.data.text);
    };

    mediaRecorderRef.current.start();
    isRecording.current = true;

    console.log("🎙 Recording started...");
  };

  const stop = () => {
    if (!isRecording.current) return;
    mediaRecorderRef.current.stop();
    isRecording.current = false;
    console.log("⏹ Recording stopped.");
  };

  return { start, stop };
};

export default VoiceRecorder;
