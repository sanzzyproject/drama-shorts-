const API_BASE = '/api/index'; // Arahkan ke Vercel function

// Elements
const dom = {
    homeView: document.getElementById('home-view'),
    playerView: document.getElementById('player-view'),
    dramaList: document.getElementById('drama-list'),
    loading: document.getElementById('loading'),
    video: document.getElementById('main-video'),
    epGrid: document.getElementById('ep-grid'),
    epDrawer: document.getElementById('ep-drawer'),
    currentTitle: document.getElementById('current-title')
};

let currentEpisodes = [];

// Init
window.addEventListener('DOMContentLoaded', loadHome);

async function loadHome() {
    try {
        const res = await fetch(`${API_BASE}?type=home`);
        const data = await res.json();
        dom.loading.style.display = 'none';
        renderList(data);
    } catch (e) {
        alert('Gagal memuat data');
    }
}

function renderList(data) {
    dom.dramaList.innerHTML = '';
    data.forEach(item => {
        const card = document.createElement('div');
        card.className = 'drama-card';
        card.innerHTML = `
            <img src="${item.image}" loading="lazy" alt="${item.title}">
            <div class="drama-info">
                <div class="drama-title">${item.title}</div>
            </div>
        `;
        card.onclick = () => openPlayer(item.url);
        dom.dramaList.appendChild(card);
    });
}

async function openPlayer(url) {
    // Show Player UI
    dom.playerView.classList.add('active');
    dom.video.src = '';
    dom.epGrid.innerHTML = '<div class="loader"></div>';
    dom.currentTitle.innerText = 'Fetching episodes...';

    try {
        // Fetch Details
        const res = await fetch(`${API_BASE}?type=detail&url=${encodeURIComponent(url)}`);
        const data = await res.json();
        
        dom.currentTitle.innerText = data.title;
        currentEpisodes = data.episodes;
        
        renderEpisodes(data.episodes);
        
        // Auto play episode 1
        if (data.episodes.length > 0) {
            playEpisode(data.episodes[0].url, 1);
        }

    } catch (e) {
        console.error(e);
        dom.currentTitle.innerText = 'Error loading drama';
    }
}

function renderEpisodes(episodes) {
    dom.epGrid.innerHTML = '';
    episodes.forEach(ep => {
        const btn = document.createElement('button');
        btn.className = 'ep-btn';
        btn.innerText = ep.episode_id;
        btn.onclick = () => playEpisode(ep.url, ep.episode_id);
        dom.epGrid.appendChild(btn);
    });
}

function playEpisode(videoUrl, epNum) {
    // Highlight active button
    document.querySelectorAll('.ep-btn').forEach(b => {
        b.classList.toggle('active', b.innerText == epNum);
    });

    // PENTING: Gunakan Proxy API untuk bypass 403 Forbidden
    const proxyUrl = `${API_BASE}?type=stream&url=${encodeURIComponent(videoUrl)}`;
    
    dom.video.src = proxyUrl;
    dom.video.play().catch(e => console.log("Autoplay blocked, user interaction needed"));
}

function closePlayer() {
    dom.playerView.classList.remove('active');
    dom.video.pause();
    dom.video.src = '';
}

function toggleDrawer() {
    dom.epDrawer.classList.toggle('show');
}
