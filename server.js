const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const API_BASE = 'https://api.sansekai.my.id/api/moviebox';

// ==========================================
// BACKEND PROXY & LOGIC
// ==========================================

// 1. Endpoint Homepage
app.get('/api/home', async (req, res) => {
    try {
        const { data } = await axios.get(`${API_BASE}/homepage`);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Endpoint Trending
app.get('/api/trending', async (req, res) => {
    try {
        const { data } = await axios.get(`${API_BASE}/trending`);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Endpoint Search
app.get('/api/search', async (req, res) => {
    try {
        const { query, page = 1 } = req.query;
        const { data } = await axios.get(`${API_BASE}/search?query=${encodeURIComponent(query)}&page=${page}`);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Endpoint Detail Movie/Series
app.get('/api/detail', async (req, res) => {
    try {
        const { subjectId } = req.query;
        const { data } = await axios.get(`${API_BASE}/detail?subjectId=${subjectId}`);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Endpoint Stream & Resolve URL
app.get('/api/stream', async (req, res) => {
    try {
        const { subjectId, season = 0, episode = 0 } = req.query;
        
        // Ambil Source Downloads & Captions
        const sourceUrl = `${API_BASE}/sources?subjectId=${subjectId}&season=${season}&episode=${episode}`;
        const { data: sourceData } = await axios.get(sourceUrl);
        
        if (!sourceData || !sourceData.downloads || sourceData.downloads.length === 0) {
            return res.status(404).json({ error: "Sumber video tidak ditemukan." });
        }
        
        // Cari URL download beresolusi paling tinggi
        const bestSource = sourceData.downloads[sourceData.downloads.length - 1];
        const dlUrl = bestSource.url;
        
        // Ekstrak URL Subtitle Indonesia (lan: "id" atau "Indonesian")
        let subtitleUrl = null;
        if (sourceData.captions) {
            const indoCap = sourceData.captions.find(c => c.lan === 'id' || c.lanName === 'Indonesian');
            if (indoCap) {
                // Diarahkan ke proxy internal kita untuk diconvert ke VTT
                subtitleUrl = `/api/subtitle?url=${encodeURIComponent(indoCap.url)}`;
            }
        }

        // Generate URL Streaming Final
        const genUrl = `${API_BASE}/generate-link-stream-video?url=${encodeURIComponent(dlUrl)}`;
        const { data: genData } = await axios.get(genUrl);

        res.json({
            success: true,
            streamUrl: genData.streamUrl,
            subtitleUrl: subtitleUrl
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 6. Proxy Subtitle (Konversi Otomatis SRT ke WebVTT untuk native player)
app.get('/api/subtitle', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).send("URL subtitle tidak tersedia.");
        
        const { data: srtData } = await axios.get(url);
        
        // Konversi format waktu SRT (,) ke WebVTT (.)
        const vttData = "WEBVTT\n\n" + srtData.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
        
        res.header('Content-Type', 'text/vtt; charset=utf-8');
        res.send(vttData);
    } catch (err) {
        res.status(500).send("");
    }
});

// ==========================================
// FRONTEND (HTML + CSS + JS) 
// ==========================================
const HTML_CONTENT = `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NeoStream | Premium Movie Platform</title>
    <style>
        :root {
            --bg-color: #07070a;
            --neon-cyan: #00f3ff;
            --neon-purple: #9d00ff;
            --glass-bg: rgba(255, 255, 255, 0.03);
            --glass-border: rgba(255, 255, 255, 0.08);
            --text-main: #e0e0e0;
        }

        * { box-sizing: border-box; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        body { margin: 0; background-color: var(--bg-color); color: var(--text-main); overflow-x: hidden; }
        
        /* Typography & Utility */
        h1, h2, h3 { color: #fff; }
        .neon-text { text-shadow: 0 0 10px var(--neon-cyan), 0 0 20px var(--neon-purple); }
        .glass { background: var(--glass-bg); backdrop-filter: blur(12px); border: 1px solid var(--glass-border); border-radius: 16px; }
        
        /* Navbar */
        nav { display: flex; justify-content: space-between; align-items: center; padding: 20px 5%; position: sticky; top: 0; z-index: 100; border-bottom: 1px solid var(--glass-border); background: rgba(7,7,10,0.8); backdrop-filter: blur(10px); }
        nav h1 { margin: 0; font-size: 24px; font-weight: 900; letter-spacing: 2px; }
        .search-box { display: flex; gap: 10px; }
        .search-box input { padding: 10px 15px; border-radius: 8px; border: 1px solid var(--neon-purple); background: transparent; color: white; outline: none; width: 250px; }
        .search-box input:focus { box-shadow: 0 0 10px var(--neon-purple); }
        .btn-neon { background: linear-gradient(45deg, var(--neon-purple), var(--neon-cyan)); border: none; color: white; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.3s; }
        .btn-neon:hover { transform: scale(1.05); box-shadow: 0 0 15px var(--neon-cyan); }

        /* Container & Cards */
        .container { padding: 40px 5%; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 25px; }
        .card { cursor: pointer; transition: 0.4s; overflow: hidden; position: relative; }
        .card img { width: 100%; height: 300px; object-fit: cover; border-radius: 12px 12px 0 0; }
        .card-info { padding: 15px; }
        .card:hover { transform: translateY(-10px); box-shadow: 0 10px 20px rgba(0, 243, 255, 0.2); border-color: var(--neon-cyan); }
        
        /* Scroll Reveal Animation */
        .reveal { opacity: 0; transform: translateY(50px); transition: all 0.8s cubic-bezier(0.5, 0, 0, 1); }
        .reveal.visible { opacity: 1; transform: translateY(0); }

        /* Modal Detail */
        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 999; background: rgba(0,0,0,0.8); backdrop-filter: blur(5px); justify-content: center; align-items: center; }
        .modal-content { width: 90%; max-width: 900px; max-height: 90vh; overflow-y: auto; padding: 30px; position: relative; }
        .close-btn { position: absolute; right: 20px; top: 20px; font-size: 24px; cursor: pointer; color: var(--neon-cyan); }
        .detail-header { display: flex; gap: 30px; margin-bottom: 30px; }
        .detail-header img { width: 250px; border-radius: 12px; box-shadow: 0 0 20px var(--neon-purple); }
        
        /* Player & Episodes */
        .player-container { margin-top: 20px; width: 100%; border-radius: 12px; overflow: hidden; box-shadow: 0 0 30px rgba(0,243,255,0.3); display: none; }
        video { width: 100%; display: block; }
        .episode-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(60px, 1fr)); gap: 10px; margin-top: 15px; }
        .ep-btn { padding: 10px; text-align: center; background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 8px; cursor: pointer; transition: 0.3s; color: white; }
        .ep-btn:hover { background: var(--neon-purple); border-color: var(--neon-cyan); }
        
        /* Loading */
        #loader { text-align: center; margin: 40px 0; color: var(--neon-cyan); display: none; font-size: 1.2rem;}
    </style>
</head>
<body>

    <nav>
        <h1 class="neon-text">NeoStream</h1>
        <div class="search-box">
            <input type="text" id="searchInput" placeholder="Cari film atau series...">
            <button class="btn-neon" onclick="searchMovies()">Cari</button>
        </div>
    </nav>

    <div class="container">
        <h2 class="neon-text">🔥 Sedang Trending</h2>
        <div id="loader">Memuat data dari server...</div>
        <div class="grid" id="movieGrid"></div>
    </div>

    <div class="modal" id="detailModal">
        <div class="modal-content glass reveal visible">
            <span class="close-btn" onclick="closeModal()">✖</span>
            
            <div class="detail-header" id="modalHeader">
                </div>

            <div id="episodeSection" style="display: none;">
                <h3 class="neon-text">Pilih Episode</h3>
                <div class="episode-grid" id="episodeList"></div>
            </div>

            <div class="player-container" id="playerContainer">
                <video id="videoPlayer" controls crossorigin="anonymous">
                    <source id="videoSource" src="" type="video/mp4">
                    <track id="videoTrack" label="Indonesia" kind="subtitles" srclang="id" src="" default>
                    Browser Anda tidak mendukung HTML5 video.
                </video>
            </div>
        </div>
    </div>

    <script>
        // Inisialisasi Intersection Observer untuk Scroll Reveal Animasi
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, { threshold: 0.1 });

        // Fetch Trending di Awal
        async function loadTrending() {
            showLoader(true);
            try {
                const res = await fetch('/api/trending');
                const data = await res.json();
                renderGrid(data.subjectList || []);
            } catch (err) {
                console.error(err);
            }
            showLoader(false);
        }

        // Fetch Search
        async function searchMovies() {
            const query = document.getElementById('searchInput').value;
            if(!query) return loadTrending();
            
            showLoader(true);
            try {
                const res = await fetch(\`/api/search?query=\${query}\`);
                const data = await res.json();
                renderGrid(data.items || []);
            } catch (err) {
                console.error(err);
            }
            showLoader(false);
        }

        // Render Card Grid
        function renderGrid(items) {
            const grid = document.getElementById('movieGrid');
            grid.innerHTML = '';
            items.forEach(item => {
                const card = document.createElement('div');
                card.className = 'card glass reveal';
                card.onclick = () => openDetail(item.subjectId);
                card.innerHTML = \`
                    <img src="\${item.cover.url}" alt="\${item.title}">
                    <div class="card-info">
                        <h3 style="margin: 0 0 5px 0; font-size: 16px;">\${item.title}</h3>
                        <small style="color: #aaa;">\${item.releaseDate.split('-')[0]} • \${item.genre}</small>
                    </div>
                \`;
                grid.appendChild(card);
                observer.observe(card); // Attach Animasi Scroll
            });
        }

        // Buka Modal & Ambil Detail Penuh
        async function openDetail(subjectId) {
            document.getElementById('detailModal').style.display = 'flex';
            document.getElementById('playerContainer').style.display = 'none';
            document.getElementById('episodeSection').style.display = 'none';
            const header = document.getElementById('modalHeader');
            header.innerHTML = '<p>Memuat detail...</p>';

            try {
                const res = await fetch(\`/api/detail?subjectId=\${subjectId}\`);
                const { subject } = await res.json();

                header.innerHTML = \`
                    <img src="\${subject.cover.url}" alt="Cover">
                    <div>
                        <h2 class="neon-text" style="font-size: 32px; margin-top: 0;">\${subject.title}</h2>
                        <p style="color: #bbb;">⭐ \${subject.imdbRatingValue} | \${subject.countryName}</p>
                        <p><strong>Genre:</strong> \${subject.genre}</p>
                        <p style="line-height: 1.6;">\${subject.description || 'Deskripsi tidak tersedia.'}</p>
                        \${subject.subjectType === 1 ? \`<button class="btn-neon" style="margin-top: 20px;" onclick="playVideo('\${subjectId}', 0, 0)">▶ Play Movie</button>\` : ''}
                    </div>
                \`;

                // Handle Series: Munculkan Semua Episode
                if (subject.subjectType === 2) {
                    document.getElementById('episodeSection').style.display = 'block';
                    const epList = document.getElementById('episodeList');
                    epList.innerHTML = '';
                    
                    // Deteksi struktur maxEp dari response API
                    let maxEp = 12; // Fallback default
                    if (subject.resolutions && subject.resolutions.length > 0) {
                        const topRes = subject.resolutions[subject.resolutions.length - 1];
                        if (topRes.epNum) maxEp = topRes.epNum;
                    }
                    
                    for (let i = 1; i <= maxEp; i++) {
                        const btn = document.createElement('div');
                        btn.className = 'ep-btn';
                        btn.innerText = 'Ep ' + i;
                        // Default mainkan season 1
                        btn.onclick = () => playVideo(subjectId, 1, i);
                        epList.appendChild(btn);
                    }
                }

            } catch (err) {
                header.innerHTML = '<p>Gagal memuat detail data.</p>';
            }
        }

        // Putar Video & Bind Subtitle
        async function playVideo(subjectId, season, episode) {
            const playerCont = document.getElementById('playerContainer');
            const video = document.getElementById('videoPlayer');
            const track = document.getElementById('videoTrack');
            
            playerCont.style.display = 'none';
            video.pause();
            
            try {
                const res = await fetch(\`/api/stream?subjectId=\${subjectId}&season=\${season}&episode=\${episode}\`);
                const data = await res.json();
                
                if (data.success && data.streamUrl) {
                    playerCont.style.display = 'block';
                    video.src = data.streamUrl;
                    
                    // Tautkan Subtitle jika ada
                    if (data.subtitleUrl) {
                        track.src = data.subtitleUrl;
                    } else {
                        track.removeAttribute('src');
                    }
                    
                    video.play();
                    playerCont.scrollIntoView({ behavior: 'smooth' });
                } else {
                    alert("Gagal memuat source video.");
                }
            } catch (err) {
                alert("Terjadi kesalahan sistem saat memuat stream.");
            }
        }

        function closeModal() {
            document.getElementById('detailModal').style.display = 'none';
            document.getElementById('videoPlayer').pause();
        }

        function showLoader(state) {
            document.getElementById('loader').style.display = state ? 'block' : 'none';
        }

        // Init jalankan load trending saat pertama kali dibuka
        window.onload = loadTrending;
    </script>
</body>
</html>
`;

// 7. Render Frontend langsung dari Express
app.get('/', (req, res) => {
    res.send(HTML_CONTENT);
});

// Jalankan Server
app.listen(PORT, () => {
    console.log(`[NeoStream] Backend dan Frontend berjalan stabil di http://localhost:${PORT}`);
});
