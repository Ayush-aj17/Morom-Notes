import { useLocation } from "react-router-dom";
import ReactMarkdown from "react-markdown";

export default function PrintPage() {
  const location = useLocation();
  const content = location.state?.content || "";

  return (
    <div className="min-h-screen bg-[#f5f2eb] flex justify-center p-8">
      <div
        className="w-[800px] bg-[#fffdf8] shadow-xl rounded-xl p-12"
        style={{
          fontFamily: "'Caveat', cursive",
          lineHeight: "1.8",
          fontSize: "30px",
        }}
      >
        {/* NOTES CONTENT */}
        <div className="prose max-w-none text-black
          prose-headings:text-blue-700
          prose-strong:text-red-600
          prose-p:text-black
          prose-li:text-black">
          <ReactMarkdown>
          {content
            .split("\n")
            .map(line => {
              // convert ONLY standalone bold lines into headings
              if (/^\*\*.*\*\*$/.test(line.trim())) {
                return "## " + line.replace(/\*\*/g, "");
              }
              return line;
            })
            .join("\n")}
          </ReactMarkdown>
        </div>

        {/* FOOTER */}
        <div className="text-center mt-16 text-gray-400 text-xl">
          notes_by_morom
        </div>
      </div>
    </div>
  );
}