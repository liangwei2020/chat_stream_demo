import React, { useState, useRef, useEffect } from 'react';
import { EventSourcePolyfill } from 'event-source-polyfill';
import './index.less'

function App() {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef(null);

  // 自动滚动到底部
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;
    
    const userMessage = {
      id: Date.now() + 'user',
      text: inputValue,
      isUser: true
    };
    
    const aiMessage = {
      id: Date.now() + 'ai',
      text: '',
      isUser: false
    };
    
    // 添加用户消息和空AI消息
    setMessages(prev => [...prev, userMessage, aiMessage]);
    setInputValue('');
    setIsLoading(true);
    
    try {
      // 使用EventSourcePolyfill处理SSE
      const eventSource = new EventSourcePolyfill(`http://127.0.0.1:3000/chat?message=${encodeURIComponent(inputValue)}`, {
        headers: {
          'Content-Type': 'text/event-stream',
        }
      });
      
     eventSource.onmessage = (event) => {
          let data;
          try {
              data = JSON.parse(event.data);
          } catch (error) {
              // 处理非 JSON 响应
              console.error('JSON 解析错误:', error);
              console.log('原始数据:', event.data);
              
              // 如果是累积的完整响应
              setMessages(prev => prev.map((msg, i) => 
                  i === prev.length - 1 ? {...msg, text: event.data} : msg
              ));
              return;
          }
          
          if (data.event === 'error') {
              setMessages(prev => prev.map((msg, i) => 
                  i === prev.length - 1 ? {...msg, text: msg.text + `\n[错误: ${data.data}]`} : msg
              ));
          } 
          else if (data.event === 'end') {
              eventSource.close();
              setIsLoading(false);
          } 
          else {
              // 更新最后一条AI消息的内容为完整的累积响应
              setMessages(prev => prev.map((msg, i) => 
                  i === prev.length - 1 ? {...msg, text: data.data} : msg
              ));
          }
      };
      
      eventSource.onerror = (error) => {
        setMessages(prev => prev.map((msg, i) => 
          i === prev.length - 1 ? {...msg, text: msg.text } : msg
          // i === prev.length - 1 ? {...msg, text: msg.text + '\n[连接错误]'} : msg
        ));
        eventSource.close();
        setIsLoading(false);
      };
    } catch (error) {
      setMessages(prev => prev.map((msg, i) => 
        i === prev.length - 1 ? {...msg, text: msg.text + `\n[请求错误: ${error.message}]`} : msg
      ));
      setIsLoading(false);
    }
  };

  // 清除聊天记录
  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="chat-app">
      <div className="header">
        <h1>DeepSeek AI Chat</h1>
        <button onClick={clearChat} className="clear-btn">
          <i className="fas fa-trash-alt"></i> 清除记录
        </button>
      </div>
      
      <div className="chat-container" ref={chatContainerRef}>
        {messages.length === 0 && (
          <div className="welcome-message">
            <div className="logo">
              <i className="fas fa-robot"></i>
            </div>
            <h2>欢迎使用 DeepSeek AI 助手</h2>
            <p>输入您的问题开始对话</p>
          </div>
        )}
        
        {messages.map((msg, index) => (
          <div 
            key={msg.id} 
            className={`message ${msg.isUser ? 'user' : 'ai'} ${index === messages.length - 1 ? 'last-message' : ''}`}
          >
            <div className="avatar">
              {msg.isUser ? (
                <i className="fas fa-user"></i>
              ) : (
                <i className="fas fa-robot"></i>
              )}
            </div>
            <div className="message-content">
              <div className="text">
                {msg.text.split('\n').map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
              {!msg.isUser && index === messages.length - 1 && isLoading && (
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && messages.length > 0 && messages[messages.length - 1].isUser && (
          <div className="message ai">
            <div className="avatar">
              <i className="fas fa-robot"></i>
            </div>
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="input-container">
        <div className="input-wrap">
          <textarea
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="输入消息..."
            rows={1}
          />
          <button 
            onClick={sendMessage} 
            disabled={isLoading || !inputValue.trim()}
            className="send-btn"
          >
            <i className="fas fa-paper-plane"></i>
          </button>
        </div>
        <div className="hint">按 Enter 发送，Shift + Enter 换行</div>
      </div>
    </div>
  );
}

export default App;