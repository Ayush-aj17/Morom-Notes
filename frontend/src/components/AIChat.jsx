import { useState } from "react";
import { aiEditAPI } from "../api/api";

export default function AIChat({ content, setContent }) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const sendInstruction = async () => {
    if (!message) return;

    setLoading(true);

    const res = await aiEditAPI(content, message);

    setContent(res.updated_notes);

    setMessage("");
    setLoading(false);
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 mt-4">
      <h2 className="text-lg font-bold mb-2">AI Editor</h2>

      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Tell AI what to change..."
        className="w-full p-2 rounded text-black"
      />

      <button
        onClick={sendInstruction}
        className="mt-3 bg-blue-600 px-4 py-2 rounded-xl cursor-pointer hover:bg-blue-700 transition-colors"
      >
        {loading ? "Editing..." : "Send"}
      </button>
    </div>
  );
}