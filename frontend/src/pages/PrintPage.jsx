import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authFetch } from '../api/api';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Printer, Home } from 'lucide-react';

export default function PrintPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const printRef = useRef(null);

  const noteId = searchParams.get('id');

  // Redirect if not authenticated
  useEffect(() => {
    if (!token) navigate('/login');
  }, [token, navigate]);

  // Fetch note data
  useEffect(() => {
    if (!noteId) {
      setError('No note ID provided. Please open a note first.');
      setLoading(false);
      return;
    }

    const fetchNote = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await authFetch(`/api/notes/${noteId}`);

        if (!res.ok) {
          throw new Error('Failed to load note');
        }

        const data = await res.json();
        setNote(data);
      } catch (err) {
        console.error('Error fetching note:', err);
        setError(err.message || 'Failed to load note');
      } finally {
        setLoading(false);
      }
    };

    fetchNote();
  }, [noteId]);

  // Handle print
  const handlePrint = () => {
    window.print();
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-stone-600 mb-4">Loading note...</p>
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-red-600 mb-4">⚠️ {error}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Print-only toolbar (hidden when printing) */}
      <div className="print-toolbar bg-white border-b border-gray-200 p-4 sticky top-0 flex items-center justify-between shadow-sm no-print">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-stone-900">{note?.title || 'Untitled Note'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Printer size={18} />
            Print
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
          >
            <Home size={18} />
            Dashboard
          </button>
        </div>
      </div>

      {/* Print content */}
      <div ref={printRef} className="print-content bg-white">
        {/* Cover Page */}
        <div className="page-break page bg-white print:break-after-page">
          <div className="h-screen flex flex-col items-center justify-center p-12 space-y-8">
            {/* Title */}
            <h1 className="text-5xl font-bold text-center text-stone-900 mb-4">
              {note?.title || 'Untitled Note'}
            </h1>

            {/* Divider */}
            <div className="w-20 h-1 bg-blue-600 rounded"></div>

            {/* Metadata */}
            <div className="text-center space-y-3 text-stone-600">
              {note?.source_type && (
                <p className="text-lg">
                  <span className="font-semibold">Source:</span> {note.source_type}
                </p>
              )}
              {note?.created_at && (
                <p className="text-lg">
                  <span className="font-semibold">Created:</span> {new Date(note.created_at).toLocaleDateString()}
                </p>
              )}
              {note?.subject && (
                <p className="text-lg">
                  <span className="font-semibold">Subject:</span> {note.subject}
                </p>
              )}
            </div>

            {/* Spacer */}
            <div className="flex-1"></div>

            {/* Footer */}
            <div className="text-center text-stone-500 text-sm">
              <p>Generated by Morom Notes</p>
              <p>AI-Powered Note Generation Platform</p>
            </div>
          </div>
        </div>

        {/* Content Pages */}
        <div className="page bg-white print:break-after-page p-12">
          {/* Page header */}
          <div className="mb-8 pb-4 border-b border-gray-300">
            <h2 className="text-3xl font-bold text-stone-900">{note?.title || 'Untitled Note'}</h2>
          </div>

          {/* Main content */}
          <div className="prose prose-stone max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex]}
            >
              {note?.content || 'No content'}
            </ReactMarkdown>
          </div>

          {/* Page footer */}
          <div className="mt-12 pt-4 border-t border-gray-300 text-center text-stone-500 text-xs">
            <p>Morom Notes • {new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* Print-specific styles */}
      <style>{`
        @media print {
          body {
            background: white;
            margin: 0;
            padding: 0;
          }

          .no-print {
            display: none !important;
          }

          .page-break {
            page-break-after: always;
            break-after: page;
          }

          .print-content {
            margin: 0;
            padding: 0;
          }

          h1, h2, h3, h4, h5, h6 {
            page-break-after: avoid;
          }

          p, li {
            page-break-inside: avoid;
          }

          ul, ol {
            page-break-inside: avoid;
          }

          table {
            page-break-inside: avoid;
          }

          img {
            max-width: 100%;
            page-break-inside: avoid;
          }

          a {
            color: #0066cc;
            text-decoration: underline;
          }

          pre, code {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
