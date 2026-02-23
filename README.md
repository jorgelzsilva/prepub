# Prepub Validator v2.0

O **Terminal Prepub** é uma aplicação Web local projetada para automatizar, validar e padronizar o processo de checagem estrutural (arquivos Word/DOCX) e de paginação (PDF/DOCX) de arquivos educacionais e editoriais antes da publicação.

A aplicação conta com uma interface inspirada em terminais antigos (estilo Brutalista/CRT), oferecendo feedback em tempo real das operações via Websockets/Server-Sent Events (SSE).

## 🚀 Funcionalidades Principais

* **Validação Estrutural (DOCX):** Verifica se a ordem das questões (Enunciados e Alternativas) e dos gabaritos estão sequenciais e batem em quantidade, emitindo alertas detalhados sobre numeração corrompida ou alternativas faltantes.
* **Validação de Paginação:** Lê cabeçalhos de PDFs OCRizados e arquivos DOCX em busca da numeração da página inicial e final (ex: `10-15`). O painel cruza os dados para acusar se um PDF está sem o respectivo DOCX, ou se há documentos duplicados disputando a mesma página.
* **Limpa-Nome (Opcional):** Permite especificar um prefixo textual para ser removido automaticamente do nome de todos os arquivos.
* **Download em Lote:** Compacta automaticamente todos os arquivos processados (em seu estado estrutural legível e renomeado) em um único arquivo ZIP para devolução rápida ao redator.
* **Garbage Collector:** Lixeira virtual integrada no painel para limpeza profunda de pastas e arquivos temporários de sessão no servidor.

## ⚙️ Arquitetura e Componentes

A aplicação é dividida em blocos bem definidos:

### 1. Backend (`app.py` e `core/processamento.py`)
Escrito em **Python** usando a micro-framework **Flask**.
* `app.py`: Gerencia as sessões de upload (criando e isolando GUIDs para cada envio), fornece os nós das APIs, processa chamadas de extração de ZIP e transmite as linhas do Terminal em tempo real via *Server-Sent Events*.
* `core/processamento.py`: É o cérebro da lógica. Extrai textos via `python-docx` e `fitz` (PyMuPDF), faz limpezas textuais por Expressões Regulares (RegEx), e realiza a auditoria estrutural herdada do antigo `validar_questoes`.

### 2. Frontend (`templates/` e `static/`)
Construído em **HTML5 Vanilla, CSS3 e Javascript**.
* `index.html`: Define o esqueleto das Zonas de Upload, Terminal de Logs e Painel de Relatórios.
* `style.css`: Gerencia as cores verde-fósforo, efeitos CRT (Scanlines, sombreamentos de tubo de imagem) e as pulsações de alertas UI.
* `script.js`: Cuida do fluxo UX do usuário (drag-and-drop, captura da lista de arquivos sem recarregar a página, e preenchimento das tabelas de relatórios via DOM Javascript).

---

## 🛠️ Como Instalar as Dependências

A aplicação exige **Python 3.8+** para ser executada. A maneira mais segura de rodar é utilizando um Ambiente Virtual (`venv`).

### 1. Clonando o Repositório
```bash
git clone https://github.com/jorgelzsilva/prepub.git
cd prepub
```

### 2. Criando e Ativando o Ambiente Virtual

Crie o ambiente chamado `prepub` e ative-o conforme o seu sistema operacional:

**No Windows (Prompt de Comando ou PowerShell):**
```cmd
python -m venv prepub
prepub\Scripts\activate
```

**No Linux ou Windows WSL:**
```bash
python3 -m venv prepub
source prepub/bin/activate
```

### 3. Instalando as Bibliotecas
Com o ambiente ativado, instale os pacotes definidos no projeto (Flask, python-docx, PyMuPDF, Werkzeug):
```bash
pip install -r requirements.txt
```

---

## ▶️ Como Usar a Aplicação

1. Para iniciar o servidor local, certifique-se de que o ambiente virtual está ativo (`(prepub)` aparecerá no terminal).
2. Execute o servidor do Flask:
```bash
python app.py
```
3. O terminal avisará que o servidor está rodando na porta `5000`.
4. Abra seu navegador web (Google Chrome, Edge, Safari...) e acesse o endereço:
   👉 **`http://localhost:5000`** ou **`http://127.0.0.1:5000`**

### Fluxo de Trabalho na Tela:
1. **Envio:** Arraste uma pasta ZIP contendo os PDFs/DOCXs para a caixa pontilhada, ou clique em `[SELECIONAR PASTA]`.
2. **Pré-visualização:** A aplicação informará "X ARQUIVOS IDENTIFICADOS PRONTOS". Ela abrirá o ZIP no lado do servidor e listará quais arquivos são reconhecidos.
3. **Parametrização:** Se desejar limpar prefixos, digite a palavra no campo *[OPCIONAL] TEXTO A REMOVER*.
4. **Validação:** Clique no botão de `INICIAR VALIDAÇÃO OCR E ESTRUTURAL`.
5. **Relatórios:** O terminal verde varrerá tudo. Ao final, confira a aba de relatórios com as anomalias, feche baixando os arquivos compactados em `[↓] BAIXAR ARQUIVOS PROCESSADOS` ou esvazie o cache no botão de **Lixeira** `[ 🗑️ ]` do menu superior.

---
_Desenvolvido por Jorge L. Silva_
