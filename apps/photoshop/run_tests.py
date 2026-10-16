import http.server
import socketserver
import threading
import subprocess
import time
import sys

PORT = 8999
DIRECTORY = r'c:\Users\dell\Desktop\Aksh Photoshop'

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    def log_message(self, format, *args):
        pass

httpd = socketserver.TCPServer(('127.0.0.1', PORT), Handler)
server_thread = threading.Thread(target=httpd.serve_forever)
server_thread.daemon = True
server_thread.start()

time.sleep(0.5)

chrome_path = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
cmd = [
    chrome_path,
    '--headless=new',
    '--disable-gpu',
    '--virtual-time-budget=8000',
    '--dump-dom',
    f'http://127.0.0.1:{PORT}/apps/photoshop/test_runner.html'
]

res = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
dom = res.stdout

if 'Final Status: ALL TESTS PASSED' in dom:
    import re
    results_html = dom.split('id="results"')[1].split('</script>')[0]
    rows = re.findall(r'<div class="test-row.*?<span>(.*?)</span>.*?<span class="(.*?)">(.*?)</span>', results_html, re.DOTALL)
    print(f'SUCCESS: All {len(rows)} assertions passed cleanly!')
    for name, cls, status in rows:
        print(f'  [{status}] {name.strip()}')
    httpd.shutdown()
    sys.exit(0)
else:
    print('FAILURE or incomplete:')
    import re
    fails = re.findall(r'<div class="test-row.*?>(.*?)</div>', dom, re.DOTALL)
    print(f'Total test rows found: {len(fails)}')
    for f in fails:
        if 'FAILED' in f:
            clean = re.sub(r'<[^>]+>', ' ', f).strip()
            print('FAILED TEST:', clean)
    for line in dom.split('\n'):
        if any(term in line for term in ['Error running tests', 'TypeError', 'ReferenceError']):
            print('EXCEPTION:', line.strip())
    httpd.shutdown()
    sys.exit(1)
