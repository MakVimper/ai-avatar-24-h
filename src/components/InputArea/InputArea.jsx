import { useState } from "react";
import { Mic, CircleStop, Send } from "lucide-react";
import VoiceRecorder from "./VoiceRecorder";
import "./InputArea.css";

// Принимаем onSendMessage как пропс
const InputArea = ({ onSendMessage }) => {
  const [recording, setRecording] = useState(false);
  const [message, setMessage] = useState("");

  const recorder = VoiceRecorder({
    onTextReceived: (text) => {
      setMessage(text);
    },
  });

  const handleMicClick = () => {
    if (!recording) {
      recorder.start();
    } else {
      recorder.stop();
    }
    setRecording(!recording);
  };

  const handleSendClick = () => {
    if (!message.trim()) return;
    onSendMessage(message); // Вызываем функцию из App.js
    setMessage(""); // Очищаем поле после отправки
  };

  // Добавляем отправку по Enter
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendClick();
    }
  };

  return (
    <div className="input-area">
      <input
        type="text"
        placeholder="Ask a question or use the microphone"
        className="message-input"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown} // Добавили обработчик нажатия клавиш
      />

      <button
        className={`mic-btn ${recording ? "recording" : ""}`}
        onClick={handleMicClick}
        title={recording ? "Stop recording" : "Start recording"}
      >
        {recording ? <CircleStop size={20} /> : <Mic size={20} />}
      </button>

      <button className="send-btn" onClick={handleSendClick} title="Send message">
        <Send size={20} />
      </button>
    </div>
  );
};

export default InputArea;