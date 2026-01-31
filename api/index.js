const axios = require('axios');
const cheerio = require('cheerio');

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Referer': 'https://melolo.com/'
};

// --- FUNGSI SCRAPER ---

async function melolohome() {
    try {
        const get = await axios.get('https://melolo.com', { headers });
        const $ = cheerio.load(get.data);
        const data = [];
        const seen = new Set();
        
        const push = v => { if (v.url && !seen.has(v.url)) { seen.add(v.url); data.push(v); } };

        $('div.bg-white.rounded-xl, div.min-w-45').each((_, e) => {
            const t = $(e).find('a.text-Title');
            if (!t.length) return;
            push({
                title: t.text().trim(),
                url: t.attr('href'),
                image: $(e).find('img').attr('src') || $(e).find('img').attr('data-src'),
                episodes: $(e).find('.text-slate-500').first().text().trim() || 'N/A'
            });
        });
        return data;
    } catch (e) {
        return [];
    }
}

async function melolosearch(query) {
    try {
        const get = await axios.get(`https://melolo.com/search?q=${encodeURIComponent(query)}`, { headers });
        const $ = cheerio.load(get.data);
        const data = [];
        $('.grid > div').each((_, e) => {
            const t = $(e).find('a.text-Title');
            if (!t.length) return;
            data.push({
                title: t.text().trim(),
                url: 'https://melolo.com' + t.attr('href'),
                image: $(e).find('img').attr('src') || $(e).find('img').attr('data-src'),
            });
        });
        return data;
    } catch (e) {
        return [];
    }
}

async function melolodl(url) {
    if(!url.includes('melolo.com')) url = 'https://melolo.com' + url;
    
    const get = await axios.get(url, { headers });
    const html = get.data;
    const title = html.match(/<title>(.*?)<\/title>/)?.[1]?.split('|')[0].trim() || 'unknown';
    
    // --- UPDATE LOGIC FULL EPISODE ---
    let rawEpisodes = [];
    
    // Metode 1: Coba ambil dari JSON object
    const m = html.match(/\\"episode_list\\":(\[.*?\])/);
    if (m?.[1]) {
        try { 
            const jsonEps = JSON.parse(m[1].replace(/\\"/g, '"'));
            rawEpisodes.push(...jsonEps);
        } catch {}
    } 

    // Metode 2: Coba ambil via Regex Global (Backup jika JSON tidak lengkap)
    // Regex diubah agar menangkap url apapun di dalam kutip, tidak harus https
    const r = /"episode_id":(\d+),"url":"([^"]+)"/g;
    let x;
    while ((x = r.exec(html)) !== null) {
        rawEpisodes.push({ episode_id: +x[1], url: x[2] });
    }

    // Filter & Merge: Hapus duplikat berdasarkan ID dan urutkan
    const uniqueEpisodes = new Map();
    rawEpisodes.forEach(ep => {
        // Fix URL jika relatif
        let cleanUrl = ep.url.replace(/\\/g, '');
        if (!cleanUrl.startsWith('http')) cleanUrl = 'https:' + cleanUrl; // kadang url: "//domain.com.."
        
        uniqueEpisodes.set(ep.episode_id, {
            episode_id: ep.episode_id,
            url: cleanUrl
        });
    });

    // Urutkan dari eps 1 ke terakhir
    const episodes = Array.from(uniqueEpisodes.values()).sort((a, b) => a.episode_id - b.episode_id);

    return { title, episodes };
}

// --- VERCEL HANDLER ---

module.exports = async (req, res) => {
    const { type, query, url } = req.query;

    try {
        if (type === 'home') {
            const data = await melolohome();
            return res.status(200).json(data);
        }

        if (type === 'search') {
            const data = await melolosearch(query);
            return res.status(200).json(data);
        }

        if (type === 'detail') {
            const data = await melolodl(url);
            return res.status(200).json(data);
        }

        if (type === 'stream') {
            if (!url) return res.status(400).send("No URL");
            const videoUrl = decodeURIComponent(url);
            
            // Proxy logic tetap sama agar video jalan
            const videoResponse = await axios({
                method: 'get',
                url: videoUrl,
                responseType: 'stream',
                headers: { ...headers, 'Referer': 'https://melolo.com/' }
            });

            res.setHeader('Content-Type', 'video/mp4');
            res.setHeader('Content-Length', videoResponse.headers['content-length']);
            videoResponse.data.pipe(res);
            return;
        }

        res.status(400).json({ error: 'Invalid params' });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
