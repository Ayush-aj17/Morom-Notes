
import time
from services.document_processor import spell
print('Testing spell on long word...')
t0 = time.time()
spell('a'*10000)
print(time.time() - t0)

