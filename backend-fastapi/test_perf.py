
import time, sys
try:
    from services.document_processor import spell
    print('Testing autocorrect performance...')
    t0 = time.time()
    text = ('This is a test sentence with some typoss. ' * 50) + '\n'
    text = text * 100 # 5000 lines
    for line in text.split('\n'):
        if len(line) > 3:
            spell(line)
    print(f'Autocorrect took: {time.time() - t0:.2f}s')
except Exception as e:
    print(e)

