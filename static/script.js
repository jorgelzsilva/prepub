const dropZone = document.getElementById('upload-zone');
const configZone = document.getElementById('config-zone');
const btnCancel = document.getElementById('btn-cancel');
const btnStart = document.getElementById('btn-start');
const filesCountMsg = document.getElementById('files-count-msg');
const btnSelectFolder = document.getElementById('btn-select-folder');
const btnSelectFiles = document.getElementById('btn-select-files');
const fileInputFolder = document.getElementById('file-input-folder');
const fileInputFiles = document.getElementById('file-input-files');
const terminal = document.getElementById('terminal');
const logOutput = document.getElementById('log-output');
const resultsPanel = document.getElementById('results-panel');
const resultsTbody = document.getElementById('results-tbody');
const statusSubtitle = document.getElementById('status-subtitle');
const btnReset = document.getElementById('btn-reset');

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
});

dropZone.addEventListener('drop', handleDrop, false);

// Button clicks route to hidden inputs
btnSelectFolder.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInputFolder.click();
});
btnSelectFiles.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInputFiles.click();
});

// Avoid triggering input clicks twice if clicking dropzone
// Removed dropZone.click listener to prevent double prompt.

fileInputFolder.addEventListener('change', function () { handleFiles(this.files); });
fileInputFiles.addEventListener('change', function () { handleFiles(this.files); });

function handleDrop(e) {
    let df = e.dataTransfer;
    let files = df.files;
    handleFiles(files);
}

function handleFiles(files) {
    if (files.length === 0) return;

    // Filter only zip, pdf, docx
    const validFiles = Array.from(files).filter(f =>
        f.name.toLowerCase().endsWith('.zip') ||
        f.name.toLowerCase().endsWith('.pdf') ||
        f.name.toLowerCase().endsWith('.docx')
    );

    if (validFiles.length === 0) {
        alert("Nenhum arquivo válido (.zip, .pdf, .docx) encontrado!");
        return;
    }

    window.selectedFiles = validFiles;
    // Inicia o upload imediatamente para extrair os arquivos no servidor
    startUpload(validFiles);
}

if (btnCancel) {
    btnCancel.addEventListener('click', () => {
        configZone.classList.add('hidden');
        dropZone.classList.remove('hidden');
        window.selectedFiles = [];
        fileInputFolder.value = '';
        fileInputFiles.value = '';
        window.currentJobId = null;
    });
}

const btnTrash = document.getElementById('btn-trash');
if (btnTrash) {
    btnTrash.addEventListener('click', () => {
        fetch('/api/clean_status')
            .then(r => r.json())
            .then(data => {
                if (data.count === 0) {
                    alert("[ SYS ] Sistema Limpo. Nenhum arquivo na lixeira para excluir.");
                    return;
                }

                const msg = `[!] ATENÇÃO: ${data.count} arquivo(s) temporário(s), relatórios e caches de extração encontrados no servidor.\n\nDeseja excluir permanentemente o conteúdo da pasta uploads?`;
                if (confirm(msg)) {
                    fetch('/api/clean_uploads', { method: 'POST' })
                        .then(r => r.json())
                        .then(res => {
                            if (res.success) {
                                alert("[ SYS ] Limpeza concluída com sucesso.");
                            } else {
                                alert("[ ERROR ] Falha ao apagar arquivos: " + res.error);
                            }
                        });
                }
            })
            .catch(err => alert("Erro ao contatar servidor: " + err));
    });
}

