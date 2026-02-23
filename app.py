import os
import uuid
import threading
from flask import Flask, request, jsonify, Response, render_template, send_from_directory
from queue import Queue, Empty
from core.processamento import process_files

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

jobs = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload_pre', methods=['POST'])
def upload_pre():
    files = request.files.getlist('files')
    job_id = str(uuid.uuid4())
    job_dir = os.path.join(app.config['UPLOAD_FOLDER'], job_id)
    os.makedirs(job_dir, exist_ok=True)
    
    saved_paths = []
    
    # Salvar todos os arquivos ignorando a estrutura de pastas do lado do cliente
    from werkzeug.utils import secure_filename
    for f in files:
        if f.filename:
            # Pega só o nome do arquivo final, para salvar tudo "plano" no job_dir
            basename = secure_filename(os.path.basename(f.filename))
            if not basename:
                # Fallback caso dê ruim no werkzeug ou basename retorne vazio
                basename = secure_filename(f.filename)
            path = os.path.join(job_dir, basename)
            f.save(path)
            saved_paths.append(path)
            
    # Extrair ZIPs IMEDIATAMENTE antes de perguntar o limpanome
    import zipfile
    zips = [f for f in saved_paths if f.lower().endswith('.zip')]
    for z in zips:
        if zipfile.is_zipfile(z):
            try:
                with zipfile.ZipFile(z, 'r') as zip_ref:
                    zip_ref.extractall(job_dir)
                 # Remover o zip original pra nao bugar a leitura de arquivos
                os.remove(z)
            except Exception as e:
                print(f"Error unzipping {z}: {e}")
                pass

    # Coletar a lista real de PDFs e DOCXs que exitem agora na pasta do job
    extracted_names = []
    for root, dirs, files_in_dir in os.walk(job_dir):
        for f in files_in_dir:
            if f.lower().endswith(('.pdf', '.docx')):
                extracted_names.append(f)
                
    # Guarda os paths base do job server-side 
    # Usaremos um cache simples em memoria
    app.config[f"JOB_{job_id}"] = job_dir
            
    return jsonify({"job_id": job_id, "files": extracted_names})

@app.route('/start_process', methods=['POST'])
def start_process():
    data = request.json
    job_id = data.get('job_id')
    texto_remover = data.get('texto_remover', '')
    
    job_dir = app.config.get(f"JOB_{job_id}")
    if not job_dir:
        return jsonify({"error": "Job não encontrado"}), 404
        
    # Recalcula paths finais
    saved_paths = []
    for root, dirs, files_in_dir in os.walk(job_dir):
        for f in files_in_dir:
            if f.lower().endswith(('.pdf', '.docx')):
                saved_paths.append(os.path.join(root, f))
    
    q = Queue()
    jobs[job_id] = q
    
    # Start processing thread
    thread = threading.Thread(target=process_files, args=(job_dir, saved_paths, texto_remover, q))
    thread.start()
    
    return jsonify({"status": "started"})

@app.route('/stream/<job_id>')
def stream(job_id):
    def event_stream():
        q = jobs.get(job_id)
        if not q:
            yield "data: {\"error\": \"Not found\"}\n\n"
            return
            
        while True:
            try:
                # O timeout garante que tenhamos um check-in, para n manter conexoes zumbis etermamente
                msg = q.get(timeout=30)
                import json
                yield f"data: {json.dumps(msg)}\n\n"
                
                if msg.get('type') in ('done', 'error'):
                    # Remove from jobs (mas preserva na config p download)
                    if job_id in jobs:
                        del jobs[job_id]
                    break
            except Empty:
                yield ": keep-alive\n\n"
    return Response(event_stream(), mimetype='text/event-stream')

@app.route('/download/<job_id>')
def download(job_id):
    job_dir = app.config.get(f"JOB_{job_id}")
    if not job_dir or not os.path.exists(job_dir):
        return "Not found", 404
        
    import zipfile
    import io
    memory_file = io.BytesIO()
    
    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(job_dir):
            for f in files:
                if f.lower().endswith(('.pdf', '.docx')):
                    filepath = os.path.join(root, f)
                    # Zip preserving the flat structure
                    zf.write(filepath, f)

    memory_file.seek(0)
    return Response(
        memory_file,
        mimetype="application/zip",
        headers={"Content-Disposition": f"attachment;filename=Arquivos_Validados.zip"}
    )

@app.route('/api/clean_status', methods=['GET'])
def clean_status():
    count = 0
    if os.path.exists(app.config['UPLOAD_FOLDER']):
        for root, dirs, files in os.walk(app.config['UPLOAD_FOLDER']):
            count += len(files)
    return jsonify({"count": count})

@app.route('/api/clean_uploads', methods=['POST'])
def clean_uploads():
    import shutil
    folder = app.config['UPLOAD_FOLDER']
    try:
        if os.path.exists(folder):
            shutil.rmtree(folder)
        os.makedirs(folder, exist_ok=True)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

if __name__ == '__main__':
    # Roda em localhost na porta 5000
    app.run(debug=True, port=5000)
