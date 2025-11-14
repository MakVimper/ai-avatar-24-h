import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from './components/Sidebar/Sidebar';
import ChatArea from './components/ChatArea/ChatArea';
import AiArea from './components/AiArea/AiArea';
import './App.css';

const API_URL = 'http://localhost:8000';

const App = () => {
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadChats = async () => {
    try {
      const response = await axios.get(`${API_URL}/chats`);
      const chatsData = response.data.Chats || [];
      setChats(chatsData);
      return chatsData;
    } catch (err) {
      setError('Не удалось загрузить список чатов.');
      console.error(err);
      return [];
    }
  };

  const loadMessages = async (chatId) => {
    try {
      const response = await axios.get(`${API_URL}/messages/${chatId}`);
      return (response.data.Chat_messages || []).map((msg, index) => [
        { id: `user-${index}`, sender: 'user', text: msg.question, time: msg.time },
        { id: `ai-${index}`, sender: 'ai', text: msg.answer, time: msg.time }
      ]).flat();
    } catch (err) {
      console.error("Ошибка при загрузке сообщений:", err);
      return [];
    }
  };

  useEffect(() => {
    loadChats();
  }, []);

  const handleChatSelect = async (chat) => {
    if (activeChat?.Id === chat.Id) return;
    setActiveChat({ ...chat, messages: [] });
    setIsLoading(true);
    const messages = await loadMessages(chat.Id);
    setActiveChat({ ...chat, messages });
    setIsLoading(false);
  };

  const handleNewChat = () => setActiveChat(null);

  const handleSendMessage = async (message) => {
    let currentChatId = activeChat?.Id;
    const isNewChat = !currentChatId;

    if (isNewChat) currentChatId = 'chat_' + Date.now();

    const userMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: message,
      time: new Date().toLocaleTimeString()
    };

    if (isNewChat) {
      setActiveChat({
        Id: currentChatId,
        title: message.substring(0, 30) + '...',
        messages: [userMessage]
      });
    } else {
      setActiveChat(prev => ({ ...prev, messages: [...prev.messages, userMessage] }));
    }

    try {
      // Отправляем сообщение на универсальный эндпоинт /chat
      const response = await axios.post(`${API_URL}/chat`, {
        message,
        chat_id: currentChatId,
        return_text: true,
        return_audio: true
      });

      // Достаём текст и аудио из JSON
      const botText = response.data.bot_reply;
      const audioBase64 = response.data.audio_base64;

      // 1️⃣ Отправляем текст в WebSocket для lipsync
      if (window.lipsyncWebSocket && window.lipsyncWebSocket.readyState === WebSocket.OPEN) {
        window.lipsyncWebSocket.send(JSON.stringify({ text: botText }));
      }

      // 2️⃣ Воспроизводим аудио
      const audioBlob = new Blob([Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0))], { type: 'audio/mpeg' });
      const audioObj = new Audio(URL.createObjectURL(audioBlob));
      audioObj.play();

      // 3️⃣ Обновляем чат
      const finalMessages = await loadMessages(currentChatId);
      setActiveChat(prev => ({ ...prev, Id: currentChatId, messages: finalMessages }));

    } catch (err) {
      setError('Ошибка при отправке сообщения.');
      console.error(err);
    }
  };

  return (
    <div className="app">
      <Sidebar
        chats={chats}
        activeChat={activeChat}
        onChatSelect={handleChatSelect}
        onNewChat={handleNewChat}
      />
      <AiArea onSendMessage={handleSendMessage} />
      {activeChat && <ChatArea chat={activeChat} isLoading={isLoading} />}
    </div>
  );
};

export default App;
