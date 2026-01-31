const API_BASE = '/api/index';

// State Management
const state = {
    currentData: null,
    currentEpisodes: [],
    lastQuery: ''
};

// Elements
const dom = {
    views: {
        home: document.getElementById('home-view'),
        detail: document.getElementById('detail-view'),
        player: document.getElementById('player-view')
    },
    homeList: document.getElementById('drama-list'),
    loading: document.getElementById('loading'),
    searchOverlay: document.getElementById('search-overlay'),
    searchInput: document.getElementById('search-input'),
    
    // Detail Elements
    dBackdrop: document.getElementById('d-backdrop'),
    dPoster: document.getElementById('d-poster'),
    dTitle: document.getElementById('d-title'),
    dRating: document.getElementById('d-rating'),
    dEpsCount: document.getElementById('d-eps-count'),
    dGenres: document.getElementById('d-genres'),
    dDesc: document.getElementById('d-desc'),
    dEpGrid: document.getElementById('d-ep-grid'),
    playBtn: document.getElementById('play-now-btn'),

    // Player Elements
    video: document.getElementById('main-video'),
    pTitle: document.getElementById('p-title-sm'),
    epDrawer: document.getElementById('ep-drawer'),
    pEpGrid: document.getElementById('p-ep-grid')
};

// Init
window.addEventListener('DOMContentLoaded', loadHome);

// --- NAVIGATION ---
function switchView(viewName) {
    Object.values(dom.views).forEach(el => el.classList.remove('active'));
    dom.views[viewName].classList.add('active');
    window.scrollTo(0,0);
}

function goBackToHome() {
    switchView('home');
    dom.video.pause();
    dom.video.src = '';
}

// --- HOME & SEARCH ---
function toggleSearch() {
    dom.searchOverlay.style.display = dom.searchOverlay.style.display === 'flex' ? 'none' : 'flex';
    if(dom.searchOverlay.style.display === 'flex') dom.searchInput.focus();
}

async function loadHome() {
    dom.loading.style.display = 'block';
    dom.homeList.innerHTML = '';
    try {
        const res = await fetch(`${API_BASE}?type=home`);
        const data = await res.json();
        renderGrid(data);
    } catch (e) { console.error(e); }
    dom.loading.style.display = 'none';
}

async function doSearch() {
    const query = dom.searchInput.value.trim();
    if(!query) return;
    toggleSearch();
    dom.loading.style.display = 'block';
    dom.homeList.innerHTML = '';
    
    try {
        const res = await fetch(`${API_BASE}?type=search&query=${encodeURIComponent(query)}`);
        const data = await res.json();
        if(data.length) renderGrid(data);
        else dom.homeList.innerHTML = '<p style="text-align:center;width:100%;margin-top:20px;">No results found.</p>';
    } catch(e) { console.error(e); }
    dom.loading.style.display = 'none';
}

function renderGrid(data) {
    dom.homeList.innerHTML = '';
    data.forEach(item => {
        const card = document.createElement('div');
        card.className = 'drama-card';
        card.innerHTML = `
            <img src="${item.image}" alt="${item.title}" loading="lazy">
            <div class="info"><h3>${item.title}</h3></div>
        `;
        card.onclick = () => loadDetail(item.url);
        dom.homeList.appendChild(card);
    });
}

// --- DETAIL PAGE ---
async function loadDetail(url) {
    switchView('detail');
    // Reset UI
    dom.dTitle.innerText = 'Loading...';
    dom.dPoster.src = '';
    dom.dEpGrid.innerHTML = '<div class="loader"></div>';
    dom.playBtn.onclick = null;

    try {
        const res = await fetch(`${API_BASE}?type=detail&url=${encodeURIComponent(url)}`);
        const data = await res.json();
        state.currentData = data;
        state.currentEpisodes = data.episodes;

        // Bind Data
        dom.dTitle.innerText = data.title;
        dom.dPoster.src = data.cover_image;
        dom.dBackdrop.style.backgroundImage = `url(${data.cover_image})`;
        dom.dRating.innerText = data.rating || 'N/A';
        dom.dEpsCount.innerText = data.total_episodes;
        dom.dDesc.innerText = data.description;
        
        dom.dGenres.innerHTML = '';
        data.genres.forEach(g => {
            const s = document.createElement('span'); s.innerText = g; dom.dGenres.appendChild(s);
        });

        // Render Episodes
        renderEpList(data.episodes, dom.dEpGrid);

        // Play Button Action (Play Ep 1)
        if(data.episodes.length > 0) {
            dom.playBtn.onclick = () => openPlayer(data.episodes[0]);
        }

    } catch(e) {
        alert('Failed to load details');
        goBackToHome();
    }
}

function renderEpList(episodes, container) {
    container.innerHTML = '';
    if(episodes.length === 0) {
        container.innerHTML = '<p style="grid-column:1/-1;text-align:center;">No episodes found.</p>';
        return;
    }
    episodes.forEach(ep => {
        const btn = document.createElement('div');
        btn.className = 'ep-box';
        btn.innerText = ep.episode_id;
        btn.onclick = () => openPlayer(ep);
        container.appendChild(btn);
    });
}

// --- PLAYER ---
function openPlayer(episode) {
    switchView('player');
    dom.pTitle.innerText = `${state.currentData.title} - Ep ${episode.episode_id}`;
    
    // Render Drawer List
    renderEpList(state.currentEpisodes, dom.pEpGrid);
    
    // Highlight Current
    const boxes = dom.pEpGrid.getElementsByClassName('ep-box');
    Array.from(boxes).forEach(b => {
        if(parseInt(b.innerText) === episode.episode_id) b.classList.add('active');
        else b.classList.remove('active');
    });

    // Play Stream
    const proxyUrl = `${API_BASE}?type=stream&url=${encodeURIComponent(episode.url)}`;
    dom.video.src = proxyUrl;
    dom.video.play().catch(e => console.log("Auto-play blocked"));
}

function closePlayer() {
    dom.video.pause();
    dom.video.src = '';
    switchView('detail'); // Kembali ke detail, bukan home
}

function toggleDrawer() {
    dom.epDrawer.classList.toggle('show');
}
