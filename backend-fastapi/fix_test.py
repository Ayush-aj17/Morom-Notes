import re
p = r'c:\Projects\Project-notes\backend-fastapi\tests\test_api.py'
with open(p, 'r', encoding='utf-8') as f:
    text = f.read()

text = re.sub(r'\"password\": \"(.*?)\"\}', r'"password": "\1", "email": "test@test.com"}', text)
text = re.sub(r'\"password\": password\}', r'"password": password, "email": "test@test.com"}', text)

with open(p, 'w', encoding='utf-8') as f:
    f.write(text)
print("done")
