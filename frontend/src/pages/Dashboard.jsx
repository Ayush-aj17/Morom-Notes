import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { authFetch } from '../api/api';
import { useToast } from '../components/Toast';
import AccountSwitcher from '../components/AccountSwitcher';
import logoImage from '../assets/logo.jpeg';
import { Heart } from 'lucide-react';

// Helper function to extract source information from note
const getSourceInfo = (note) => {
  // If user provided a link, use it as the source
  if (note.video_url) {
    return {
      sourceType: 'Link',
      displayText: 'YouTube Video',
      sourceUrl: note.video_url.trim(),
    };
  }

  // Otherwise use source_type for file-based sources
  if (!note.source_type) {
    return { sourceType: 'unknown', displayText: 'Unknown Source', sourceUrl: '' };
  }

  const sourceTypeStr = note.source_type.toLowerCase();

  if (sourceTypeStr.includes('pdf')) {
    return { sourceType: 'PDF', displayText: 'Uploaded PDF', sourceUrl: '' };
  } else if (sourceTypeStr.includes('ppt')) {
    return { sourceType: 'PowerPoint', displayText: 'Uploaded PowerPoint', sourceUrl: '' };
  } else if (sourceTypeStr.includes('image') || sourceTypeStr.includes('img')) {
    return { sourceType: 'Image', displayText: 'Uploaded Image', sourceUrl: '' };
  } else if (sourceTypeStr.includes('video')) {
    return { sourceType: 'Video', displayText: 'Uploaded Video', sourceUrl: '' };
  }

  return { sourceType: 'Unknown', displayText: 'Unknown Source', sourceUrl: '' };
};

// Helper function to format created date
const formatCreatedDate = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  // Less than 1 minute
  if (diffMins < 1) {
    return 'Just now';
  }
  // Less than 1 hour
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  // Less than 1 day
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  // Less than 7 days
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }
  
  // Format as date: "Jan 15, 3:45 PM"
  const options = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true };
  return date.toLocaleDateString('en-US', options);
};

