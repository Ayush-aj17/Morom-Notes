import sys, re, os
path = 'c:/Projects/Project-notes/backend-fastapi/routes/generation.py'
c = open(path).read()

old_code = '''                    if temp_file_path is not None:
                        update_progress(5, f\"Reading file: {filename}\")
                        suffix = os.path.splitext(filename)[1] if filename else \".mp4\"
                        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                            tmp.write(temp_file_path)
                            tmp_path = tmp.name
                        try:
                            update_progress(15, \"Extracting audio from video...\")
                            generated_content = generate_notes_from_video_file(tmp_path, mime_type=mime_type or \"video/mp4\")
                            update_progress(85, \"Generating notes from transcript...\")
                        finally:
                            os.remove(tmp_path)'''

new_code = '''                    if temp_file_path is not None:
                        update_progress(5, f\"Processing file: {filename}\")
                        try:
                            update_progress(15, \"Extracting audio from video...\")
                            generated_content = generate_notes_from_video_file(temp_file_path, mime_type=mime_type or \"video/mp4\")
                            update_progress(85, \"Generating notes from transcript...\")
                        finally:
                            if os.path.exists(temp_file_path):
                                os.remove(temp_file_path)'''

if old_code in c:
    c = c.replace(old_code, new_code)
else:
    print('COULD NOT FIND')

open(path, 'w').write(c)

