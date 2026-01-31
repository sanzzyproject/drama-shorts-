const API_BASE = '/api/index';

const dom = {
    homeView: document.getElementById('home-view'),
    playerView: document.getElementById('player-view'),
    dramaList: document.getElementById('drama-list'),
    loading: document.getElementById('loading'),
    video: document.getElementById('main-video'),
    epGrid: document.getElementById('ep-grid'),
    epDrawer: document.getElementById('ep-drawer'),
    currentTitle: document.getElementById('current-title'),
    searchInput: document.getElementById('search-input'),
    searchBtn: document.getElementById('search-btn'),
    pageTitle: document.getElementById('page-title')
};

window.addEventListener('DOMContentLoaded', loadHome);

// --- SEARCH LOGIC ---
dom.searchBtn.onclick = () => {
    if (dom.searchInput.style.display === 'none') {
        dom.searchInput.style.display = 'block';
        dom.searchInput.focus();
    } else {
        const query = dom.searchInput.value.trim();
        if (query) doSearch(query);
    }
};

dom.searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') doSearch(dom.searchInput.value.trim());
});

async function doSearch(query) {
    if(!query) return;
    dom.loading.style.display = 'block';
    dom.dramaList.innerHTML = '';
    dom.pageTitle.style.display = 'block';
    dom.pageTitle.innerText = `Search: "${query}"`;
    
    try {
        const res = await fetch(`${API_BASE}?type=search&query=${encodeURIComponent(query)}`);
        const data = await res.json();
        dom.loading.style.display = 'none';
        
        if(data.length === 0) {
            dom.dramaList.innerHTML = '<p style="text-align:center; width:100%; color:#666;">No results found.</p>';
        } else {
            renderList(data);
        }
    } catch (e) {
        alert('Search failed');
        loadHome();
    }
}
// --------------------

async function loadHome() {
    dom.searchInput.style.display = 'none';
    dom.searchInput.value = '';
    dom.pageTitle.style.display = 'block';
    dom.pageTitle.innerText = 'Recommended For You';
    dom.loading.style.display = 'block';
    dom.dramaList.innerHTML = '';

    try {
        const res = await fetch(`${API_BASE}?type=home`);
        const data = await res.json();
        dom.loading.style.display = 'none';
        renderList(data);
    } catch (e) {
        console.error(e);
        dom.dramaList.innerHTML = '<p style="text-align:center;">Failed to load.</p>';
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
    dom.playerView.classList.add('active');
    dom.video.src = '';
    dom.epGrid.innerHTML = '<div class="loader"></div>';
    dom.currentTitle.innerText = 'Fetching episodes...';
    dom.epDrawer.classList.remove('show'); // Reset drawer state

    try {
        const res = await fetch(`${API_BASE}?type=detail&url=${encodeURIComponent(url)}`);
        const data = await res.json();
        
        dom.currentTitle.innerText = data.title;
        renderEpisodes(data.episodes);
        
        if (data.episodes.length > 0) {
            playEpisode(data.episodes[0].url, data.episodes[0].episode_id);
        } else {
            dom.epGrid.innerHTML = '<p>No episodes found.</p>';
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
        btn.onclick = () => {
            playEpisode(ep.url, ep.episode_id);
            // Optional: Close drawer after clicking
            // toggleDrawer(); 
        };
        dom.epGrid.appendChild(btn);
    });
}

function playEpisode(videoUrl, epNum) {
    document.querySelectorAll('.ep-btn').forEach(b => {
        b.classList.toggle('active', parseInt(b.innerText) === parseInt(epNum));
    });

    const proxyUrl = `${API_BASE}?type=stream&url=${encodeURIComponent(videoUrl)}`;
    dom.video.src = proxyUrl;
    dom.video.play().catch(e => console.log("Autoplay blocked"));
}

function closePlayer() {
    dom.playerView.classList.remove('active');
    dom.video.pause();
    dom.video.src = '';
}

function toggleDrawer() {
    dom.epDrawer.classList.toggle('show');
}