function startUpload(files) {
    statusSubtitle.innerText = 'ESTABELECENDO CONEXÃO UPLINK...';

    // Mostra tela intermediaria avisando upload
    dropZone.classList.add('hidden');
    configZone.classList.remove('hidden');
    filesCountMsg.innerText = `>> FAZENDO UPLOAD DE ${files.length} PACOTE(S)...`;
    btnStart.disabled = true;
    btnStart.innerText = ">> ENVIANDO E EXTRAINDO... AGUARDE";
    document.getElementById('file-list-preview').innerHTML = '>> EXTENSIONANDO PACOTES... ESTABELECENDO HASHES...';

    const formData = new FormData();
    files.forEach(f => formData.append('files', f));

    fetch('/upload_pre', {
        method: 'POST',
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.job_id) {
                window.currentJobId = data.job_id;

                // Popula file list no UI preview
                const fileListEl = document.getElementById('file-list-preview');
                fileListEl.innerHTML = '';

                if (data.files && data.files.length > 0) {
                    filesCountMsg.innerText = `>> ${data.files.length} ARQUIVO(S) IDENTIFICADOS PRONTOS PARA ANÁLISE`;
                    data.files.forEach(f => {
                        const el = document.createElement('div');
                        el.innerText = `>> ${f}`;
                        fileListEl.appendChild(el);
                    });
                } else {
                    filesCountMsg.innerText = `>> 0 ARQUIVOS IDENTIFICADOS`;
                    fileListEl.innerText = '>> NENHUM PDF OU DOCX ENCONTRADO.';
                }

                btnStart.disabled = false;
                btnStart.innerText = ">> INICIAR VALIDAÇÃO OCR E ESTRUTURAL";
                statusSubtitle.innerText = 'AGUARDANDO PARAMETRIZAÇÃO...';

            } else {
                alert("Falha recebida do servidor durante extração.");
                console.error(data);
            }
        })
        .catch(err => {
            alert("Erro de conexão ao Servidor: " + err.message);
        });
}

btnStart.addEventListener('click', (e) => {
    e.preventDefault();
    if (!window.currentJobId) return;

    configZone.classList.add('hidden');
    terminal.classList.remove('hidden');
    resultsPanel.classList.add('hidden');
    logOutput.innerHTML = '';

    const textoRemover = document.getElementById('texto-remover').value.trim();

    fetch('/start_process', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            job_id: window.currentJobId,
            texto_remover: textoRemover
        })
    })
        .then(r => r.json())
        .then(res => {
            if (res.status === 'started') {
                connectStream(window.currentJobId);
            } else {
                appendLog('[ ERROR ] ' + res.error, 'error');
            }
        })
        .catch(err => {
            appendLog('[ ERROR ] Falha ao Iniciar Processo: ' + err.message, 'error');
        });
});

function connectStream(jobId) {
    statusSubtitle.innerText = 'PROCESSANDO DADOS VIA SOCKET...';
    const eventSource = new EventSource('/stream/' + jobId);

    eventSource.onmessage = function (event) {
        const data = JSON.parse(event.data);

        if (data.type === 'log') {
            appendLog(data.msg);
        } else if (data.type === 'done') {
            eventSource.close();
            appendLog('[ SYS ] Conexão encerrada pelo host.');
            statusSubtitle.innerText = 'ANÁLISE CONCLUÍDA. AGUARDANDO COMANDOS.';
            renderResults(data.msg);
        } else if (data.type === 'error') {
            eventSource.close();
            appendLog('[ FATAL ] ' + data.msg, 'error');
            statusSubtitle.innerText = 'FALHA DE SISTEMA.';
        }
    };

    eventSource.onerror = function () {
        eventSource.close();
        appendLog('[ ERROR ] Conexão SSE perdida.', 'error');
    };
}

function appendLog(msg, type = '') {
    const div = document.createElement('div');
    div.className = 'log-line ' + type;

    // Colorize status tags like [ OK ] loosely
    let formattedMsg = msg;
    if (msg.includes('[ OK ]')) formattedMsg = msg.replace('[ OK ]', '<span class="status-ok">[ OK ]</span>');
    if (msg.includes('[ ERROR ]')) formattedMsg = msg.replace('[ ERROR ]', '<span class="status-falhou">[ ERROR ]</span>');
    if (msg.includes('[ WAIT ]')) formattedMsg = msg.replace('[ WAIT ]', '<span style="color:var(--warning)">[ WAIT ]</span>');

    div.innerHTML = '> ' + formattedMsg;
    logOutput.appendChild(div);
    logOutput.scrollTop = logOutput.scrollHeight;
}

