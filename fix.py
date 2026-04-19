import os
import re

path = 'c:/Projects/Project-notes/backend-fastapi/routes/generation.py'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace('def _do_work(note_id: int, video_url: str, file_data: bytes = None, filename: str = None, mime_type: str = None):', 'def _do_work(note_id: int, video_url: str, temp_file_path: str = None, filename: str = None, mime_type: str = None):')
c = c.replace('if file_data is not None:', 'if temp_file_path is not None:')
c = c.replace('if not file_data:', 'if not temp_file_path:')
c = c.replace('if file_data is None', 'if temp_file_path is None')
c = c.replace('if not file_data', 'if not temp_file_path')

c = re.sub(
    r'with tempfile\.NamedTemporaryFile\(delete=False, suffix=suffix\) as tmp:.*?tmp_path = tmp\.name',
    'pass  # File is already on disk',
    c,
    flags=re.DOTALL
)

c = c.replace('generate_notes_from_video_file(tmp_path', 'generate_notes_from_video_file(temp_file_path')
c = c.replace('os.remove(tmp_path)', 'if os.path.exists(temp_file_path):\n                                os.remove(temp_file_path)')

router_logic = '''        if file:
            try:
                data = await file.read()
                logger.info("Read file data: %d bytes", len(data) if data else 0)
            except Exception as e:
                logger.error("Failed to read file: %s", e)
                n = db.get(Note, new_note.id)
                if n:
                    n.status = "failed"
                    n.progress_status = f"Failed to read file: {str(e)}"
                    db.commit()
                raise HTTPException(status_code=400, detail=f"Failed to read uploaded file: {str(e)}")
            
            if _settings.testing:
                _do_work(new_note.id, None, data, file.filename, file.content_type)
                logger.info("ran file-based generation immediately for note %s (testing mode)", new_note.id)
            else:
                background_tasks.add_task(_do_work, new_note.id, None, data, file.filename, file.content_type)
                logger.info("queued file-based note generation for note %s", new_note.id)'''

new_router_logic = '''        if file:
            import shutil, tempfile
            try:
                suffix = os.path.splitext(file.filename)[1] if file.filename else ".mp4"
                tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
                saved_path = tmp.name
                shutil.copyfileobj(file.file, tmp)
                tmp.close()
                logger.info("Saved file to temporary path: %s", saved_path)
            except Exception as e:
                logger.error("Failed to save file: %s", e)
                n = db.get(Note, new_note.id)
                if n:
                    n.status = "failed"
                    n.progress_status = f"Failed to save file: {str(e)}"
                    db.commit()
                raise HTTPException(status_code=400, detail=f"Failed to save uploaded file: {str(e)}")
            
            if _settings.testing:
                _do_work(new_note.id, None, saved_path, file.filename, file.content_type)
                logger.info("ran file-based generation immediately for note %s", new_note.id)
            else:
                background_tasks.add_task(_do_work, new_note.id, None, saved_path, file.filename, file.content_type)
                logger.info("queued file-based note generation for note %s", new_note.id)'''

c = c.replace(router_logic, new_router_logic)

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)
print("Fix applied successfully.")
