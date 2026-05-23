import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authFetch } from '../api/api';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import logoImage from '../assets/logo.jpeg';
import StudyBuddy from '../components/StudyBuddy';
import { Star, Edit2, Eye, Download } from 'lucide-react';

// Helper function to extract source information from note
const getSourceInfo = (note) => {
  // If user provided a link, use it as the source
  if (note.video_url) {
    return {
      sourceType: 'Link',
      displayText: 'YouTube Video',
      sourceUrl: note.video_url.trim(),
      isYoutube: true
    };
  }

  // Otherwise use source_type for file-based sources
  if (!note.source_type) {
    return { sourceType: 'unknown', displayText: 'Unknown Source', sourceUrl: '', isYoutube: false };
  }

  const sourceTypeStr = note.source_type.toLowerCase();

  if (sourceTypeStr.includes('pdf')) {
    return { sourceType: 'PDF', displayText: `Uploaded PDF`, sourceUrl: '', isYoutube: false };
  } else if (sourceTypeStr.includes('ppt')) {
    return { sourceType: 'PowerPoint', displayText: `Uploaded PowerPoint`, sourceUrl: '', isYoutube: false };
  } else if (sourceTypeStr.includes('image') || sourceTypeStr.includes('img')) {
    return { sourceType: 'Image', displayText: `Uploaded Image`, sourceUrl: '', isYoutube: false };
  } else if (sourceTypeStr.includes('video')) {
    return { sourceType: 'Video', displayText: `Uploaded Video`, sourceUrl: '', isYoutube: false };
  }

  return { sourceType: 'Unknown', displayText: 'Generated from: Unknown Source', sourceUrl: '', isYoutube: false };
};

