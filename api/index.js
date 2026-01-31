const axios = require('axios');
const cheerio = require('cheerio');

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Referer': 'https://melolo.com/'
};

// --- HELPER: Scrape Global Regex ---
// Fungsi ini memaksa mencari pola episode di seluruh raw HTML tanpa bergantung pada format JSON yang sering berubah
function extractAllEpisodes(html) {
    const episodes = new Map();
    
    // Pola 1: Mencari format JSON standar di dalam script
    // "episode_id":1,"url":"https://..."
    const regexStandard = /"episode_id":\s*(\d+),\s*"url":\s*"([^"]+)"/g;
    
    // Pola 2: Mencari format yang mungkin ter-escape
    // \"episode_id\":1,\"url\":\"https://...\"
    const regexEscaped = /\\"episode_id\\":\s*(\d+),\s*\\"url\\":\s*\\"([^"]+)\\"/g;

    let match;
    
    // Jalankan Pola 1
    while ((match = regexStandard.exec(html)) !== null) {
        const id = parseInt(match[1]);
        let url = match[2].replace(/\\/g, ''); // Bersihkan backslashes
        if (!url.startsWith('http')) url = 'https:' + url;
        episodes.set(id, { episode_id: id, url: url });
    }

    // Jalankan Pola 2 (Backup)
    while ((match = regexEscaped.exec(html)) !== null) {
        const id = parseInt(match[1]);
        let url = match[2].replace(/\\/g, ''); 
        if (!url.startsWith('http')) url = 'https:' + url;
        // Hanya simpan jika belum ada (prioritaskan pola 1)
        if (!episodes.has(id)) {
            episodes.set(id, { episode_id: id, url: url });
        }
    }

    // Mengubah Map ke Array dan Sortir 1 - End
    return Array.from(episodes.values()).sort((a, b) => a.episode_id - b.episode_id);
}

async function melolohome() {
    try {
        const get = await axios.get('https://melolo.com', { headers });
        const $ = cheerio.load(get.data);
        const data = [];
        const seen = new Set();
        
        $('div.bg-white.rounded-xl, div.min-w-45').each((_, e) => {
            const t = $(e).find('a.text-Title');
            if (!t.length) return;
            const url = t.attr('href');
            if (url && !seen.has(url)) {
                seen.add(url);
                data.push({
                    title: t.text().trim(),
                    url: url,
                    image: $(e).find('img').attr('src') || $(e).find('img').attr('data-src'),
                    // Ambil rating jika ada
                    rating: $(e).find('.text-orange-500').text().trim() || 'N/A'
                });
            }
        });
        return data;
    } catch (e) { return []; }
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
                rating: $(e).find('.bg-yellow-bg').text().trim() || null
            });
        });
        return data;
    } catch (e) { return []; }
}

async function melolodl(url) {
    if(!url.includes('melolo.com')) url = 'https://melolo.com' + url;
    
    const get = await axios.get(url, { headers });
    const html = get.data;
    const $ = cheerio.load(html);

    // --- DATA DETAIL LENGKAP ---
    const title = $('h1').text().trim() || html.match(/<title>(.*?)<\/title>/)?.[1]?.split('|')[0].trim();
    const description = $('div.text-slate-500.leading-relaxed').text().trim() || "No description available.";
    const genres = [];
    $('a[href^="/category/"]').each((_, e) => genres.push($(e).text().trim()));
    const rating = $('span.text-2xl.font-bold').text().trim() || "N/A";
    const cover_image = $('img.rounded-xl').attr('src') || $('meta[property="og:image"]').attr('content');

    // --- FULL EPISODE EXTRACTION ---
    const episodes = extractAllEpisodes(html);

    return { 
        title, 
        description, 
        cover_image, 
        genres, 
        rating, 
        total_episodes: episodes.length,
        episodes 
    };
}

module.exports = async (req, res) => {
    const { type, query, url } = req.query;

    try {
        res.setHeader('Access-Control-Allow-Origin', '*'); // Opsional: Untuk debug local

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
