#!/usr/bin/env python3
"""
CLI utility to read and display database information
Usage: python cli_reader.py [command] [options]
"""

import sys
from datetime import datetime
from database.db import SessionLocal
from database.models import User, Note, Folder, CachedNote

def print_header(text):
    """Print a formatted header"""
    print("\n" + "="*100)
    print(f" {text}")
    print("="*100 + "\n")

def print_table(data, headers):
    """Simple table printer without external dependencies"""
    if not data:
        return
    
    # Calculate column widths
    col_widths = [len(str(h)) for h in headers]
    for row in data:
        for i, cell in enumerate(row):
            col_widths[i] = max(col_widths[i], len(str(cell)))
    
    # Print header
    header_line = " | ".join(str(h).ljust(col_widths[i]) for i, h in enumerate(headers))
    print(header_line)
    print("-" * len(header_line))
    
    # Print rows
    for row in data:
        print(" | ".join(str(cell).ljust(col_widths[i]) for i, cell in enumerate(row)))

def show_users():
    """Display all users"""
    db = SessionLocal()
    try:
        users = db.query(User).all()
        if not users:
            print("No users found.")
            return
        
        print_header("ALL USERS")
        data = []
        for u in users:
            data.append([
                u.id,
                u.username,
                u.email,
                "✓ Yes" if u.email_verified else "✗ No",
                u.created_at.strftime("%Y-%m-%d %H:%M") if u.created_at else "N/A"
            ])
        
        print_table(data, ["ID", "Username", "Email", "Verified", "Created At"])
        print(f"\nTotal users: {len(users)}\n")
    finally:
        db.close()

def show_user_details(user_id=None, username=None):
    """Display detailed info about a specific user"""
    db = SessionLocal()
    try:
        if user_id:
            user = db.query(User).filter(User.id == user_id).first()
        elif username:
            user = db.query(User).filter(User.username == username).first()
        else:
            print("Please provide user_id or username")
            return
        
        if not user:
            print("User not found.")
            return
        
        print_header(f"USER DETAILS - {user.username} (ID: {user.id})")
        print(f"Email: {user.email}")
        print(f"Email Verified: {'Yes' if user.email_verified else 'No'}")
        print(f"Created At: {user.created_at.strftime('%Y-%m-%d %H:%M:%S') if user.created_at else 'N/A'}")
        print(f"OTP Expires At: {user.otp_expires_at.strftime('%Y-%m-%d %H:%M:%S') if user.otp_expires_at else 'N/A'}")
        
        # Show folders
        folders = db.query(Folder).filter(Folder.user_id == user.id).all()
        print(f"\nFolders ({len(folders)}):")
        if folders:
            folder_data = [[f.id, f.name] for f in folders]
            print_table(folder_data, ["ID", "Name"])
        
        # Show notes
        notes = db.query(Note).filter(Note.user_id == user.id).all()
        print(f"\nNotes ({len(notes)}):")
        if notes:
            note_data = [
                [n.id, n.title[:40], n.status, n.source_type or "N/A", n.created_at.strftime("%Y-%m-%d %H:%M")]
                for n in notes
            ]
            print_table(note_data, ["ID", "Title", "Status", "Source Type", "Created At"])
    finally:
        db.close()

def show_notes(limit=50):
    """Display all notes"""
    db = SessionLocal()
    try:
        notes = db.query(Note).order_by(Note.created_at.desc()).limit(limit).all()
        if not notes:
            print("No notes found.")
            return
        
        print_header(f"LATEST NOTES (showing {len(notes)})")
        data = []
        for n in notes:
            user = db.query(User).filter(User.id == n.user_id).first()
            data.append([
                n.id,
                n.title[:30],
                user.username if user else "Unknown",
                n.status,
                n.source_type or "N/A",
                n.created_at.strftime("%Y-%m-%d %H:%M")
            ])
        
        print_table(data, ["ID", "Title", "User", "Status", "Source", "Created"])
        print(f"\nTotal notes shown: {len(notes)}\n")
    finally:
        db.close()

def show_note_details(note_id):
    """Display detailed info about a specific note"""
    db = SessionLocal()
    try:
        note = db.query(Note).filter(Note.id == note_id).first()
        if not note:
            print("Note not found.")
            return
        
        user = db.query(User).filter(User.id == note.user_id).first()
        
        print_header(f"NOTE DETAILS - ID: {note.id}")
        print(f"Title: {note.title}")
        print(f"User: {user.username if user else 'Unknown'} (ID: {note.user_id})")
        print(f"Subject: {note.subject}")
        print(f"Status: {note.status}")
        print(f"Source Type: {note.source_type or 'N/A'}")
        print(f"Progress: {note.progress}%")
        print(f"Progress Status: {note.progress_status}")
        print(f"Is Favorite: {'Yes' if note.is_favorite else 'No'}")
        print(f"Video URL: {note.video_url or 'N/A'}")
        print(f"Created At: {note.created_at.strftime('%Y-%m-%d %H:%M:%S') if note.created_at else 'N/A'}")
        
        if note.content:
            print(f"\nContent Preview (first 300 chars):")
            print("-" * 100)
            print(note.content[:300] + ("..." if len(note.content) > 300 else ""))
            print("-" * 100)
            print(f"Content length: {len(note.content)} characters")
    finally:
        db.close()

