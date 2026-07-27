const express = require('express');
const { ChromaClient } = require('chromadb');

const app = express();
const port = process.env.PORT || 8000;
const chromaUrl = process.env.CHROMA_URL || 'http://chromadb:8000';
const client = new ChromaClient({ path: chromaUrl });

app.get('/api/data', async (req, res) => {
  try {
    let collectionsList = [];

    // Fetch collections via Chroma v2 API
    try {
      const v2Res = await fetch(`${chromaUrl}/api/v2/tenants/default_tenant/databases/default_database/collections`);
      if (v2Res.ok) {
        collectionsList = await v2Res.json();
      }
    } catch (e) {
      console.warn('v2 fetch fallback:', e.message);
    }

    if (!collectionsList || collectionsList.length === 0) {
      // Fallback
      collectionsList = [{ name: 'hybrid_rag_collection' }];
    }

    const result = [];

    for (const col of collectionsList) {
      const colName = col.name || 'hybrid_rag_collection';
      try {
        const collection = await client.getOrCreateCollection({ name: colName });
        const count = await collection.count();
        const getResults = await collection.get({
          limit: 200,
          include: ['documents', 'metadatas'],
        });

        const docs = (getResults.ids || []).map((id, idx) => ({
          id,
          text: getResults.documents ? getResults.documents[idx] : '',
          metadata: getResults.metadatas ? getResults.metadatas[idx] : {},
        }));

        result.push({
          name: colName,
          count,
          dimension: col.dimension || 3072,
          documents: docs,
        });
      } catch (err) {
        console.warn(`Error getting collection ${colName}:`, err.message);
      }
    }

    res.json({ success: true, chromaUrl, collections: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, chromaUrl });
  }
});

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ChromaDB Developer Admin UI</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body class="bg-slate-950 text-slate-100 font-sans p-8 antialiased">
  <div class="max-w-6xl mx-auto space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-slate-800 pb-4">
      <div>
        <h1 class="text-xl font-bold text-indigo-400 flex items-center gap-2">
          ⚡ ChromaDB Developer Admin UI
        </h1>
        <p class="text-xs text-slate-400 font-mono mt-1">Docker Target: ${chromaUrl}</p>
      </div>
      <button onclick="loadData()" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-lg transition-all">
        🔄 Refresh Data
      </button>
    </div>

    <!-- Stats Summary -->
    <div id="stats" class="grid grid-cols-3 gap-4 text-xs font-mono">
      <div class="bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <span class="text-slate-400">Total Collections</span>
        <p id="total-cols" class="text-xl font-bold text-white mt-1">-</p>
      </div>
      <div class="bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <span class="text-slate-400">Total Vectors Stored</span>
        <p id="total-vecs" class="text-xl font-bold text-emerald-400 mt-1">-</p>
      </div>
      <div class="bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <span class="text-slate-400">Connection Status</span>
        <p id="status" class="text-xl font-bold text-emerald-400 mt-1">Checking...</p>
      </div>
    </div>

    <!-- Filter input -->
    <input type="text" id="filter" oninput="applyFilter()" placeholder="Filter vectors by ID, text snippet, or metadata..." class="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:border-indigo-500 outline-none">

    <!-- Collections & Vectors list -->
    <div id="collections-list" class="space-y-6">
      <div class="text-center py-12 text-slate-500 text-xs">Loading ChromaDB collections...</div>
    </div>
  </div>

  <script>
    let rawCollections = [];

    async function loadData() {
      const container = document.getElementById('collections-list');
      container.innerHTML = '<div class="text-center py-12 text-slate-500 text-xs">Fetching collections...</div>';
      
      try {
        const res = await fetch('/api/data');
        const data = await res.json();

        if (!data.success) throw new Error(data.error);

        rawCollections = data.collections || [];
        document.getElementById('total-cols').textContent = rawCollections.length;
        document.getElementById('total-vecs').textContent = rawCollections.reduce((acc, c) => acc + c.count, 0);
        document.getElementById('status').textContent = 'Online';

        render(rawCollections);
      } catch (err) {
        document.getElementById('status').textContent = 'Disconnected';
        document.getElementById('status').className = 'text-xl font-bold text-rose-400 mt-1';
        container.innerHTML = '<div class="text-center py-12 text-rose-400 text-xs">Failed to connect: ' + err.message + '</div>';
      }
    }

    function render(cols) {
      const container = document.getElementById('collections-list');
      if (cols.length === 0) {
        container.innerHTML = '<div class="text-center py-12 text-slate-500 text-xs">No collections found in ChromaDB.</div>';
        return;
      }

      container.innerHTML = cols.map(col => \`
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div class="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 class="text-sm font-bold text-slate-200 font-mono">Collection: \${col.name}</h2>
            <span class="px-3 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full text-xs font-mono">
              \${col.count} Vectors
            </span>
          </div>

          <div class="space-y-3">
            \${col.documents.map((doc, idx) => \`
              <div class="bg-slate-950 border border-slate-800/80 rounded-xl p-4 text-xs font-mono space-y-2">
                <div class="flex items-center justify-between text-[11px] text-slate-400">
                  <span class="text-indigo-400 font-bold">\${doc.id}</span>
                  <span>Source: \${doc.metadata.source || 'Unknown'} | Chunk #\${(doc.metadata.chunkIndex ?? 0) + 1}</span>
                </div>
                <p class="text-slate-300 font-sans text-xs leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-800/50 whitespace-pre-wrap">
                  \${doc.text}
                </p>
                <div class="text-[10px] text-slate-500 flex items-center justify-between">
                  <span>Chars: \${doc.text.length}</span>
                  <span class="text-emerald-400 font-semibold">\${col.dimension || 3072}D Gemini Embedding</span>
                </div>
              </div>
            \`).join('')}
          </div>
        </div>
      \`).join('');
    }

    function applyFilter() {
      const q = document.getElementById('filter').value.toLowerCase();
      const filtered = rawCollections.map(col => ({
        ...col,
        documents: col.documents.filter(d => 
          d.id.toLowerCase().includes(q) || 
          d.text.toLowerCase().includes(q) ||
          (d.metadata.source && d.metadata.source.toLowerCase().includes(q))
        )
      }));
      render(filtered);
    }

    loadData();
  </script>
</body>
</html>
  `);
});

app.listen(port, () => {
  console.log(`ChromaDB Admin UI running on port ${port}, connecting to ${chromaUrl}`);
});