function renderResults(data) {
    setTimeout(() => {
        terminal.classList.add('hidden');
        resultsPanel.classList.remove('hidden');

        // Atribui o link de download pro job atual
        const btnDownload = document.getElementById('btn-download');
        if (btnDownload && window.currentJobId) {
            btnDownload.href = `/download/${window.currentJobId}`;
        }

        resultsTbody.innerHTML = '';

        data.results.forEach(res => {
            const tr = document.createElement('tr');

            // Status cell
            const tdStatus = document.createElement('td');
            tdStatus.className = 'status-' + res.status.toLowerCase();
            tdStatus.innerText = '[' + res.status + ']';

            // Pag cell
            const tdPag = document.createElement('td');
            tdPag.innerText = res.pag;

            // Files cell
            const tdFiles = document.createElement('td');
            let filesHtml = '';
            res.pdfs.forEach(f => {
                filesHtml += `<span class="file-tag pdf">PDF: ${f}</span>`;
            });
            res.docs.forEach(d => {
                filesHtml += `<span class="file-tag docx">DOCX: ${d.name}</span>`;
            });
            tdFiles.innerHTML = filesHtml;

            tr.appendChild(tdStatus);
            tr.appendChild(tdPag);
            tr.appendChild(tdFiles);
            resultsTbody.appendChild(tr);
        });

        // Tabela DOCX
        const resultsDocxTbody = document.getElementById('results-docx-tbody');
        resultsDocxTbody.innerHTML = '';

        let allDocs = [];
        data.results.forEach(res => {
            res.docs.forEach(d => allDocs.push(d));
        });

        // Remover duplicatas caso o parse_pages tenha pego o msm doc em pags diferentes (nao deve, mas por segurança)
        let uniqueDocs = [];
        let seenNames = new Set();
        for (let d of allDocs) {
            if (!seenNames.has(d.name)) {
                seenNames.add(d.name);
                uniqueDocs.push(d);
            }
        }

        uniqueDocs.forEach(d => {
            const tr = document.createElement('tr');

            const tdStatus = document.createElement('td');
            if (d.struct_ok) {
                tdStatus.className = 'status-ok';
                tdStatus.innerText = '[ OK ]';
            } else {
                tdStatus.className = 'status-falhou';
                tdStatus.innerText = '[ FALHOU ]';
            }

            const tdName = document.createElement('td');
            tdName.innerText = d.name;

            const tdDetails = document.createElement('td');
            if (d.struct_ok) {
                tdDetails.style.color = "var(--text-muted)";
                tdDetails.innerText = d.struct_msg;
            } else {
                tdDetails.style.color = "var(--error)";
                tdDetails.innerText = d.struct_errors.join(" | ");
            }

            tr.appendChild(tdStatus);
            tr.appendChild(tdName);
            tr.appendChild(tdDetails);
            resultsDocxTbody.appendChild(tr);
        });

        // Erros
        const errorsPanel = document.getElementById('errors-panel');
        const errorList = document.getElementById('error-list');
        errorList.innerHTML = '';
        if (data.sem_padrao && data.sem_padrao.length > 0) {
            errorsPanel.classList.remove('hidden');
            data.sem_padrao.forEach(f => {
                const li = document.createElement('li');
                li.innerText = f;
                errorList.appendChild(li);
            });
        } else {
            errorsPanel.classList.add('hidden');
        }

    }, 800); // short delay after it finishes to show results
}

btnReset.addEventListener('click', () => {
    resultsPanel.classList.add('hidden');
    dropZone.classList.remove('hidden');
    fileInputFolder.value = '';
    fileInputFiles.value = '';
    statusSubtitle.innerText = 'AWAITING PAYLOAD INJECTION...';
});