def show_cached_notes(limit=20):
    """Display cached notes"""
    db = SessionLocal()
    try:
        cached = db.query(CachedNote).order_by(CachedNote.last_accessed.desc()).limit(limit).all()
        if not cached:
            print("No cached notes found.")
            return
        
        print_header(f"CACHED NOTES (showing {len(cached)})")
        data = []
        for c in cached:
            data.append([
                c.id,
                c.title[:30],
                c.source_type or "N/A",
                c.access_count,
                c.last_accessed.strftime("%Y-%m-%d %H:%M"),
                len(c.content) if c.content else 0
            ])
        
        print_table(data, ["ID", "Title", "Source Type", "Access Count", "Last Accessed", "Content Size"])
        print(f"\nTotal cached notes shown: {len(cached)}\n")
    finally:
        db.close()

def show_stats():
    """Display database statistics"""
    db = SessionLocal()
    try:
        user_count = db.query(User).count()
        note_count = db.query(Note).count()
        folder_count = db.query(Folder).count()
        cached_count = db.query(CachedNote).count()
        
        print_header("DATABASE STATISTICS")
        
        stats = [
            ["Total Users", user_count],
            ["Total Notes", note_count],
            ["Total Folders", folder_count],
            ["Cached Notes", cached_count],
        ]
        
        print_table(stats, ["Metric", "Count"])
        
        # Notes by status
        pending = db.query(Note).filter(Note.status == "pending").count()
        processing = db.query(Note).filter(Note.status == "processing").count()
        generated = db.query(Note).filter(Note.status == "generated").count()
        failed = db.query(Note).filter(Note.status == "failed").count()
        
        print("\nNotes by Status:")
        status_data = [
            ["Pending", pending],
            ["Processing", processing],
            ["Generated", generated],
            ["Failed", failed],
        ]
        print_table(status_data, ["Status", "Count"])
        
        # Notes by source type
        print("\nNotes by Source Type:")
        source_types = db.query(Note.source_type).distinct().all()
        source_data = []
        for st in source_types:
            source = st[0] or "Unknown"
            count = db.query(Note).filter(Note.source_type == st[0]).count()
            source_data.append([source, count])
        if source_data:
            print_table(source_data, ["Source Type", "Count"])
        
    finally:
        db.close()

def show_help():
    """Display help message"""
    help_text = """
CLI Reader - Database Query Tool
================================

USAGE:
  python cli_reader.py              - Show EVERYTHING (default)
  python cli_reader.py [command]    - Run specific command

COMMANDS:
  (No command)       - Show all data: stats, users, notes, cached notes
  all                - Same as above, show everything

  stats              - Show database statistics only

  users              - Show all users
  user [id/username] - Show details for a specific user
                      Example: python cli_reader.py user 1
                      Example: python cli_reader.py user john_doe

  notes [limit]      - Show all notes (optional limit)
                      Example: python cli_reader.py notes 20

  note [id]          - Show details for a specific note
                      Example: python cli_reader.py note 5

  cached [limit]     - Show all cached notes (optional limit)
                      Example: python cli_reader.py cached 10

  help               - Show this help message

EXAMPLES:
  python cli_reader.py                    # Shows everything
  python cli_reader.py stats              # Stats only
  python cli_reader.py users              # All users
  python cli_reader.py user 1             # User details
  python cli_reader.py notes 30           # Latest 30 notes
  python cli_reader.py note 5             # Note details
  python cli_reader.py cached 10          # Latest 10 cached
    """
    print(help_text)

def main():
    # If no arguments or if first arg is a command
    if len(sys.argv) < 2:
        # Show everything by default
        show_stats()
        show_users()
        show_notes(limit=999999)  # Show all notes
        show_cached_notes(limit=999999)  # Show all cached notes
        return
    
    command = sys.argv[1].lower()
    
    try:
        if command == "users":
            show_users()
        elif command == "user":
            if len(sys.argv) < 3:
                print("Usage: python cli_reader.py user [id|username]")
                return
            arg = sys.argv[2]
            # Try as ID first, then as username
            try:
                user_id = int(arg)
                show_user_details(user_id=user_id)
            except ValueError:
                show_user_details(username=arg)
        elif command == "notes":
            limit = int(sys.argv[2]) if len(sys.argv) > 2 else 999999
            show_notes(limit)
        elif command == "note":
            if len(sys.argv) < 3:
                print("Usage: python cli_reader.py note [id]")
                return
            note_id = int(sys.argv[2])
            show_note_details(note_id)
        elif command == "cached":
            limit = int(sys.argv[2]) if len(sys.argv) > 2 else 999999
            show_cached_notes(limit)
        elif command == "stats":
            show_stats()
        elif command == "all":
            # Show everything
            show_stats()
            show_users()
            show_notes(limit=999999)
            show_cached_notes(limit=999999)
        elif command == "help" or command == "-h" or command == "--help":
            show_help()
        else:
            print(f"Unknown command: {command}")
            print("Use 'python cli_reader.py help' for usage information")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
