import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authFetch } from '../api/api';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import { Download, Eye, Save, X, Heart, ArrowLeft } from 'lucide-react';
import logoImage from '../assets/logo.jpeg';
import StudyBuddy from '../components/StudyBuddy';

// Helper function to estimate line height based on content type
const estimateLineHeight = (line) => {
  const ESTIMATED_LINE_HEIGHT = 18;
  let lineHeight = ESTIMATED_LINE_HEIGHT;

  if (line.match(/^#{1,6}\s/)) {
    const headingLevel = line.match(/^#+/)[0].length;
    if (headingLevel === 1) lineHeight = 38;
    else if (headingLevel === 2) lineHeight = 32;
    else if (headingLevel === 3) lineHeight = 28;
    else lineHeight = 26;
  } else if (line.match(/^>\s/)) {
    lineHeight = Math.ceil(line.length / 80) * ESTIMATED_LINE_HEIGHT + 6;
  } else if (line.match(/^[-*+]\s/) || line.match(/^\d+\.\s/)) {
    const charCount = line.length;
    const estimatedWraps = Math.ceil(charCount / 95);
    lineHeight = estimatedWraps * ESTIMATED_LINE_HEIGHT + 2;
  } else if (line.match(/^\s+[-*+]\s/) || line.match(/^\s+\d+\.\s/)) {
    const charCount = line.length;
    const estimatedWraps = Math.ceil(charCount / 90);
    lineHeight = estimatedWraps * ESTIMATED_LINE_HEIGHT + 2;
  } else if (line.trim() === '') {
    lineHeight = 4;
  } else {
    const charCount = line.length;
    if (charCount > 100) {
      const estimatedWraps = Math.ceil(charCount / 100);
      lineHeight = estimatedWraps * ESTIMATED_LINE_HEIGHT;
    }
  }

  return lineHeight;
};

const getContextIndices = (lines, lineIndex) => {
  if (lineIndex < 0 || lineIndex >= lines.length) return [];
  const line = lines[lineIndex];
  const lineIndent = line.match(/^(\s*)/)[1].length;
  if (lineIndent === 0) return [];
  const contextIndices = [];
  let currentSearchIndent = lineIndent;
  const searchLimit = Math.max(0, lineIndex - 50);
  for (let i = lineIndex - 1; i >= searchLimit; i--) {
    const prevLine = lines[i];
    if (prevLine.trim() === '') continue;
    const prevIndent = prevLine.match(/^(\s*)/)[1].length;
    const isListItem = prevLine.match(/^\s*([-*+]|\d+\.)\s/);
    if (isListItem && prevIndent < currentSearchIndent) {
      contextIndices.unshift(i);
      currentSearchIndent = prevIndent;
    }
  }
  return contextIndices;
};

// Content Pages Pagination Component
function ContentPages({ content, startPageNumber = 2, isSimplePreview = false }) {
  const pages = useMemo(() => {
    if (!content) return [];

    const PAGE_HEIGHT_ESTIMATE = 880;
    const PADDING_BUFFER = 70;
    const pagesList = [];
    const lines = content.split('\n');
    let currentPageLines = [];
    let currentPageLineIndices = [];
    let currentPageHeight = 0;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const lineHeight = estimateLineHeight(line);
      const isNestedItem = line.match(/^\s+([-*+]|\d+\.)/);
      const isMainItem = line.match(/^([-*+]|\d+\.)\s/);

      if (isMainItem && !isNestedItem) {
        let blockHeight = lineHeight;
        let j = i + 1;
        let block = [line];
        let blockIndices = [i];

        while (j < lines.length) {
          const nextLine = lines[j];
          const nextIsNested = nextLine.match(/^\s+([-*+]|\d+\.)/);
          const nextIsMainItem = nextLine.match(/^([-*+]|\d+\.)\s/);
          const nextIsEmpty = nextLine.trim() === '';

          if (nextIsMainItem && !nextIsNested) break;

          if (nextIsNested || nextIsEmpty) {
            const nextHeight = estimateLineHeight(nextLine);
            block.push(nextLine);
            blockIndices.push(j);
            blockHeight += nextHeight;
            j++;
          } else {
            break;
          }
        }

        if (currentPageHeight + blockHeight > PAGE_HEIGHT_ESTIMATE - PADDING_BUFFER && currentPageLines.length > 0) {
          const pageToSave = currentPageLines.join('\n').trimEnd();
          if (currentPageLines.length > 0 && currentPageLines[0].match(/^\s+/)) {
            const firstLineIndent = currentPageLines[0].match(/^(\s*)/)[1].length;
            if (firstLineIndent >= 4) {
              const contextIndices = getContextIndices(lines, currentPageLineIndices[0]);
              const firstContextIdx = contextIndices.length > 0 ? contextIndices[0] : -1;
              const firstPageIdx = currentPageLineIndices[0] || -1;
              if (firstContextIdx >= 0 && firstContextIdx < firstPageIdx) {
                const contextLines = contextIndices.map(idx => lines[idx]);
                pagesList.push({ context: contextLines.join('\n'), content: pageToSave });
              } else {
                pagesList.push({ context: '', content: pageToSave });
              }
            } else {
              pagesList.push({ context: '', content: pageToSave });
            }
          } else {
            pagesList.push({ context: '', content: pageToSave });
          }
          currentPageLines = block;
          currentPageLineIndices = blockIndices;
          currentPageHeight = blockHeight;
          i = j;
        } else {
          currentPageLines.push(...block);
          currentPageLineIndices.push(...blockIndices);
          currentPageHeight += blockHeight;
          i = j;
        }
      } else {
        if (currentPageHeight + lineHeight > PAGE_HEIGHT_ESTIMATE - PADDING_BUFFER && currentPageLines.length > 0) {
          const pageToSave = currentPageLines.join('\n').trimEnd();
          if (currentPageLines.length > 0 && currentPageLines[0].match(/^\s+/)) {
            const firstLineIndent = currentPageLines[0].match(/^(\s*)/)[1].length;
            if (firstLineIndent >= 4) {
              const contextIndices = getContextIndices(lines, currentPageLineIndices[0]);
              const firstContextIdx = contextIndices.length > 0 ? contextIndices[0] : -1;
              const firstPageIdx = currentPageLineIndices[0] || -1;
              if (firstContextIdx >= 0 && firstContextIdx < firstPageIdx) {
                const contextLines = contextIndices.map(idx => lines[idx]);
                pagesList.push({ context: contextLines.join('\n'), content: pageToSave });
              } else {
                pagesList.push({ context: '', content: pageToSave });
              }
            } else {
              pagesList.push({ context: '', content: pageToSave });
            }
          } else {
            pagesList.push({ context: '', content: pageToSave });
          }
          currentPageLines = [line];
          currentPageLineIndices = [i];
          currentPageHeight = lineHeight;
        } else {
          currentPageLines.push(line);
          currentPageLineIndices.push(i);
          currentPageHeight += lineHeight;
        }
        i++;
      }
    }

    if (currentPageLines.length > 0) {
      let contentToSave = currentPageLines.join('\n').trimEnd();
      let contextLines = [];
      if (currentPageLines.length > 0 && currentPageLines[0].match(/^\s+/)) {
        const firstLineIndent = currentPageLines[0].match(/^(\s*)/)[1].length;
        if (firstLineIndent >= 2) {
          const contextIndices = getContextIndices(lines, currentPageLineIndices[0]);
          if (contextIndices.length > 0) {
            const firstContextIdx = contextIndices[0];
            const firstPageIdx = currentPageLineIndices[0];
            if (firstContextIdx >= 0 && firstContextIdx < firstPageIdx) {
              const cLines = contextIndices.map(idx => lines[idx]);
              contextLines.push(...cLines, '');
            }
          }
        }
      }
      pagesList.push({ context: contextLines.join('\n').trimEnd(), content: contentToSave });
    }

    // Track code block state to prepend opening backticks when needed
    let inCodeBlock = false;
    let codeBlockIndent = '';
    
    // Track table state to carry over table headers across page breaks
    let inTable = false;
    let currentTableHeaders = [];

    const processedPages = pagesList.map(({context, content}) => {
      let processedContent = content;
      
      if (inCodeBlock) {
        if (!processedContent.trim().startsWith('```')) {
          processedContent = codeBlockIndent + '```\n' + processedContent;
        } else {
          // Strip orphaned closing backtick to prevent opening a misguided code block
          processedContent = processedContent.replace(/^\s*```[ \t]*(?:\r?\n)?/, '');
        }
      } else if (inTable && currentTableHeaders.length === 2) {
        // If the page broke mid-table, inject the captured table header so it renders properly
        const firstLine = processedContent.trimStart().split('\n')[0] || '';
        if (firstLine.startsWith('|')) {
          processedContent = currentTableHeaders[0] + '\n' + currentTableHeaders[1] + '\n' + processedContent;
        }
      }
      
      if (context) {
        processedContent = context + '\n' + processedContent;
      }
      
      // Re-evaluate state based on processedContent so blocks are properly paired
      let currentState = false;
      let currentIndent = '';
      const regex = /^(\s*)```/gm;
      let match;
      while ((match = regex.exec(processedContent)) !== null) {
        currentState = !currentState;
        if (currentState) {
          currentIndent = match[1];
        } else {
          currentIndent = '';
        }
      }
      
      inCodeBlock = currentState;
      codeBlockIndent = currentIndent;

      // Evaluate Markdown Tables state for the next logical page break
      if (!inCodeBlock) {
        const pLines = processedContent.split('\n');
        let currentlyInTable = false;
        let recentHeader = [];
        
        for (let idx = 0; idx < pLines.length; idx++) {
          const l = pLines[idx].trim();
          if (l.startsWith('|')) {
            if (!currentlyInTable) {
              currentlyInTable = true;
              if (idx + 1 < pLines.length && pLines[idx+1].trim().startsWith('|') && pLines[idx+1].includes('-')) {
                recentHeader = [pLines[idx], pLines[idx+1]];
              } else {
                recentHeader = [pLines[idx], "|---|"]; // Safe fallback schema
              }
            }
          } else if (l !== '') {
            currentlyInTable = false;
          }
        }
        
        inTable = currentlyInTable;
        if (inTable && recentHeader.length === 2) {
            currentTableHeaders = recentHeader;
        }
      } else {
        inTable = false;
      }
      
      return processedContent;
    });

    return processedPages.length > 0 ? processedPages : [''];
  }, [content]);

  if (pages.length === 0) return null;

  if (isSimplePreview) {
    return (
      <div className="w-full prose prose-stone max-w-none space-y-8 prose-headings:font-display prose-headings:font-bold prose-headings:text-stone-900 prose-headings:mt-4 prose-headings:mb-2 prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:font-handwriting prose-p:text-[14px] prose-p:leading-relaxed prose-p:my-2 prose-ul:my-2 prose-ul:ml-4 prose-ul:prose-ul:ml-6 prose-ol:my-2 prose-ol:ml-4 prose-ol:prose-ol:ml-6 prose-li:my-0.5 prose-li:marker:font-bold prose-em:italic prose-em:text-stone-700 prose-code:bg-stone-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-blockquote:my-2 prose-blockquote:border-l-4 prose-blockquote:border-yellow-400 prose-blockquote:pl-3 prose-blockquote:bg-yellow-50 prose-blockquote:italic">
        {pages.map((pageContent, index) => (
          <div key={index} className="pb-6 border-b-2 border-stone-200 last:border-b-0 w-full">
            <p className="text-xs font-semibold text-stone-500 mb-3 px-2 py-1 bg-stone-100 rounded inline-block">Page {startPageNumber + index}</p>
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex]}
              components={{
                code: ({ inline, children, ...props }) => {
                  if (inline) {
                    return <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs text-black break-words" {...props}>{children}</code>;
                  }
                  return <code className="bg-gray-100 text-black break-words" {...props}>{children}</code>;
                },
                pre: ({ children, ...props }) => (
                  <pre className="bg-gray-100 border border-gray-300 rounded-lg p-4 text-black whitespace-pre-wrap break-words overflow-hidden" {...props}>
                    {children}
                  </pre>
                ),
                strong: HighlightedStrong
              }}
            >
              {pageContent}
            </ReactMarkdown>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {pages.map((pageContent, index) => (
        <div
          key={index}
          data-a4-page="true"
          className="relative flex-shrink-0 bg-white rounded-lg shadow-2xl mb-4"
          style={{
            width: '210mm',
            height: '297mm',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            pageBreakAfter: 'always'
          }}
        >
          {/* Page Header - Blank space with border */}
          <div className="px-6 pt-6 pb-3 border-b-2 border-stone-300 flex-shrink-0">
            {/* Blank header space */}
          </div>

          {/* Content - Full page except footer */}
          <div
            className="flex-1 overflow-hidden px-6 pt-4 pb-0 prose prose-sm prose-stone max-w-none"
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              fontSize: '13px',
              lineHeight: '1.5'
            }}
          >
            <div className="w-full">
              <ReactMarkdown
                remarkPlugins={[remarkMath, remarkGfm]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  code: ({ inline, children, ...props }) => {
                    if (inline) {
                      return <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs text-black break-words" {...props}>{children}</code>;
                    }
                    return <code className="bg-gray-100 text-black break-words" {...props}>{children}</code>;
                  },
                  pre: ({ children, ...props }) => (
                    <pre className="bg-gray-100 border border-gray-300 rounded-lg p-4 text-black whitespace-pre-wrap break-words overflow-hidden" {...props}>
                      {children}
                    </pre>
                  ),
                  strong: HighlightedStrong
                }}
              >
                {pageContent}
              </ReactMarkdown>
            </div>
          </div>

          {/* Footer with page number */}
          <div className="px-6 py-3 border-t border-gray-300 flex justify-between items-center flex-shrink-0 text-xs">
            <span className="text-stone-400">Morom Notes</span>
            <span className="text-stone-500">Page {startPageNumber + index}</span>
          </div>
        </div>
      ))}
    </>
  );
}

const HighlightedStrong = ({ children, ...props }) => {
  return (
    <strong
      className="bg-yellow-100 text-black font-semibold px-1 rounded"
      {...props}
    >
      {children}
    </strong>
  );
};

export default function EditorPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  // State Management
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [isRenamingTitle, setIsRenamingTitle] = useState(false);
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [showViewBanner, setShowViewBanner] = useState(false);
  const [bannerType, setBannerType] = useState('');

  // Refs
  const exportRef = useRef(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!token) navigate('/login');
  }, [token, navigate]);

  // Check device and window state
  useEffect(() => {
    const checkViewRecommend = () => {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (isMobile) {
        setBannerType('mobile');
        setShowViewBanner(true);
      } else {
        const isFullscreen = window.innerHeight === window.screen.height;
        if (!isFullscreen) {
          setBannerType('fullscreen');
          setShowViewBanner(true);
        } else {
          setShowViewBanner(false);
        }
      }
    };
    
    checkViewRecommend();
    window.addEventListener('resize', checkViewRecommend);
    return () => window.removeEventListener('resize', checkViewRecommend);
  }, []);

  // Fetch note data
  useEffect(() => {
    const fetchNote = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await authFetch(`/api/notes/${id}`);

        if (!res.ok) {
          throw new Error('Failed to load note');
        }

        const data = await res.json();
        setNote(data);
        setEditContent(data.content || '');
        setEditTitle(data.title || '');
        
        // Track last opened timestamp for Dashboard sorting
        try {
          const lastOpened = JSON.parse(localStorage.getItem('noteLastOpened') || '{}');
          lastOpened[id] = Date.now();
          localStorage.setItem('noteLastOpened', JSON.stringify(lastOpened));
        } catch (e) {
          console.error("Failed to track last opened timestamp");
        }
      } catch (err) {
        console.error('Error fetching note:', err);
        setError(err.message || 'Failed to load note');
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchNote();
  }, [id]);

  // Save title changes
  const handleSaveTitle = async () => {
    if (!editTitle.trim()) {
      setIsRenamingTitle(false);
      setEditTitle(note.title);
      return;
    }

    try {
      setIsSavingTitle(true);
      const res = await authFetch(`/api/notes/${id}/rename`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle.trim() })
      });

      if (res.ok) {
        setNote({ ...note, title: editTitle.trim() });
        setIsRenamingTitle(false);
      } else {
        alert('Failed to rename note');
      }
    } catch (err) {
      console.error('Error saving title:', err);
      alert('Error saving title');
    } finally {
      setIsSavingTitle(false);
    }
  };

  // Save content changes
  const handleSaveContent = async () => {
    try {
      setIsSaving(true);
      const res = await authFetch(`/api/notes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent })
      });

      if (res.ok) {
        setNote({ ...note, content: editContent });
        setIsEditing(false);
        alert('Note saved successfully!');
      } else {
        alert('Failed to save note');
      }
    } catch (err) {
      console.error('Error saving note:', err);
      alert('Error saving note');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle favorite
  const handleToggleFavorite = async () => {
    try {
      const res = await authFetch(`/api/notes/${id}/favorite`, {
        method: 'PUT'
      });

      if (res.ok) {
        const data = await res.json();
        setNote({ ...note, is_favorite: data.is_favorite });
      }
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  // Export PDF
  const handleExportPDF = async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      if (!exportRef.current) {
        alert('Error: Content not found');
        setIsExporting(false);
        return;
      }

      // Wait for content to fully render
      await new Promise(r => setTimeout(r, 800));

      const sanitizedTitle = (note.title || 'notes')
        .replace(/[<>:"?*\\/]/g, '-')
        .substring(0, 50);

      // Get all A4 pages
      const pageElements = exportRef.current.querySelectorAll('[data-a4-page="true"]');
      
      if (pageElements.length === 0) {
        alert('No pages found to export');
        setIsExporting(false);
        return;
      }

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Capture each page
      for (let i = 0; i < pageElements.length; i++) {
        const pageElement = pageElements[i];

        try {
          const canvas = await html2canvas(pageElement, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false,
            height: pageElement.scrollHeight,
            width: pageElement.scrollWidth
          });

          const imgData = canvas.toDataURL('image/png');

          if (i > 0) {
            pdf.addPage();
          }

          // Add image to fill page
          pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
        } catch (pageErr) {
          console.error(`Error processing page ${i + 1}:`, pageErr);
        }
      }

      pdf.save(`${sanitizedTitle}.pdf`);
      alert('PDF exported successfully!');
    } catch (err) {
      console.error('Error exporting PDF:', err);
      alert('Error exporting PDF: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
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
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
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

  // Helper to check if YouTube URL
  const isYoutubeUrl = (url) => {
    return url && (url.includes('youtube.com') || url.includes('youtu.be'));
  };

  return (
    <div className="h-screen w-full flex bg-gray-100">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4 shadow-sm sticky top-0 z-20">
          <div className="flex items-center justify-between gap-4">
            {/* Title */}
            <div className="flex-1">
              {!isRenamingTitle ? (
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-stone-900">{note?.title || 'Untitled Note'}</h1>
                  <button
                    onClick={() => {
                      setIsRenamingTitle(true);
                      setEditTitle(note.title);
                    }}
                    className="p-1 hover:bg-gray-100 rounded transition"
                    title="Rename"
                  >
                    ✏️
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="flex-1 px-3 py-2 border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    placeholder="Note title"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveTitle}
                    disabled={isSavingTitle}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setIsRenamingTitle(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition font-medium"
                title="Go Back"
              >
                <ArrowLeft size={18} />
                Back
              </button>


              <button
                onClick={handleToggleFavorite}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition font-medium ${
                  note?.is_favorite
                    ? 'bg-red-50 text-red-600 hover:bg-red-100'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                title={note?.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Heart
                  size={18}
                  fill={note?.is_favorite ? 'currentColor' : 'none'}
                />
                Like
              </button>

              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                >
                  <span role="img" aria-label="edit">✏️</span>
                  Edit
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditContent(note?.content || '');
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveContent}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
                  >
                    <Save size={18} />
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </>
              )}



              <button
                onClick={handleExportPDF}
                disabled={isExporting}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition font-medium"
              >
                <Download size={18} />
                {isExporting ? 'Exporting...' : 'PDF'}
              </button>

              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center justify-center w-10 h-10 text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* View Recommendation Banner */}
        {showViewBanner && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between z-10 flex-shrink-0 shadow-sm">
            <div className="flex items-center gap-3 text-sm text-amber-800 font-medium">
              <span className="text-lg leading-none" role="img" aria-label="tip">💡</span>
              {bannerType === 'mobile' 
                ? "For the best experience, please use 'Desktop Site' mode in your mobile browser settings."
                : "For the best reading experience, consider making your browser Fullscreen (F11)."}
            </div>
            <button 
              onClick={() => setShowViewBanner(false)}
              className="text-amber-700 hover:bg-amber-200 rounded-full p-1 transition ml-4 flex-shrink-0"
              title="Dismiss"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Content Area - Full Screen Pages with Browser Scrolling */}
        <div
          ref={exportRef}
          className={`flex-1 overflow-x-hidden bg-gradient-to-b from-gray-100 to-gray-200 ${isEditing ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'} ${isExporting ? 'pdf-export-active' : ''}`}
          style={{
            scrollBehavior: 'smooth',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: '1rem',
            paddingBottom: '1rem'
          }}
        >
          {isEditing ? (
            // Edit Mode - Side-by-Side Editor and Live Preview
            <div className="w-full max-w-7xl mx-auto bg-[#fffdf8] rounded-lg shadow-lg p-6 border border-stone-200 flex flex-col flex-1 min-h-0">
              <div className="mb-4 pb-4 border-b border-stone-300">
                <h2 className="text-2xl font-bold text-stone-800 font-serif">Edit Pages</h2>
                <p className="text-sm text-stone-600 mt-1">Edit your content in Markdown on the left and see the live preview on the right.</p>
              </div>

              <div className="grid grid-cols-2 gap-6 flex-1 min-h-0">
                {/* Markdown Editor - Full Content */}
                <div className="flex flex-col h-full min-h-0">
                  <div className="flex items-center justify-between relative flex-shrink-0 mb-2">
                    <label className="text-sm font-semibold text-stone-700 block">Markdown Content</label>
                    <details className="text-xs group">
                      <summary className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium list-none relative z-10">
                        📝 Syntax Guide
                      </summary>
                      {/* Using absolute positioning and high z-index to overlay across bounds */}
                      <div className="absolute right-0 top-full bg-white border border-stone-300 rounded-lg p-4 shadow-2xl z-50 mt-1 w-96 text-stone-700 space-y-2.5 max-h-[60vh] overflow-y-auto">
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-stone-600">📌 Headings</p>
                          <p><code className="bg-stone-100 px-1.5 py-0.5 rounded text-xs"># Heading 1</code></p>
                          <p><code className="bg-stone-100 px-1.5 py-0.5 rounded text-xs">## Heading 2</code></p>
                          <p><code className="bg-stone-100 px-1.5 py-0.5 rounded text-xs">### Heading 3</code></p>
                        </div>
                        
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-stone-600">✏️ Text Formatting</p>
                          <p><code className="bg-stone-100 px-1.5 py-0.5 rounded text-xs">**bold text**</code> → <strong>bold text</strong></p>
                          <p><code className="bg-stone-100 px-1.5 py-0.5 rounded text-xs">*italic text*</code> → <em>italic text</em></p>
                          <p><code className="bg-stone-100 px-1.5 py-0.5 rounded text-xs">***bold italic***</code> → <strong><em>bold italic</em></strong></p>
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-stone-600">📋 Lists</p>
                          <p><code className="bg-stone-100 px-1.5 py-0.5 rounded text-xs">- Item 1</code></p>
                          <p><code className="bg-stone-100 px-1.5 py-0.5 rounded text-xs">1. First item</code></p>
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-stone-600">💻 Code</p>
                          <p><code className="bg-stone-100 px-1.5 py-0.5 rounded text-xs">`inline code`</code></p>
                          <p className="text-xs"><code className="bg-stone-100 px-1.5 py-0.5 rounded">```</code> on 3 lines = code block</p>
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-stone-600">📌 Quotes & Links</p>
                          <p><code className="bg-stone-100 px-1.5 py-0.5 rounded text-xs">{'>'} Quote text</code></p>
                          <p><code className="bg-stone-100 px-1.5 py-0.5 rounded text-xs">[Link](url)</code></p>
                        </div>
                      </div>
                    </details>
                  </div>
                  
                  <div className="relative flex-1 min-h-0 w-full">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="absolute inset-0 w-full h-full bg-white border-2 border-blue-400 rounded-lg p-4 font-mono text-[13px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-stone-800 caret-blue-600 resize-none overflow-y-auto block"
                      spellCheck="true"
                    />
                  </div>
                </div>

                {/* Live Preview - Paginated Output */}
                <div className="flex flex-col h-full min-h-0">
                  <label className="text-sm font-semibold text-stone-700 block flex-shrink-0 mb-2">Live Preview (All Pages)</label>
                  
                  <div className="relative flex-1 min-h-0 w-full">
                    <div className="absolute inset-0 w-full h-full bg-white border-2 border-stone-300 rounded-lg py-4 px-6 overflow-y-auto block">
                      <ContentPages content={editContent} startPageNumber={1} isSimplePreview={true} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Preview Mode - Paginated A4 pages
            <>
              {/* Cover Page */}
              <div
                data-a4-page="true"
                className="relative flex-shrink-0 bg-gradient-to-b from-[#fffdf8] via-[#fafaf8] to-[#f5f4f0] rounded-lg shadow-2xl"
                style={{
                  width: '210mm',
                  height: '297mm',
                  margin: '0 auto'
                }}
              >
                {/* Background Accent - Top */}
                <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-slate-900/5 to-transparent pointer-events-none"></div>

                {/* Decorative Top Line */}
                <div className="absolute top-20 left-10 right-10 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent pointer-events-none"></div>

                {/* Logo Watermark */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <img
                    src={logoImage}
                    alt="Logo watermark"
                    className="w-96 h-96 object-contain opacity-5 rounded-[30%]"
                  />
                </div>

                {/* Cover Page Content */}
                <div className="flex flex-col items-center justify-center h-full gap-8 relative z-10 px-12 py-16">

                  {/* Top Spacer */}
                  <div className="flex-1"></div>

                  {/* Title Section */}
                  <div className="text-center max-w-2xl">
                    <div className="flex items-center justify-center gap-4 mb-6">
                      <h1 className="text-5xl font-bold text-slate-900 font-serif leading-tight">
                        {note?.title || 'Untitled Notes'}
                      </h1>
                    </div>
                    {/* Elegant Divider */}
                    <div className="flex items-center justify-center gap-4 mb-8">
                      <div className="flex-1 h-px bg-gradient-to-r from-transparent to-slate-300"></div>
                      <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                      <div className="flex-1 h-px bg-gradient-to-l from-transparent to-slate-300"></div>
                    </div>
                  </div>

                  {/* Source Information */}
                  <div className="text-center max-w-xl">
                    {note?.source_type && (
                      <div className="space-y-2">
                        <p className="text-sm text-slate-500 font-light uppercase tracking-widest">
                          Source
                        </p>
                        {isYoutubeUrl(note?.video_url) ? (
                          <>
                            <p className="text-base text-slate-600 font-light">
                              YouTube Video
                            </p>
                            {note?.video_url && (
                              <a
                                href={note.video_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block text-slate-500 hover:text-slate-700 break-all font-light text-xs bg-slate-100 px-4 py-2 rounded transition-colors"
                              >
                                {note.video_url.length > 50 ? note.video_url.substring(0, 50) + '...' : note.video_url}
                              </a>
                            )}
                          </>
                        ) : (
                          <p className="text-base text-slate-600 font-light">
                            {note.source_type}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Spacer */}
                  <div className="flex-1"></div>

                  {/* Bottom Divider */}
                  <div className="w-12 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent"></div>

                  {/* AI Generated Badge */}
                  <div className="text-center space-y-3 pb-6">
                    <p className="text-2xl font-bold text-slate-700 font-serif">
                      Morom Notes
                    </p>
                    <p className="text-xs text-slate-400 font-light">
                      AI-Powered Note Generation
                    </p>
                  </div>
                </div>
              </div>

              {/* Content Pages - Dynamically generated */}
              {note?.content && (
                <ContentPages 
                  content={note.content}
                  startPageNumber={2}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Floating Chat Overlay - Hidden in edit mode */}
      {!isEditing && (
        <StudyBuddy
          noteId={id}
          content={editContent || note?.content || ''}
          onNotesUpdate={(newContent) => {
            setEditContent(newContent);
            setNote({ ...note, content: newContent });
          }}
        />
      )}
    </div>
  );
}