export default function EditorPage() {

  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [isSavingContent, setIsSavingContent] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [isRenamingNote, setIsRenamingNote] = useState(false);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [isTitleHovered, setIsTitleHovered] = useState(false);
  const [titleInputWidth, setTitleInputWidth] = useState('auto');

  const titleInputRef = useRef(null);
  const titleMeasureRef = useRef(null);
  
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [note, setNote] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const printRef = useRef(null);

  useEffect(() => {
    if (!token) navigate('/login');
  }, [token, navigate]);

  // Check for mobile/fullscreen on component mount
  useEffect(() => {
    const checkMobileAndFullscreen = () => {
      // Check if mobile
      const isMobile = /iPhone|iPad|iPod|Android|Windows Phone|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobileDevice(isMobile);

      // Check if fullscreen
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);

      // Show prompt if needed
      if (isMobile) {
        setShowFullscreenPrompt(true);
      } else if (!isCurrentlyFullscreen) {
        setShowFullscreenPrompt(true);
      }
    };

    // Check on mount
    checkMobileAndFullscreen();

    // Listen for fullscreen changes
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
      if (isCurrentlyFullscreen) {
        setShowFullscreenPrompt(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const requestFullscreen = async () => {
    const elem = document.documentElement;
    try {
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      } else if (elem.mozRequestFullScreen) {
        await elem.mozRequestFullScreen();
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen();
      }
    } catch (error) {
      console.error('Error requesting fullscreen:', error);
    }
  };

  useEffect(() => {
    const fetchNote = async () => {
      try {
        setFetchError(null);
        const res = await authFetch(`/api/notes/${id}`);
        if (res.ok) {
          const data = await res.json();
          setNote(data);
          setEditedContent(data.content);
          setNewNoteTitle(data.title);
          setIsEditingContent(false);
        } else {
          setFetchError('Failed to load note. Please try again.');
        }
      } catch (e) {
        console.error(e);
        setFetchError('Error loading note: ' + (e.message || 'Unknown error'));
      }
    };

    fetchNote();
  }, [id]);

  // Measure and adjust title input width based on content
  useEffect(() => {
    if (isRenamingNote && titleMeasureRef.current) {
      const measureSpan = titleMeasureRef.current;
      measureSpan.textContent = newNoteTitle || 'Note title';
      const width = measureSpan.offsetWidth + 24; // Add padding
      const maxWidth = 180 * 16; // 180 * 16px = 2880px (which is ~95% of 210mm at standard DPI)
      const finalWidth = Math.min(width, maxWidth);
      setTitleInputWidth(finalWidth + 'px');
    }
  }, [newNoteTitle, isRenamingNote]);

  // Focus input when entering rename mode (only once)
  useEffect(() => {
    if (isRenamingNote && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [isRenamingNote]);

  const handleRenameNote = async () => {
    if (!newNoteTitle.trim()) {
      setIsRenamingNote(false);
      setNewNoteTitle(note?.title || '');
      return;
    }

    setIsSavingTitle(true);
    try {
      const res = await authFetch(`/api/notes/${id}/rename`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newNoteTitle.trim() })
      });

      if (res.ok) {
        setNote(prev => ({ ...prev, title: newNoteTitle.trim() }));
        setIsRenamingNote(false);
      } else {
        alert('Failed to rename note');
      }
    } catch (e) {
      console.error(e);
      alert('Error renaming note: ' + (e.message || 'Unknown error'));
    } finally {
      setIsSavingTitle(false);
    }
  };

  /* --------------------------------------- */
  /* SMART PAGE SPLITTING (space efficient) */
  /* --------------------------------------- */

  // Helper function to estimate line height
  const estimateLineHeight = (line) => {
    const ESTIMATED_LINE_HEIGHT = 27; 
    let lineHeight = ESTIMATED_LINE_HEIGHT;

    if (line.match(/^#{1,6}\s/)) {
      // Heading: allocate more space (but tighter than before)
      const headingLevel = line.match(/^#+/)[0].length;
      if (headingLevel === 1) lineHeight = 50; // h1
      else if (headingLevel === 2) lineHeight = 40; // h2
      else if (headingLevel === 3) lineHeight = 36; // h3
      else lineHeight = 32; // h4, h5, h6
    } else if (line.match(/^>\s/)) {
      // Blockquote: tighter packing
      lineHeight = Math.ceil(line.length / 80) * ESTIMATED_LINE_HEIGHT + 10;
    } else if (line.match(/^[-*+]\s/) || line.match(/^\d+\.\s/)) {
      // List item: tighter
      const charCount = line.length;
      const estimatedWraps = Math.ceil(charCount / 95); // increased from 90
      lineHeight = (estimatedWraps * ESTIMATED_LINE_HEIGHT) + 3; // reduced from 5
    } else if (line.match(/^\s+[-*+]\s/) || line.match(/^\s+\d+\.\s/)) {
      // Nested list item: tighter
      const charCount = line.length;
      const estimatedWraps = Math.ceil(charCount / 90); // increased from 85
      lineHeight = (estimatedWraps * ESTIMATED_LINE_HEIGHT) + 3; // reduced from 5
    } else if (line.trim() === '') {
      // Empty line: minimal
      lineHeight = 8;
    } else {
      // Regular paragraph
      const charCount = line.length;
      if (charCount > 100) {
        const estimatedWraps = Math.ceil(charCount / 100); // increased from 95
        lineHeight = estimatedWraps * ESTIMATED_LINE_HEIGHT;
      }
    }

    return lineHeight;
  };
  const getContextIndices = (lines, lineIndex) => {
    // If this line is not nested, no context needed
    if (lineIndex < 0 || lineIndex >= lines.length) return [];
    
    const line = lines[lineIndex];
    const lineIndent = line.match(/^(\s*)/)[1].length;
    
    if (lineIndent === 0) return [];
    
    const contextIndices = [];
    let currentSearchIndent = lineIndent;
    
    // Look backwards, but ONLY up to 50 lines to avoid adding unrelated parents
    const searchLimit = Math.max(0, lineIndex - 50);
    
    // Look backwards to find all parent items
    for (let i = lineIndex - 1; i >= searchLimit; i--) {
      const prevLine = lines[i];
      
      if (prevLine.trim() === '') continue;
      
      const prevIndent = prevLine.match(/^(\s*)/)[1].length;
      const isListItem = prevLine.match(/^\s*[-*+\d.]\s/);
      
      // If this line has less indentation and is a list item, it's a parent
      if (isListItem && prevIndent < currentSearchIndent) {
        contextIndices.unshift(i);
        currentSearchIndent = prevIndent;
      }
    }
    
    return contextIndices;
  };

  // Get parent heading/context for proper markdown rendering across pages
  const getParentContext = (lines, lineIndex) => {
    if (lineIndex < 0 || lineIndex >= lines.length) return [];
    
    const contextLines = [];
    const searchLimit = Math.max(0, lineIndex - 150);
    
    // Look backwards for the most recent heading
    for (let i = lineIndex - 1; i >= searchLimit; i--) {
      const line = lines[i];
      if (line.match(/^#{1,6}\s/)) {
        contextLines.unshift(line);
        break; // Only need the most recent heading
      }
    }
    
    return contextLines;
  };

  // Memoize getPages to prevent recalculation on every render
  const contentPages = useMemo(() => {
    if (!editedContent) return [];

    const PAGE_HEIGHT_ESTIMATE = 940;
    const PADDING_BUFFER = 80;

    const pages = [];
    const lines = editedContent.split('\n');
    let currentPageLines = [];
    let currentPageLineIndices = []; // Track original line indices
    let currentPageHeight = 0;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const lineHeight = estimateLineHeight(line);
      const isNestedItem = line.match(/^\s+[-*+\d.]/);
      const isMainItem = line.match(/^[-*+\d.]\s/);

      // If this is a main topic/item, collect it with all following nested items
      if (isMainItem && !isNestedItem) {
        let blockHeight = lineHeight;
        let j = i + 1;
        let block = [line];
        let blockIndices = [i];

        // Collect all immediately following nested items (sub-bullets) and empty lines
        while (j < lines.length) {
          const nextLine = lines[j];
          const nextIsNested = nextLine.match(/^\s+[-*+\d.]/);
          const nextIsMainItem = nextLine.match(/^[-*+\d.]\s/);
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

        // Check if this block fits
        if (currentPageHeight + blockHeight > PAGE_HEIGHT_ESTIMATE - PADDING_BUFFER && currentPageLines.length > 0) {
          // Block won't fit, save current page
          const pageToSave = currentPageLines.join('\n').trim();
          
          // Only add context if the page starts with a deeply nested item (3+ levels)
          // This avoids adding unrelated parent context from earlier sections
          if (currentPageLines.length > 0 && currentPageLines[0].match(/^\s+[-*+\d.]/)) {
            const firstLineIndent = currentPageLines[0].match(/^(\s*)/)[1].length;
            // Only add context for deeply nested items (more than 2 indent levels = 4+ spaces)
            if (firstLineIndent >= 4) {
              const contextIndices = getContextIndices(lines, currentPageLineIndices[0]);
              const firstContextIdx = contextIndices.length > 0 ? contextIndices[0] : -1;
              const firstPageIdx = currentPageLineIndices[0] || -1;
              
              if (firstContextIdx >= 0 && firstContextIdx < firstPageIdx) {
                const contextLines = contextIndices.map(idx => lines[idx]);
                pages.push([...contextLines, ...currentPageLines].join('\n').trim());
              } else {
                pages.push(pageToSave);
              }
            } else {
              pages.push(pageToSave);
            }
          } else {
            pages.push(pageToSave);
          }
          
          currentPageLines = block;
          currentPageLineIndices = blockIndices;
          currentPageHeight = blockHeight;
          i = j;
        } else {
          // Block fits, add to current page
          currentPageLines.push(...block);
          currentPageLineIndices.push(...blockIndices);
          currentPageHeight += blockHeight;
          i = j;
        }
      } else {
        // Regular line or non-list content
        if (currentPageHeight + lineHeight > PAGE_HEIGHT_ESTIMATE - PADDING_BUFFER && currentPageLines.length > 0) {
          // Prepare page with context if needed
          const pageToSave = currentPageLines.join('\n').trim();
          
          if (currentPageLines.length > 0 && currentPageLines[0].match(/^\s+[-*+\d.]/)) {
            const firstLineIndent = currentPageLines[0].match(/^(\s*)/)[1].length;
            // Only add context for deeply nested items (4+ spaces)
            if (firstLineIndent >= 4) {
              const contextIndices = getContextIndices(lines, currentPageLineIndices[0]);
              const firstContextIdx = contextIndices.length > 0 ? contextIndices[0] : -1;
              const firstPageIdx = currentPageLineIndices[0] || -1;
              
              if (firstContextIdx >= 0 && firstContextIdx < firstPageIdx) {
                const contextLines = contextIndices.map(idx => lines[idx]);
                pages.push([...contextLines, ...currentPageLines].join('\n').trim());
              } else {
                pages.push(pageToSave);
              }
            } else {
              pages.push(pageToSave);
            }
          } else {
            pages.push(pageToSave);
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

    // Add remaining lines to final page
    if (currentPageLines.length > 0) {
      let pageToSave = currentPageLines.join('\n').trim();
      
      // Add parent heading context for any content
      const parentHeadings = getParentContext(lines, currentPageLineIndices[0]);
      if (parentHeadings.length > 0 && !pageToSave.startsWith('#')) {
        pageToSave = [...parentHeadings, '', pageToSave].join('\n').trim();
      }
      
      // Add list item context for nested items
      if (currentPageLines.length > 0 && currentPageLines[0].match(/^\s+[-*+\d.]/)) {
        const firstLineIndent = currentPageLines[0].match(/^(\s*)/)[1].length;
        // Add context for any nested items (even single indent)
        if (firstLineIndent >= 2) {
          const contextIndices = getContextIndices(lines, currentPageLineIndices[0]);
          if (contextIndices.length > 0) {
            const firstContextIdx = contextIndices[0];
            const firstPageIdx = currentPageLineIndices[0];
            
            if (firstContextIdx >= 0 && firstContextIdx < firstPageIdx) {
              const contextLines = contextIndices.map(idx => lines[idx]);
              pageToSave = [...contextLines, '', pageToSave].join('\n').trim();
            }
          }
        }
      }
      
      pages.push(pageToSave);
    }

    // Disabled debug logging
    // if (pages.length > 0) {
    //   console.log('=== PAGE STRUCTURE DEBUG ===');
    //   pages.forEach((page, idx) => {
    //     console.log(`\n--- PAGE ${idx + 1} ---`);
    //     console.log('Raw content:');
    //     console.log(page);
    //     console.log('---');
    //   });
    // }

    return pages.length > 0 ? pages : [''];
  }, [editedContent]);

  const handleSaveContent = async () => {
    if (isSavingContent) return; // Prevent race conditions

    try {
      setIsSavingContent(true);
      const res = await authFetch(`/api/notes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editedContent })
      });

      if (res.ok) {
        setNote({ ...note, content: editedContent });
        setIsEditingContent(false);
        alert('Changes saved successfully!');
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error('Save failed:', res.status, errorData);
        alert(`Failed to save changes: ${errorData.detail || 'Unknown error'}`);
      }
    } catch (e) {
      console.error('Save error:', e);
      alert('Error saving: ' + (e.message || 'Unknown error'));
    } finally {
      setIsSavingContent(false);
    }
  };

  const handleToggleFavorite = async () => {
    try {
      const res = await authFetch(`/api/notes/${id}/favorite`, {
        method: "PUT",
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data = await res.json();
      setNote({ ...note, is_favorite: data.is_favorite });
    } catch (e) {
      console.error('Toggle favorite error:', e);
      alert('Error toggling favorite: ' + (e.message || 'Unknown error'));
    }
  };

  /* --------------------------------------- */
  /* PDF EXPORT */
  /* --------------------------------------- */

  const handleExportPDF = async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      // Import both libraries
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      const element = printRef.current;
      if (!element) {
        alert('Error: Could not find content to export');
        setIsExporting(false);
        return;
      }

      // Sanitize filename
      const sanitizedTitle = (note.title || "morom_notes")
        .replace(/[<>:"?*\\/]/g, '-')
        .substring(0, 50);

      // Wait for content to render
      await new Promise(r => setTimeout(r, 800));

      console.log('Starting PDF export...');
      console.log('Element height:', element.scrollHeight);
      console.log('Element width:', element.scrollWidth);

      // Get all page divs
      const pages = element.querySelectorAll('[data-pdf-page="true"]');
      console.log('Found pages:', pages.length);

      if (pages.length === 0) {
        alert('No content pages found. Make sure pages are marked with data-pdf-page="true"');
        setIsExporting(false);
        return;
      }

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: false
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      console.log('PDF dimensions:', pageWidth, 'x', pageHeight, 'mm');

      // Process each page
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        
        try {
          console.log(`Processing page ${i + 1}/${pages.length}...`);
          
          // Scroll page into view to ensure it renders
          page.scrollIntoView({ behavior: 'auto', block: 'start' });
          await new Promise(r => setTimeout(r, 100));

          // Get the actual rendered dimensions
          const rect = page.getBoundingClientRect();
          console.log(`Page ${i + 1} dimensions:`, rect.width, 'x', rect.height);

          // Convert page to canvas with explicit dimensions
          const canvas = await html2canvas(page, {
            scale: 1,
            useCORS: true,
            allowTaint: true,
            logging: true,
            backgroundColor: '#FFFFFF',
            windowHeight: page.scrollHeight || 1400,
            windowWidth: page.scrollWidth || 800,
            proxy: null
          });

          console.log(`Canvas created for page ${i + 1}:`, canvas.width, 'x', canvas.height);

          // Convert canvas to image
          const imgData = canvas.toDataURL('image/jpeg', 0.9);
          
          // Add to PDF
          if (i > 0) {
            pdf.addPage();
          }

          // Add image to fill the entire page
          pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);
          
          console.log(`Page ${i + 1} added to PDF`);
        } catch (pageErr) {
          console.error(`Error processing page ${i + 1}:`, pageErr);
          // Continue to next page instead of failing completely
        }
      }

      // Save PDF
      pdf.save(`${sanitizedTitle}.pdf`);
      console.log('PDF saved successfully');
      alert('PDF exported successfully!');

    } catch (err) {
      console.error('Error exporting PDF:', err);
      console.error('Error details:', {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      alert('Error exporting PDF: ' + (err.message || 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  };

  /* --------------------------------------- */

  if (!note)
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center flex-col gap-4">
        {fetchError ? (
          <>
            <p className="text-xl text-red-600 font-medium">⚠️ {fetchError}</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 bg-stone-700 text-white rounded-lg hover:bg-stone-800"
            >
              Return to Dashboard
            </button>
          </>
        ) : (
          <p className="text-xl text-stone-500">Loading notes...</p>
        )}
      </div>
    );

  return (

    <div
      className="h-screen w-full overflow-hidden bg-[#e5e5f7] font-sans flex text-stone-800"
      style={{
        backgroundImage: isExporting ? 'none' : 'radial-gradient(#c8cad0 1px, transparent 1px)',
        backgroundSize: '20px 20px'
      }}
    >

      {/* FULLSCREEN PROMPT MODAL */}
      {showFullscreenPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md mx-4">
            <h2 className="text-2xl font-bold text-stone-900 mb-4">
              {isMobileDevice ? "Desktop Mode Recommended" : "Enter Fullscreen Mode"}
            </h2>
            <p className="text-stone-700 mb-6">
              {isMobileDevice 
                ? "For the best editing experience, please switch to desktop mode. Mobile editing is not fully supported."
                : "For the best editing experience, please enter fullscreen mode to see all pages clearly."}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowFullscreenPrompt(false)}
                className="flex-1 px-4 py-2 rounded-lg bg-slate-200 text-slate-700 font-medium hover:bg-slate-300 transition"
              >
                {isMobileDevice ? "Continue Anyway" : "Skip"}
              </button>
              {!isMobileDevice && (
                <button
                  onClick={requestFullscreen}
                  className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2"
                >
                  <Eye size={18} />
                  Enter Fullscreen
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* LEFT SIDE NOTE VIEW */}

      <div className="flex-1 overflow-y-auto p-4 lg:p-8 flex flex-col items-center">

        <div className="w-[210mm] flex justify-between items-center mb-6">

          <div className="flex gap-3">

            <Link
              to="/dashboard"
              className="text-stone-500 hover:text-stone-800 font-medium bg-[#fffdf8]/80 px-4 py-2 rounded-full shadow-sm"
            >
              ← Desk
            </Link>

            <button
              onClick={() => navigate(-1)}
              className="text-stone-500 hover:text-stone-800 font-medium bg-[#fffdf8]/80 px-4 py-2 rounded-full shadow-sm"

            >

              ← Back </button>

          </div>

          <div className="flex gap-3 items-center">

            <button
              onClick={handleToggleFavorite}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition text-slate-600 text-sm font-medium flex items-center gap-2"
              title={note?.is_favorite ? "Remove from favorites" : "Add to favorites"}
            >
              <Star 
                size={18} 
                fill={note?.is_favorite ? "currentColor" : "none"} 
                strokeWidth={2}
              />
              Like
            </button>

            {!isEditingContent && (
              <button
                onClick={() => setIsEditingContent(true)}
                disabled={isSavingContent}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:bg-blue-400 flex items-center gap-2 transition"
              >
                <Edit2 size={18} />
                Edit
              </button>
            )}

            {isEditingContent && (
              <>
                <button
                  onClick={() => setIsEditingContent(false)}
                  disabled={isSavingContent}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:bg-blue-400 flex items-center gap-2 transition"
                >
                  <Eye size={18} />
                  Preview
                </button>
                <button
                  onClick={handleSaveContent}
                  disabled={isSavingContent}
                  className="px-5 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:bg-green-400 flex items-center gap-2 transition"
                >
                  {isSavingContent ? "Saving..." : "Save Changes"}
                </button>
              </>
            )}

            <button
              onClick={handleExportPDF}
              disabled={isExporting || isSavingContent || isRenamingNote}
              className="px-5 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2 transition"
            >
              <Download size={18} />
              {isExporting ? "Generating PDF..." : "PDF"}
            </button>

          </div>

        </div>

        {/* PAGE CONTAINER */}

        {isEditingContent ? (
          // EDIT MODE: Show all pages with edit/preview side-by-side
          <div className="w-full max-w-7xl bg-[#fffdf8] rounded-lg shadow-lg p-6 border border-stone-200">
            <div className="mb-4 pb-4 border-b border-stone-300">
              <h2 className="text-2xl font-bold text-stone-800 font-handwriting">Edit All Pages</h2>
              <p className="text-sm text-stone-600 mt-1">Edit your content in Markdown on the left and see the preview on the right</p>
            </div>

            <div className="grid grid-cols-2 gap-6 h-[600px]">
              {/* Markdown Editor - Full Content */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-stone-700 block">Markdown Content</label>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium">📝 Syntax Guide</summary>
                    <div className="absolute bg-white border border-stone-300 rounded-lg p-4 shadow-lg z-50 mt-2 w-96 text-stone-700 space-y-2.5 max-h-96 overflow-y-auto">
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
                        <p className="text-xs ml-4">Creates a bullet point list</p>
                        <p><code className="bg-stone-100 px-1.5 py-0.5 rounded text-xs">1. First item</code></p>
                        <p className="text-xs ml-4">Creates a numbered list</p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-stone-600">💻 Code</p>
                        <p><code className="bg-stone-100 px-1.5 py-0.5 rounded text-xs">`inline code`</code> → <code>inline code</code></p>
                        <p className="text-xs"><code className="bg-stone-100 px-1.5 py-0.5 rounded">```</code> on 3 lines = code block</p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-stone-600">📌 Quotes & Links</p>
                        <p><code className="bg-stone-100 px-1.5 py-0.5 rounded text-xs">{'>'}  Quote text</code> → Block quote</p>
                        <p><code className="bg-stone-100 px-1.5 py-0.5 rounded text-xs">[Link](url)</code> → Clickable link</p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-stone-600">🎨 Separators & More</p>
                        <p><code className="bg-stone-100 px-1.5 py-0.5 rounded text-xs">---</code> or <code className="bg-stone-100 px-1.5 py-0.5 rounded text-xs">***</code> → Horizontal line</p>
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded p-2 mt-2">
                        <p className="text-xs font-semibold text-blue-900 mb-1">💡 Example:</p>
                        <code className="text-xs block bg-white border border-blue-100 rounded p-2 font-mono whitespace-pre">
{`# My Title
This is **bold** and *italic*.
- Point 1
- Point 2
> Important quote`}
                        </code>
                      </div>
                    </div>
                  </details>
                </div>
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="w-full h-full bg-white border-2 border-blue-400 rounded-lg p-4 font-mono text-[13px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-stone-800 caret-blue-600 resize-none"
                  spellCheck="true"
                />
              </div>

              {/* Live Preview - All Pages Rendered */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-stone-700 block">Live Preview (All Pages)</label>
                <div className="h-full bg-white border-2 border-stone-300 rounded-lg p-4 overflow-y-auto">
                  <div className="prose prose-stone max-w-none space-y-8 prose-headings:font-display prose-headings:font-bold prose-headings:text-stone-900 prose-headings:mt-4 prose-headings:mb-2 prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:font-handwriting prose-p:text-[14px] prose-p:leading-relaxed prose-p:my-2 prose-ul:my-2 prose-ul:ml-4 prose-ul:prose-ul:ml-6 prose-ol:my-2 prose-ol:ml-4 prose-ol:prose-ol:ml-6 prose-li:my-0.5 prose-li:marker:font-bold prose-strong:bg-yellow-100 prose-strong:px-1 prose-strong:rounded prose-em:italic prose-em:text-stone-700 prose-code:bg-stone-100 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-blockquote:my-2 prose-blockquote:border-l-4 prose-blockquote:border-yellow-400 prose-blockquote:pl-3 prose-blockquote:bg-yellow-50 prose-blockquote:italic">
                    {contentPages.map((pageContent, idx) => (
                      <div key={idx} className="pb-6 border-b-2 border-stone-200 last:border-b-0">
                        <p className="text-xs font-semibold text-stone-500 mb-3 px-2 py-1 bg-stone-100 rounded inline-block">Page {idx + 1}</p>
                        <ReactMarkdown
                          remarkPlugins={[remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                          components={{
                            blockquote: ({ children }) => (
                              <div className="bg-yellow-100 border-l-4 border-yellow-400 p-2 rounded-md shadow-sm rotate-[-1deg] my-2 text-sm">
                                {children}
                              </div>
                            )
                          }}
                        >
                          {pageContent}
                        </ReactMarkdown>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // PREVIEW MODE: Show pages normally
          <div
            ref={printRef}
            className={`flex flex-col ${isExporting ? "gap-0 bg-white" : "gap-6"}`}
          >

            {/* COVER PAGE */}
            {note && (
              <div
                data-pdf-page="true"
                className="w-[210mm] h-[297mm] mx-auto bg-gradient-to-b from-[#fffdf8] via-[#fafaf8] to-[#f5f4f0] shadow-xl relative flex flex-col overflow-hidden flex-shrink-0"
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
                  <div 
                    className="text-center max-w-2xl"
                    onMouseEnter={() => setIsTitleHovered(true)}
                    onMouseLeave={() => setIsTitleHovered(false)}
                  >
                    {!isRenamingNote ? (
                      <>
                        <div className="flex items-center justify-center gap-4 mb-6">
                          <h1 className="text-5xl font-bold text-slate-900 font-serif leading-tight">
                            {note.title || 'Untitled Notes'}
                          </h1>
                          {isTitleHovered && (
                            <button
                              onClick={() => {
                                setIsRenamingNote(true);
                                setNewNoteTitle(note?.title || '');
                              }}
                              disabled={isSavingTitle}
                              className="text-slate-400 hover:text-slate-600 text-2xl transition flex-shrink-0"
                              title="Rename note"
                            >
                              ✏️
                            </button>
                          )}
                        </div>
                        {/* Elegant Divider */}
                        <div className="flex items-center justify-center gap-4 mb-8">
                          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-slate-300"></div>
                          <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-slate-300"></div>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-center gap-2 flex-col relative mb-6">
                        {/* Hidden span to measure title width */}
                        <span
                          ref={titleMeasureRef}
                          className="absolute invisible whitespace-nowrap text-5xl font-bold font-serif px-4 py-3"
                        />
                        <input
                          ref={titleInputRef}
                          type="text"
                          value={newNoteTitle}
                          onChange={(e) => setNewNoteTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameNote();
                            if (e.key === 'Escape') setIsRenamingNote(false);
                          }}
                          disabled={isSavingTitle}
                          autoFocus
                          style={{ width: titleInputWidth }}
                          className="px-4 py-3 rounded-lg bg-white border-2 border-slate-300 text-5xl font-bold font-serif focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:bg-slate-50 text-slate-900 transition-all"
                          placeholder="Note title"
                        />
                        <div className="flex gap-3 mt-4">
                          <button
                            onClick={handleRenameNote}
                            disabled={isSavingTitle}
                            className="px-4 py-2 rounded-lg bg-slate-700 text-white font-medium hover:bg-slate-800 disabled:bg-slate-400 transition"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setIsRenamingNote(false)}
                            disabled={isSavingTitle}
                            className="px-4 py-2 rounded-lg bg-slate-300 text-slate-700 font-medium hover:bg-slate-400 disabled:bg-slate-200 transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Source Information */}
                  <div className="text-center max-w-xl">
                    {(() => {
                      const sourceInfo = getSourceInfo(note);
                      return (
                        <>
                          {sourceInfo.isYoutube ? (
                            <div className="space-y-2">
                              <p className="text-sm text-slate-500 font-light uppercase tracking-widest">
                                Source
                              </p>
                              <p className="text-base text-slate-600 font-light">
                                YouTube Video
                              </p>
                              {sourceInfo.sourceUrl && (
                                <a
                                  href={sourceInfo.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-block text-slate-500 hover:text-slate-700 break-all font-light text-xs bg-slate-100 px-4 py-2 rounded transition-colors"
                                >
                                  {sourceInfo.sourceUrl.length > 50 ? sourceInfo.sourceUrl.substring(0, 50) + '...' : sourceInfo.sourceUrl}
                                </a>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <p className="text-sm text-slate-500 font-light uppercase tracking-widest">
                                Source
                              </p>
                              <p className="text-base text-slate-600 font-light">
                                {sourceInfo.displayText}
                              </p>
                            </div>
                          )}
                        </>
                      );
                    })()}
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
            )}

            {/* CONTENT PAGES */}
            {contentPages.map((pageContent, idx) => (

              <div
                key={idx}
                data-pdf-page="true"
                className={`w-[210mm] h-[297mm] mx-auto bg-[#fffdf8] shadow-xl relative flex flex-col justify-start pt-8 px-10 overflow-hidden flex-shrink-0 ${isExporting ? 'pb-8' : 'pb-20'}`}
              >

                {/* NOTE CONTENT */}

                <div className="flex-1 overflow-visible flex flex-col justify-start">

                  <div
                    className="
prose prose-stone max-w-none

prose-headings:font-display
prose-headings:font-bold
prose-headings:text-stone-900
prose-headings:mt-6
prose-headings:mb-4

prose-h1:text-3xl
prose-h2:text-2xl
prose-h3:text-xl

prose-p:font-handwriting
prose-p:text-[18px]
prose-p:leading-relaxed
prose-p:my-3
prose-p:not-first:mt-3

prose-ul:my-4
prose-ul:ml-6
prose-ul:prose-ul:ml-8

prose-ol:my-4
prose-ol:ml-6
prose-ol:prose-ol:ml-8

prose-li:my-1
prose-li:marker:font-bold

prose-strong:bg-yellow-100
prose-strong:px-1
prose-strong:rounded

prose-em:italic
prose-em:text-stone-700

prose-blockquote:my-4
prose-blockquote:border-l-4
prose-blockquote:border-stone-300
prose-blockquote:pl-4
prose-blockquote:ml-0
prose-blockquote:not-first:my-4

prose-code:bg-stone-100
prose-code:px-1.5
prose-code:py-0.5
prose-code:rounded
prose-code:text-sm
"
                    style={{ overflow: "visible" }}
                  >
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={{
                        blockquote: ({ children }) => (
                          <div className="bg-yellow-100 border-l-4 border-yellow-400 p-3 rounded-md shadow-sm rotate-[-1deg] my-2 font-handwriting">
                            {children}
                          </div>
                        )
                      }}
                    >
                      {pageContent}
                    </ReactMarkdown>
                  </div>
                </div>

                {/* FOOTER */}
                <div className="absolute bottom-6 left-10 right-10 border-t border-slate-200 pt-3 flex justify-between items-center text-slate-500 font-light text-xs tracking-wide">
                  <span className="flex-1">Morom Notes</span>
                  <span className="flex-1 text-right">Page {idx + 1} of {contentPages.length}</span>
                </div>

              </div>

            ))}

          </div>
        )}

      </div>

      {/* STUDY BUDDY CHAT */}
      <StudyBuddy 
        noteId={id}
        content={editedContent}
        onNotesUpdate={(newContent) => {
          setEditedContent(newContent);
          setNote(prev => ({ ...prev, content: newContent }));
        }}
      />

    </div>

  );
}
