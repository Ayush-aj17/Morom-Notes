import { useState, useRef, useEffect } from "react";
import { authFetch } from "../api/api";

export default function StudyBuddy({ noteId, content, onNotesUpdate }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [showBuddy, setShowBuddy] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const messagesEndRef = useRef(null);
  const chatRef = useRef(null);
  const headerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleMouseDown = (e) => {
    if (headerRef.current && headerRef.current.contains(e.target)) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragStart]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    // Add user message to chat
    const userMessage = { role: "user", content: inputValue };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const res = await authFetch(`/api/notes/${noteId}/study-buddy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          message: inputValue,
          original_content: content,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        
        // Set conversation ID if first message
        if (!conversationId) {
          setConversationId(data.conversation_id);
        }

        // Add AI response
        const aiMessage = { role: "assistant", content: data.response };
        setMessages((prev) => [...prev, aiMessage]);
      } else {
        const error = await res.json();
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${error.detail || "Failed to process"}` },
        ]);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error: Could not connect to AI" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyChanges = async () => {
    if (!conversationId || messages.length === 0) return;

    setIsApplying(true);
    try {
      const res = await authFetch(`/api/notes/${noteId}/study-buddy/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          original_content: content,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onNotesUpdate(data.updated_content);
        setMessages([]);
        setConversationId(null);
        setShowBuddy(false);
        // Show success message
        alert("Notes updated successfully!");
      } else {
        const error = await res.json();
        alert(`Failed to apply changes: ${error.detail || "Unknown error"}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error applying changes");
    } finally {
      setIsApplying(false);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setConversationId(null);
    setInputValue("");
  };

  if (!showBuddy) {
    return (
      <button
        onClick={() => setShowBuddy(true)}
        className="fixed bottom-6 right-6 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-full p-4 shadow-lg transition-all hover:shadow-xl"
        title="Open Study Buddy Chat"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>
    );
  }

  return (
    <div 
      ref={chatRef}
      className="flex fixed bottom-6 right-4 md:right-6 w-[90vw] md:w-96 max-h-[80vh] md:max-h-[600px] bg-white rounded-lg shadow-2xl flex-col z-50 border border-gray-200"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        transition: isDragging ? "none" : "transform 0.1s ease-out",
      }}
    >
      {/* Header */}
      <div 
        ref={headerRef}
        onMouseDown={handleMouseDown}
        className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-t-lg flex justify-between items-center cursor-move select-none"
      >
        <div>
          <h3 className="font-bold text-lg">Study Buddy</h3>
          <p className="text-xs opacity-90">AI-powered note refinement</p>
        </div>
        <button
          onClick={() => setShowBuddy(false)}
          className="text-white hover:opacity-80 transition"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p className="text-sm font-medium">Tell me how to improve your notes</p>
            <p className="text-xs text-gray-400 mt-3">e.g., "add examples" or "make it simpler"</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                  msg.role === "user"
                    ? "bg-blue-500 text-white rounded-br-none"
                    : "bg-white border border-gray-200 text-gray-800 rounded-bl-none"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 px-3 py-2 rounded-lg text-sm text-gray-600">
              <span className="inline-block animate-pulse">AI is thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 p-4 bg-white rounded-b-lg">
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && !isLoading && handleSendMessage()}
            placeholder="Tell me what to change..."
            className="flex-1 bg-gray-100 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputValue.trim()}
            className="bg-blue-500 text-white px-3 py-2 rounded text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Send
          </button>
        </div>

        {messages.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={handleApplyChanges}
              disabled={isApplying || isLoading}
              className="flex-1 bg-green-500 text-white px-3 py-2 rounded text-sm font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isApplying ? "Applying..." : "✓ Apply Changes"}
            </button>
            <button
              onClick={handleReset}
              disabled={isApplying}
              className="flex-1 bg-gray-300 text-gray-700 px-3 py-2 rounded text-sm font-medium hover:bg-gray-400 disabled:opacity-50 transition"
            >
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
