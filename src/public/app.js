document.addEventListener('DOMContentLoaded', () => {
  const uploadForm = document.getElementById('upload-form');
  const pdfInput = document.getElementById('pdf-input');
  const uploadBtn = document.getElementById('upload-btn');
  const fileInfo = document.getElementById('file-info');
  const fileName = document.getElementById('file-name');
  const uploadStatus = document.getElementById('upload-status');
  
  const queryForm = document.getElementById('query-form');
  const queryInput = document.getElementById('query-input');
  const sendBtn = document.getElementById('send-btn');
  const chatFeed = document.getElementById('chat-feed');
  const statusBar = document.getElementById('status-bar');
  const statusText = document.getElementById('status-text');
  const resetKbBtn = document.getElementById('reset-kb-btn');

  // Chroma Modal Elements
  const exploreChromaBtn = document.getElementById('explore-chroma-btn');
  const chromaModal = document.getElementById('chroma-modal');
  const closeChromaModal = document.getElementById('close-chroma-modal');
  const chromaCollectionName = document.getElementById('chroma-collection-name');
  const chromaVectorCount = document.getElementById('chroma-vector-count');
  const chromaDocsList = document.getElementById('chroma-docs-list');
  const chromaSearchFilter = document.getElementById('chroma-search-filter');

  let loadedChromaDocs = [];

  // Open Chroma DB Explorer Modal
  exploreChromaBtn.addEventListener('click', async () => {
    chromaModal.classList.remove('hidden');
    await loadChromaCollectionInfo();
  });

  closeChromaModal.addEventListener('click', () => {
    chromaModal.classList.add('hidden');
  });

  chromaSearchFilter.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = loadedChromaDocs.filter(d => 
      d.id.toLowerCase().includes(term) ||
      d.text.toLowerCase().includes(term) ||
      (d.metadata.source && d.metadata.source.toLowerCase().includes(term))
    );
    renderChromaDocs(filtered);
  });

  async function loadChromaCollectionInfo() {
    chromaDocsList.innerHTML = `<div class="text-center py-8 text-xs text-slate-500">Connecting to ChromaDB...</div>`;
    try {
      const res = await fetch('/api/rag/collection');
      const data = await res.json();

      chromaCollectionName.textContent = `Collection: ${data.collectionName || 'hybrid_rag_collection'}`;
      chromaVectorCount.textContent = `Indexed Vectors: ${data.totalCount || 0}`;

      loadedChromaDocs = data.documents || [];
      renderChromaDocs(loadedChromaDocs);
    } catch (err) {
      chromaDocsList.innerHTML = `<div class="text-center py-8 text-xs text-rose-400">Failed to load ChromaDB collection: ${escapeHtml(err.message)}</div>`;
    }
  }

  function renderChromaDocs(docs) {
    if (!docs || docs.length === 0) {
      chromaDocsList.innerHTML = `<div class="text-center py-8 text-xs text-slate-500">No vector documents found in collection. Upload a PDF first!</div>`;
      return;
    }

    chromaDocsList.innerHTML = docs.map((doc, idx) => `
      <div class="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs">
        <div class="flex items-center justify-between text-slate-400 font-mono text-[11px]">
          <span class="text-indigo-400 font-semibold">${escapeHtml(doc.id)}</span>
          <span>Source: ${escapeHtml(doc.metadata.source || 'PDF')} | Chunk #${(doc.metadata.chunkIndex ?? 0) + 1}</span>
        </div>
        <p class="text-slate-200 leading-relaxed font-sans bg-slate-900/60 p-3 rounded-lg border border-slate-800/60">
          ${escapeHtml(doc.text)}
        </p>
        <div class="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1">
          <span>Character Count: ${doc.text.length} chars</span>
          <span class="text-emerald-400">3072D Gemini Embedding Cached</span>
        </div>
      </div>
    `).join('');
  }

  // File Input Selection
  pdfInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      fileName.textContent = file.name;
      uploadStatus.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
      fileInfo.classList.remove('hidden');
    }
  });

  // Handle PDF Upload Form
  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const file = pdfInput.files[0];
    if (!file) {
      alert('Please select a PDF document to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    uploadBtn.disabled = true;
    uploadBtn.innerHTML = `
      <svg class="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span>Chunking & Indexing...</span>
    `;

    try {
      const response = await fetch('/api/rag/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Upload failed');

      alert(`Success: ${data.message} (${data.totalChunksIndexed} chunks indexed into Vector DB & BM25 Engine)`);
      uploadStatus.textContent = 'Indexed';
      uploadStatus.className = 'text-[10px] text-emerald-400 font-mono';
    } catch (err) {
      alert(`Error uploading file: ${err.message}`);
    } finally {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = `<span>Upload & Index Document</span>`;
    }
  });

  // Reset Collection
  resetKbBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to reset the knowledge base?')) return;
    try {
      const res = await fetch('/api/rag/reset', { method: 'POST' });
      const data = await res.json();
      alert(data.message);
    } catch (err) {
      alert(`Reset failed: ${err.message}`);
    }
  });

  // Handle Query Submission
  queryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const question = queryInput.value.trim();
    if (!question) return;

    appendUserMessage(question);
    queryInput.value = '';
    sendBtn.disabled = true;

    statusBar.classList.remove('hidden');
    updateStatus('Searching...');

    setTimeout(() => updateStatus('Vector Search (ChromaDB)...'), 300);
    setTimeout(() => updateStatus('BM25 Keyword Search...'), 600);
    setTimeout(() => updateStatus('Merging & Deduplicating Results...'), 900);
    setTimeout(() => updateStatus('Re-ranking Candidate Chunks...'), 1200);
    setTimeout(() => updateStatus('Generating Answer with Gemini...'), 1600);

    try {
      const res = await fetch('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to process query');

      appendAssistantMessage(data);

    } catch (err) {
      appendErrorMessage(err.message);
    } finally {
      statusBar.classList.add('hidden');
      sendBtn.disabled = false;
    }
  });

  function updateStatus(msg) {
    statusText.textContent = msg;
  }

  function appendUserMessage(text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'flex items-start justify-end space-x-3';
    msgDiv.innerHTML = `
      <div class="bg-indigo-600 text-white rounded-2xl rounded-tr-none p-4 max-w-xl text-sm shadow-md">
        ${escapeHtml(text)}
      </div>
    `;
    chatFeed.appendChild(msgDiv);
    scrollToBottom();
  }

  function appendAssistantMessage(data) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'flex items-start space-x-3';

    const confidenceColors = {
      High: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      Medium: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      Low: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    };

    const confClass = confidenceColors[data.confidence] || confidenceColors.Low;

    let sourcesHtml = '';
    if (data.sources && data.sources.length > 0) {
      sourcesHtml = `
        <div class="mt-4 pt-3 border-t border-slate-700/60">
          <details class="group">
            <summary class="cursor-pointer text-xs font-semibold text-slate-400 hover:text-indigo-400 flex items-center justify-between">
              <span>Retrieved Sources (${data.sources.length} top re-ranked chunks)</span>
              <span class="text-[10px] font-mono text-slate-500 group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div class="mt-3 space-y-2">
              ${data.sources
                .map(
                  (s, idx) => `
                <div class="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs">
                  <div class="flex items-center justify-between text-[11px] text-slate-400 font-mono mb-1">
                    <span class="text-indigo-400 font-semibold">Chunk #${s.chunkIndex + 1} (${s.source})</span>
                    <span>Score: ${(s.rerankScore || 0).toFixed(3)}</span>
                  </div>
                  <p class="text-slate-300 text-[11px] leading-relaxed line-clamp-3">${escapeHtml(s.text)}</p>
                </div>
              `
                )
                .join('')}
            </div>
          </details>
        </div>
      `;
    }

    msgDiv.innerHTML = `
      <div class="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-sm font-bold flex-shrink-0">
        AI
      </div>
      <div class="bg-slate-800/80 border border-slate-700/60 rounded-2xl rounded-tl-none p-4 max-w-2xl text-sm shadow-md">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-bold text-slate-300">Answer</span>
          <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${confClass}">
            Confidence: ${data.confidence} (${data.maxScore})
          </span>
        </div>
        
        <div class="answer-text text-slate-200 leading-relaxed whitespace-pre-wrap"></div>

        ${sourcesHtml}
      </div>
    `;

    chatFeed.appendChild(msgDiv);
    scrollToBottom();

    const answerContainer = msgDiv.querySelector('.answer-text');
    typeText(answerContainer, data.answer);
  }

  function appendErrorMessage(msg) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'flex items-start space-x-3';
    msgDiv.innerHTML = `
      <div class="w-8 h-8 rounded-lg bg-rose-600/30 border border-rose-500/30 flex items-center justify-center text-rose-400 text-sm font-bold flex-shrink-0">
        !
      </div>
      <div class="bg-rose-950/40 border border-rose-800/50 rounded-2xl rounded-tl-none p-4 max-w-xl text-sm text-rose-200">
        <strong>Error:</strong> ${escapeHtml(msg)}
      </div>
    `;
    chatFeed.appendChild(msgDiv);
    scrollToBottom();
  }

  function typeText(element, text) {
    let index = 0;
    element.textContent = '';
    const timer = setInterval(() => {
      if (index < text.length) {
        element.textContent += text.charAt(index);
        index++;
        scrollToBottom();
      } else {
        clearInterval(timer);
      }
    }, 12);
  }

  function scrollToBottom() {
    chatFeed.scrollTop = chatFeed.scrollHeight;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});