export default function Dashboard() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();

  useEffect(() => {
    if (!token) navigate('/login');
  }, [token, navigate]);
  const [folders, setFolders] = useState([]);
  const [notes, setNotes] = useState([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [activeFolder, setActiveFolder] = useState(null);
  const [editingFolderId, setEditingFolderId] = useState(-1);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, type: null, id: null, ids: [], count: 0 });
  const [renameModal, setRenameModal] = useState({ isOpen: false, noteId: null, newTitle: '' });
  const [clipboard, setClipboard] = useState({ noteIds: [], operation: null, isBulk: false }); // 'copy' or 'cut'
  const [selectedNotes, setSelectedNotes] = useState(new Set());
  
  const [sortMode, setSortMode] = useState('manual'); // 'manual', 'name', 'created', 'lastopen'
  
  // Track manual order by note IDs
  const [noteOrder, setNoteOrder] = useState([]);
  const [draggedNoteId, setDraggedNoteId] = useState(null);
  const [mobileShowFolders, setMobileShowFolders] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const folderRes = await authFetch(`/api/folders`);
      const noteRes = await authFetch(`/api/notes`);
      if (folderRes.ok) setFolders(await folderRes.json());
      if (noteRes.ok) setNotes(await noteRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [token, location]);

  useEffect(() => {
    // Reset manual note order when folder changes
    setNoteOrder([]);
    
    // Load previously saved sort mode for this folder, or default to manual
    const folderKey = activeFolder === null ? 'all' : activeFolder.toString();
    
    try {
      const currentFolderSortModes = JSON.parse(localStorage.getItem('folderSortModes') || '{}');
      setSortMode(currentFolderSortModes[folderKey] || 'manual');
    } catch(e) {
      setSortMode('manual');
    }
  }, [activeFolder]);

  // Update folder sort mode when changed
  const handleSortModeChange = (newMode) => {
    setSortMode(newMode);
    
    const folderKey = activeFolder === null ? 'all' : activeFolder.toString();
    
    try {
      const currentFolderSortModes = JSON.parse(localStorage.getItem('folderSortModes') || '{}');
      const newFolderSortModes = { ...currentFolderSortModes, [folderKey]: newMode };
      localStorage.setItem('folderSortModes', JSON.stringify(newFolderSortModes));
    } catch(e) {
      console.error("Failed to save sort mode config");
    }
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      const res = await authFetch(`/api/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName })
      });
      if (res.ok) {
        setNewFolderName('');
        fetchDashboardData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDrop = async (e, targetFolderId) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Try to get multiple note IDs first, fall back to single noteId
    const multiNoteIds = e.dataTransfer.getData('noteIds');
    const singleNoteId = e.dataTransfer.getData('noteId');
    
    let noteIds = [];
    if (multiNoteIds) {
      noteIds = JSON.parse(multiNoteIds);
    } else if (singleNoteId) {
      noteIds = [singleNoteId];
    }
    
    if (!noteIds || noteIds.length === 0) {
      return;
    }

    try {
      // If in manual sort mode and dropping on the same folder, just reorder
      if (sortMode === 'manual' && targetFolderId === activeFolder) {
        // For manual reordering within the same folder
        const newOrder = [...displayedNotes.map(n => n.id)];
        setNoteOrder(newOrder);
        return;
      }

      // Otherwise, move all notes to the target folder
      for (const noteId of noteIds) {
        // For Loose Notes (targetFolderId === null), omit the folder_id parameter entirely
        const url = targetFolderId === null 
          ? `/api/notes/${noteId}/move`
          : `/api/notes/${noteId}/move?folder_id=${targetFolderId}`;
        
        await authFetch(url, {
          method: 'PUT',
        });
      }
      
      // Clear selection and refresh
      setSelectedNotes(new Set());
      await fetchDashboardData();
      setActiveFolder(activeFolder); // Preserve current folder
      setNoteOrder([]); // Reset manual order when moving to different folder
    } catch (err) {
      console.error('Drop error:', err);
    }
  };

  const handleRenameFolder = async (folderId) => {
    // Prevent renaming the default Loose Notes folder (id: null)
    if (folderId === null) {
      setEditingFolderId(-1);
      return;
    }
    if (!editingFolderName.trim()) return setEditingFolderId(-1);
    try {
      const res = await authFetch(`/api/folders/${folderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingFolderName })
      });
      if (res.ok) {
        setEditingFolderId(-1);
        fetchDashboardData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteNoteClick = (noteId, e) => {
    e.stopPropagation();
    setDeleteModal({ isOpen: true, type: 'note', id: noteId });
  };

  const handleDeleteFolderClick = (folderId, e) => {
    // Prevent deleting the default Loose Notes folder (id: null)
    if (folderId === null) return;
    e.stopPropagation();
    setDeleteModal({ isOpen: true, type: 'folder', id: folderId });
  };

  const confirmDelete = async () => {
    const currentFolder = activeFolder; // Preserve the current folder
    try {
      if (deleteModal.type === 'note') {
        await authFetch(`/api/notes/${deleteModal.id}`, { method: 'DELETE' });
      } else if (deleteModal.type === 'folder') {
        await authFetch(`/api/folders/${deleteModal.id}`, { method: 'DELETE' });
        if (activeFolder === deleteModal.id) setActiveFolder(null);
      } else if (deleteModal.type === 'bulk-notes') {
        for (const noteId of deleteModal.ids) {
          await authFetch(`/api/notes/${noteId}`, { method: 'DELETE' });
        }
        setSelectedNotes(new Set());
      }
      await fetchDashboardData();
      // Restore the folder if it wasn't deleted
      if (deleteModal.type !== 'folder') {
        setActiveFolder(currentFolder);
      }
    } catch (err) {
      console.error(err);
      addToast('Failed to delete', 'error');
    } finally {
      setDeleteModal({ isOpen: false, type: null, id: null, ids: [], count: 0 });
    }
  };

  const handleMoveToLooseNotes = async (noteId, e) => {
    e.stopPropagation();
    try {
      // For Loose Notes, omit the folder_id parameter entirely
      await authFetch(`/api/notes/${noteId}/move`, {
        method: 'PUT',
      });
      fetchDashboardData();
    } catch (err) {
      console.error(err);
      addToast('Failed to move note', 'error');
    }
  };

  const handleToggleFavorite = async (noteId, e) => {
    e.stopPropagation();
    try {
      const response = await authFetch(`/api/notes/${noteId}/favorite`, {
        method: 'PUT',
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.is_favorite) {
        addToast('Added to favorites', 'success');
      } else {
        addToast('Removed from favorites', 'success');
      }
      fetchDashboardData();
    } catch (err) {
      console.error('Toggle favorite error:', err);
      addToast('Failed to toggle favorite', 'error');
    }
  };

  const handleRenameNoteClick = (noteId, currentTitle, e) => {
    e.stopPropagation();
    setRenameModal({ isOpen: true, noteId, newTitle: currentTitle });
  };

const [renamingNoteId, setRenamingNoteId] = useState(null);

    const confirmRenameNote = async () => {
        if (!renameModal.newTitle.trim()) {
            setRenameModal({ isOpen: false, noteId: null, newTitle: '' });
            return;
        }

        setRenamingNoteId(renameModal.noteId);
        try {
            const res = await authFetch(`/api/notes/${renameModal.noteId}/rename`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: renameModal.newTitle.trim() })
            });

            if (res.ok) {
                fetchDashboardData();
                setRenameModal({ isOpen: false, noteId: null, newTitle: '' });
            } else {
                addToast('Failed to rename note', 'error');
            }
        } catch (err) {
            console.error(err);
            addToast('Error renaming note', 'error');
        } finally {
            setRenamingNoteId(null);
    }
  };

  const handleCopyNote = (noteId, e) => {
    e.stopPropagation();
    setClipboard({ noteIds: [noteId], operation: 'copy', isBulk: false });
  };

  const handleCutNote = (noteId, e) => {
    e.stopPropagation();
    setClipboard({ noteIds: [noteId], operation: 'cut', isBulk: false });
  };

  const handlePasteNote = async (targetFolderId, e) => {
    e.stopPropagation();
    if (!clipboard.operation || clipboard.noteIds.length === 0) {
      addToast('No note copied/cut', 'info');
      return;
    }

    try {
      if (clipboard.operation === 'copy') {
        // For copy, fetch and create duplicates for all notes
        for (const noteId of clipboard.noteIds) {
          const noteTocopy = notes.find(n => n.id === noteId);
          if (!noteTocopy) continue;
          
          // Get full note content first
          const noteRes = await authFetch(`/api/notes/${noteId}`);
          if (!noteRes.ok) continue;
          const fullNote = await noteRes.json();
          
          // Create a duplicate with same content but new title
          await authFetch(`/api/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: `${noteTocopy.title} (Copy)`,
              content: fullNote.content || '',
              folder_id: targetFolderId || null,
              source_type: noteTocopy.source_type || ''
            })
          });
        }

        await fetchDashboardData();
        setClipboard({ noteIds: [], operation: null, isBulk: false }); // Clear clipboard after copy
        addToast(`Pasted ${clipboard.noteIds.length} note(s) successfully`, 'success');
      } else if (clipboard.operation === 'cut') {
        // For cut, move all notes
        for (const noteId of clipboard.noteIds) {
          // For Loose Notes (targetFolderId === null), omit the folder_id parameter entirely
          const url = targetFolderId === null 
            ? `/api/notes/${noteId}/move`
            : `/api/notes/${noteId}/move?folder_id=${targetFolderId}`;
          
          await authFetch(url, {
            method: 'PUT',
          });
        }
        
        await fetchDashboardData();
        setClipboard({ noteIds: [], operation: null, isBulk: false });
        addToast(`Moved ${clipboard.noteIds.length} note(s) successfully`, 'success');
      }
    } catch (err) {
      console.error('Paste error:', err);
      addToast(`Failed to paste note: ${err.message}`, 'error');
    }
  };

  const toggleNoteSelection = (noteId) => {
    const newSelected = new Set(selectedNotes);
    if (newSelected.has(noteId)) {
      newSelected.delete(noteId);
    } else {
      newSelected.add(noteId);
    }
    setSelectedNotes(newSelected);
  };

  const handleBulkCopy = async () => {
    if (selectedNotes.size === 0) return;
    
    setClipboard({ 
      noteIds: Array.from(selectedNotes), 
      operation: 'copy', 
      isBulk: true 
    });
  };

  const handleBulkCut = async () => {
    if (selectedNotes.size === 0) return;
    
    setClipboard({ 
      noteIds: Array.from(selectedNotes), 
      operation: 'cut', 
      isBulk: true 
    });
  };

  const handleBulkDelete = async () => {
    if (selectedNotes.size === 0) return;
    
    setDeleteModal({ 
      isOpen: true, 
      type: 'bulk-notes', 
      ids: Array.from(selectedNotes),
      count: selectedNotes.size
    });
  };

  const allowDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragStart = (e, noteId) => {
    // Always track which note(s) are being dragged
    setDraggedNoteId(noteId);
    
    // If the dragged note is in selection, drag all selected notes
    if (selectedNotes.has(noteId)) {
      const noteIds = Array.from(selectedNotes);
      e.dataTransfer.setData('noteIds', JSON.stringify(noteIds));
      e.dataTransfer.effectAllowed = 'move';
    } else {
      // Single note drag (not in selection)
      e.dataTransfer.setData('noteId', noteId);
      e.dataTransfer.effectAllowed = 'move';
    }
    console.log('Drag started:', noteId);
  };

  const handleNoteDropOnNote = (draggedId, targetId) => {
    // Special handler for dropping a note on another note (for reordering in manual mode)
    if (sortMode === 'manual') {
      const currentOrder = noteOrder.length > 0 ? noteOrder : displayedNotes.map(n => n.id);
      let draggedIndex = currentOrder.indexOf(draggedId);
      let targetIndex = currentOrder.indexOf(targetId);
      
      if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
        const newOrder = [...currentOrder];
        newOrder.splice(draggedIndex, 1);
        
        // Adjust targetIndex after removing the dragged item
        if (draggedIndex < targetIndex) {
          targetIndex--;
        }
        
        newOrder.splice(targetIndex, 0, draggedId);
        setNoteOrder(newOrder);
        setDraggedNoteId(null);
        return true; // Reordering handled
      }
    }
    return false; // Not handled, normal drag-drop will proceed
  };

  const getSortedNotes = (notesToSort) => {
    let sorted = [...notesToSort];
    
    console.log('getSortedNotes - sortMode:', sortMode, 'noteOrder:', noteOrder, 'notesToSort count:', notesToSort.length);
    
    switch (sortMode) {
      case 'name':
        sorted.sort((a, b) => {
          const titleA = (a.title || '').toLowerCase();
          const titleB = (b.title || '').toLowerCase();
          return titleA.localeCompare(titleB);
        });
        break;
      case 'created':
        sorted.sort((a, b) => {
          const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return timeB - timeA; // Descending (Newest first)
        });
        break;
      case 'lastopen':
        try {
          const lastOpenedMap = JSON.parse(localStorage.getItem('noteLastOpened') || '{}');
          sorted.sort((a, b) => {
            const timeA = lastOpenedMap[a.id] || (a.created_at ? new Date(a.created_at).getTime() : 0);
            const timeB = lastOpenedMap[b.id] || (b.created_at ? new Date(b.created_at).getTime() : 0);
            return timeB - timeA; // Descending (Recently opened first)
          });
        } catch (e) {
          // Fallback to creation date if JSON parse fails
          sorted.sort((a, b) => {
            const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return timeB - timeA;
          });
        }
        break;
      case 'manual':
      default:
        // Sort by noteOrder if it exists, otherwise keep original order
        if (noteOrder.length > 0) {
          sorted.sort((a, b) => {
            const indexA = noteOrder.indexOf(a.id);
            const indexB = noteOrder.indexOf(b.id);
            // Items in noteOrder come first, in their specified order
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            // Items in noteOrder come before items not in noteOrder
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return 0;
          });
        }
        break;
    }
    
    return sorted;
  };

  const handleReorderNotes = (fromIndex, toIndex) => {
    // Update the noteOrder based on drag-drop reordering
    const newOrder = [...noteOrder];
    if (newOrder.length === 0) {
      // Initialize with current displayed notes
      newOrder.push(...displayedNotes.map(n => n.id));
    }
    const [movedItem] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, movedItem);
    setNoteOrder(newOrder);
  };

  // Get Favorites folder id if it exists
  const favoritesFolderId = folders.find(f => f.name === "Favorites")?.id;

  const filteredNotes = activeFolder === null
    ? notes.filter(n => !n.folder_id)
    : activeFolder === favoritesFolderId
    ? notes.filter(n => n.is_favorite)
    : notes.filter(n => n.folder_id === activeFolder);

  const displayedNotes = getSortedNotes(filteredNotes);

  return (
    <div className="min-h-screen bg-cream font-sans relative">
      <div className="absolute inset-0 pattern-dots text-stone-300 opacity-20 pointer-events-none"></div>

      <header className="px-3 sm:px-6 md:px-8 py-3 sm:py-6 flex justify-between items-center border-b border-stone-200 bg-white/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center gap-2 md:gap-3">
          <img src={logoImage} alt="Morom Notes logo" className="h-8 sm:h-10 md:h-12 w-8 sm:w-10 md:w-12 object-contain opacity-40 rounded-[30%]" />
          <span className="text-lg sm:text-xl md:text-2xl font-serif text-stone-800 tracking-wide inline">Morom Notes</span>
        </div>
        <div className="flex-1 text-right min-w-0">
          <h1 className="text-lg sm:text-2xl font-display font-medium text-stone-800 truncate">Your Desk</h1>
          <p className="hidden sm:block text-xs sm:text-sm text-stone-500 font-handwriting truncate">hello, {user}</p>
        </div>
        <div className="flex gap-2 sm:gap-4 items-center flex-shrink-0 ml-4">
          <Link to="/upload" className="bg-primary hover:bg-primary/90 text-white px-3 sm:px-5 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg transition-transform hover:-translate-y-0.5 shadow-sm font-medium cursor-pointer whitespace-nowrap flex justify-center items-center">
            + New Note
          </Link>
          <AccountSwitcher />
        </div>
      </header>

      <main className="flex h-[calc(100vh-80px)] sm:h-[calc(100vh-120px)] max-w-full mx-auto relative z-10 flex-col sm:flex-row">

        {/* Left Column: Folders - Hidden on Mobile, Full on Larger Screens */}
        <div className="hidden sm:flex col-span-1 w-48 md:w-56 lg:w-60 border-r border-stone-200/50 pr-3 md:pr-4 py-4 md:py-6 px-3 md:px-5 overflow-hidden flex-col">
          <h2 className="text-sm md:text-lg font-medium text-stone-800 mb-3 md:mb-4 flex items-center justify-between">
            Folders
          </h2>

          <form onSubmit={handleCreateFolder} className="mb-6 flex gap-2">
            <input
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              placeholder="New folder..."
              className="w-full bg-white border border-stone-200 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
            <button type="submit" className="bg-stone-800 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-stone-700 cursor-pointer">Add</button>
          </form>

          <div className="space-y-4 overflow-y-auto flex-1 pr-4">
            {/* Create a virtual "Loose Notes" folder to treat as a default folder */}
            {[{ id: null, name: 'Loose Notes', isDefault: true }, ...folders].map(folder => (
              <div
                key={folder.id === null ? 'loose-notes' : folder.id}
                onClick={() => { if (editingFolderId !== folder.id) setActiveFolder(folder.id) }}
                onDrop={(e) => handleDrop(e, folder.id)}
                onDragOver={allowDrop}
                className={`group p-4 rounded-xl relative hover:shadow-md transition-all cursor-pointer ${
                  activeFolder === folder.id 
                    ? folder.isDefault ? 'bg-blue-50 border border-blue-300 shadow-sm' : 'bg-amber-100 border border-amber-300 shadow-sm'
                    : folder.isDefault ? 'bg-blue-50/50 border border-blue-200' : 'bg-amber-50 border border-amber-200'
                }`}
              >
                {!folder.isDefault && <div className="absolute top-0 right-4 w-12 h-3 bg-amber-200 rounded-b-md opacity-50"></div>}

                {editingFolderId === folder.id ? (
                  <form onSubmit={(e) => { e.preventDefault(); handleRenameFolder(folder.id); }} className="mb-2">
                    <input
                      autoFocus
                      className="w-full bg-white border border-amber-300 rounded px-2 py-1 text-sm outline-none"
                      value={editingFolderName}
                      onChange={(e) => setEditingFolderName(e.target.value)}
                      onBlur={() => handleRenameFolder(folder.id)}
                    />
                  </form>
                ) : (
                  <div className="flex justify-between items-center mb-2">
                    <h3 className={`font-medium ${folder.isDefault ? 'text-blue-700' : 'text-stone-800'}`}>
                      {folder.name}
                      {folder.isDefault && <span className="text-xs ml-2 text-blue-600">(default)</span>}
                    </h3>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                      {clipboard.operation && clipboard.noteIds.length > 0 && (
                        <button
                          className="text-xs bg-green-100 text-green-700 hover:bg-green-200 rounded px-2 py-1 transition cursor-pointer"
                          onClick={(e) => handlePasteNote(folder.id, e)}
                          title="Paste copied/cut notes"
                        >
                          📌 Paste ({clipboard.noteIds.length})
                        </button>
                      )}
                      {!folder.isDefault && (
                        <>
                          <button
                            className="text-xs text-stone-400 hover:text-stone-700 transition cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingFolderId(folder.id);
                              setEditingFolderName(folder.name);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="text-xs text-red-400 hover:text-red-600 transition cursor-pointer"
                            onClick={(e) => handleDeleteFolderClick(folder.id, e)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="text-sm text-stone-500 font-handwriting">
                  {folder.name === "Favorites" 
                    ? notes.filter(n => n.is_favorite).length 
                    : notes.filter(n => n.folder_id === folder.id).length} notes
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Columns: Notes Grid - Responsive */}
        <div className="flex-1 overflow-y-auto pb-3 sm:pb-6 px-3 sm:px-6">
          <div className="flex justify-between items-center mb-4 sm:mb-6 sticky top-0 z-10 bg-cream pt-3 sm:pt-6 pb-2 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMobileShowFolders(!mobileShowFolders)}
                className="sm:hidden bg-stone-100 hover:bg-stone-200 text-stone-800 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                title="Toggle folders"
              >
                📁 Folders
              </button>
              <h2 className="text-base sm:text-lg md:text-2xl font-medium text-stone-800 font-handwriting rotate-[-1deg]">
                {activeFolder === null ? "Loose Notes" : `Notes in ${folders.find(f => f.id === activeFolder)?.name || 'Folder'}`}
              </h2>
            </div>
            <div className="flex gap-2 items-center">
              {clipboard.operation && clipboard.noteIds.length > 0 && (
                <button
                  className="text-xs sm:text-sm bg-green-100 text-green-700 hover:bg-green-200 rounded-md px-2 sm:px-3 py-1 sm:py-1.5 transition cursor-pointer font-medium whitespace-nowrap"
                  onClick={(e) => handlePasteNote(activeFolder, e)}
                  title="Paste copied/cut notes here"
                >
                  📌 Paste ({clipboard.noteIds.length})
                </button>
              )}
              <select
                value={sortMode}
                onChange={(e) => handleSortModeChange(e.target.value)}
                className="text-xs px-2 sm:px-3 py-1 sm:py-1.5 bg-white border border-stone-300 rounded-md focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer"
              >
                <option value="name">Sort by Name</option>
                <option value="manual">Sort by First Created</option>
                <option value="created">Sort by Last Created</option>
                <option value="lastopen">Sort by Last Open</option>
              </select>
            </div>
          </div>

          {/* Mobile Folder Menu */}
          {mobileShowFolders && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="sm:hidden mb-4 p-4 bg-white border border-stone-200 rounded-xl shadow-md"
            >
              <h3 className="font-semibold text-stone-800 mb-3">Manage Folders</h3>
              
              {/* Create New Folder Form */}
              <form onSubmit={handleCreateFolder} className="mb-4 flex gap-2">
                <input
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  placeholder="New folder..."
                  className="flex-1 bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
                <button type="submit" className="bg-primary hover:bg-primary/90 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap">
                  + Add
                </button>
              </form>

              {/* Folders List */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                <div className="text-xs font-medium text-stone-500 uppercase mb-2">Your Folders</div>
                {[{ id: null, name: 'Loose Notes', isDefault: true }, ...folders].map(folder => (
                  <button
                    key={folder.id === null ? 'loose-notes' : folder.id}
                    onClick={() => {
                      setActiveFolder(folder.id);
                      setMobileShowFolders(false);
                    }}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      activeFolder === folder.id
                        ? 'bg-primary/20 text-primary font-medium border border-primary/30'
                        : 'hover:bg-stone-50 text-stone-700 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{folder.isDefault ? '📋' : '📁'}</span>
                      <div>
                        <p className="font-medium">{folder.name}</p>
                        {folder.isDefault && <p className="text-xs text-stone-500">(default)</p>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            <AnimatePresence>
              {displayedNotes.map(note => (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  key={note.id}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, note.id)}
                  onDragEnd={() => {
                    console.log('Drag ended');
                    setDraggedNoteId(null);
                  }}
                  onDragOver={(e) => {
                    if (sortMode === 'manual') {
                      allowDrop(e);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Get dragged note ID from dataTransfer (not from state, as state is async)
                    let draggedId = null;
                    try {
                      const noteIds = e.dataTransfer.getData('noteIds');
                      const noteId = e.dataTransfer.getData('noteId');
                      draggedId = noteIds ? JSON.parse(noteIds)[0] : parseInt(noteId);
                    } catch (err) {
                      console.error('Failed to get dragged note ID:', err);
                      return;
                    }
                    
                    console.log('Drop detected on note:', note.id, 'dragged:', draggedId);
                    if (draggedId && sortMode === 'manual') {
                      const result = handleNoteDropOnNote(draggedId, note.id);
                      console.log('Reorder result:', result);
                    }
                  }}
                  className={`p-6 rounded-xl border shadow-sm transition-all relative overflow-hidden group cursor-move ${
                    selectedNotes.has(note.id)
                      ? 'bg-blue-50 border-blue-300 border-2 hover:shadow-lg hover:scale-105'
                      : 'bg-paper border-stone-200 cursor-pointer hover:shadow-lg active:cursor-grabbing'
                  } ${draggedNoteId === note.id ? 'opacity-50' : ''}`}
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary/80 scale-y-0 group-hover:scale-y-100 transition-transform origin-top"></div>
                  
                  {/* Checkbox - Show on hover or when selected, positioned at corner */}
                  <div className={`absolute top-2 right-2 transition-opacity ${
                    selectedNotes.has(note.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}>
                    <input
                      type="checkbox"
                      checked={selectedNotes.has(note.id)}
                      onChange={() => toggleNoteSelection(note.id)}
                      className="w-5 h-5 cursor-pointer accent-blue-600"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  
                  <h3 className="text-lg font-display font-medium text-stone-800 mb-1 line-clamp-2" title={note.title || "Untitled Note"}>{note.title || "Untitled Note"}</h3>
                  <p className="text-sm text-stone-500 mb-4">{getSourceInfo(note).displayText}</p>
                  <div className="flex justify-between items-center text-xs mb-3">
                    <span className={`px-2 py-1 rounded-full ${
                      note.status === 'failed' ? 'bg-red-100 text-red-700' 
                      : note.status === 'pending' || note.status === 'processing' ? 'bg-amber-100 text-amber-700' 
                      : 'bg-green-100 text-green-700'
                    }`}>
                      {note.status === 'failed' ? 'Failed' 
                        : note.status === 'pending' || note.status === 'processing' ? 'Processing'
                        : 'Generated'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleToggleFavorite(note.id, e)}
                        className={`w-10 h-3 flex items-center justify-center transition hover:shadow-md ${
                          note.is_favorite 
                            ? 'text-red-600' 
                            : 'text-stone-400 hover:text-red-500'
                        }`}
                        title={note.is_favorite ? "Remove from favorites" : "Add to favorites"}
                      >
                        <Heart 
                          size={18} 
                          fill={note.is_favorite ? "currentColor" : "none"} 
                          strokeWidth={2}
                        />
                      </button>
                      <Link to={`/editor/${note.id}`} className="text-primary hover:underline font-medium flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        Read <span className="text-lg">&rarr;</span>
                      </Link>
                    </div>
                  </div>

                  {/* Rename & Move buttons - only show these individually */}
                  <div className="flex gap-2 justify-between items-center pt-3 border-t border-stone-200 opacity-0 group-hover:opacity-100 transition">
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRenameNoteClick(note.id, note.title, e); }}
                        className="text-xs px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded transition cursor-pointer"
                      >
                        Rename
                      </button>
                      {activeFolder !== null && activeFolder !== favoritesFolderId && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleMoveToLooseNotes(note.id, e); }}
                          className="text-xs px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded transition cursor-pointer"
                        >
                          Move to Loose Notes
                        </button>
                      )}
                    </div>
                    <span className="text-xs text-stone-400" title={note.created_at ? new Date(note.created_at).toLocaleString() : ''}>
                      {formatCreatedDate(note.created_at)}
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {displayedNotes.length === 0 && (
              <div className="col-span-full py-12 text-center text-stone-400 font-handwriting text-2xl border-2 border-dashed border-stone-200 rounded-xl">
                this desk area is empty.
              </div>
            )}
          </div>

          {/* Bulk Action Toolbar */}
          {selectedNotes.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-4 sm:bottom-6 left-1/2 transform -translate-x-1/2 w-[95%] sm:w-auto max-w-[360px] sm:max-w-none z-40 bg-white border border-stone-200 rounded-2xl shadow-2xl p-3 sm:p-4 flex flex-wrap sm:flex-nowrap justify-center gap-2 sm:gap-3 items-center backdrop-blur-sm bg-white/95"
            >
              <span className="text-xs sm:text-sm font-medium text-stone-700 whitespace-nowrap">
                {selectedNotes.size} selected
              </span>
              
              <div className="hidden sm:block w-px h-6 bg-stone-200"></div>
              
              <button
                onClick={handleBulkCopy}
                className="text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg transition font-medium cursor-pointer"
              >
                📋 Copy ({selectedNotes.size})
              </button>
              
              <button
                onClick={handleBulkCut}
                className="text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 bg-yellow-100 text-yellow-700 hover:bg-yellow-200 rounded-lg transition font-medium cursor-pointer"
              >
                ✂️ Cut ({selectedNotes.size})
              </button>
              
              <button
                onClick={handleBulkDelete}
                className="text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-lg transition font-medium cursor-pointer"
              >
                🗑️ Delete ({selectedNotes.size})
              </button>

              <button
                onClick={() => setSelectedNotes(new Set())}
                className="text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition cursor-pointer sm:ml-2"
              >
                Clear
              </button>
            </motion.div>
          )}
        </div>

      </main>

      {/* Custom Delete Modal */}
      <AnimatePresence>
        {deleteModal.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm"
            onClick={() => setDeleteModal({ isOpen: false, type: null, id: null, ids: [], count: 0 })}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-stone-200"
            >
              <h3 className="text-xl font-display font-medium text-stone-800 mb-2">
                Delete {deleteModal.type === 'bulk-notes' ? `${deleteModal.count} Note(s)` : deleteModal.type === 'note' ? 'Note' : 'Folder'}?
              </h3>
              <p className="text-stone-500 mb-6 text-sm">
                {deleteModal.type === 'bulk-notes'
                  ? `⚠️ You are about to permanently delete ${deleteModal.count} note(s). This action cannot be undone.`
                  : deleteModal.type === 'folder'
                  ? 'This will permanently destroy the folder and all its contents.'
                  : 'This action cannot be undone.'}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteModal({ isOpen: false, type: null, id: null, ids: [], count: 0 })}
                  className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-50 font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium transition-colors shadow-sm cursor-pointer"
                >
                  Yes, Delete {deleteModal.type === 'bulk-notes' ? 'All' : ''}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rename Note Modal */}
      <AnimatePresence>
        {renameModal.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm"
            onClick={() => setRenameModal({ isOpen: false, noteId: null, newTitle: '' })}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full border border-stone-200"
            >
              <h3 className="text-xl font-display font-medium text-stone-800 mb-4">
                Rename Note
              </h3>
              <input
                type="text"
                value={renameModal.newTitle}
                onChange={(e) => setRenameModal({ ...renameModal, newTitle: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmRenameNote();
                  if (e.key === 'Escape') setRenameModal({ isOpen: false, noteId: null, newTitle: '' });
                }}
                autoFocus
                className="w-full px-4 py-2 border border-stone-300 rounded-lg mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter new note title"
              />
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setRenameModal({ isOpen: false, noteId: null, newTitle: '' })}
                  className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-50 font-medium transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRenameNote}
                  disabled={renamingNoteId !== null}
                  className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors shadow-sm cursor-pointer disabled:bg-blue-400 disabled:cursor-wait"
                >
                  {renamingNoteId === renameModal.noteId ? 'Renaming...' : 'Rename'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}