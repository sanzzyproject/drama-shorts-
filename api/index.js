const axios = require('axios');
const cheerio = require('cheerio');

// Header Global untuk Scraper
const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Referer': 'https://melolo.com/'
};

// --- FUNGSI SCRAPER DARI KODEMU (Disederhanakan untuk API) ---

async function melolohome() {
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
}

async function melolosearch(query) {
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
}

async function melolodl(url) {
    // Pastikan URL valid
    if(!url.includes('melolo.com')) url = 'https://melolo.com' + url;
    
    const get = await axios.get(url, { headers });
    const html = get.data;
    const title = html.match(/<title>(.*?)<\/title>/)?.[1]?.split('|')[0].trim() || 'unknown';
    
    let episodes = [];
    // Logika parsing episode
    const m = html.match(/\\"episode_list\\":(\[.*?\])/);
    if (m?.[1]) {
        try { episodes = JSON.parse(m[1].replace(/\\"/g, '"')); } catch {}
    } else {
        const r = /"episode_id":(\d+),"url":"(https:[^"]+)"/g;
        let x;
        while ((x = r.exec(html)) !== null) episodes.push({ episode_id: +x[1], url: x[2] });
    }

    if (!episodes.length) {
         // Fallback manual scrape jika JSON gagal
        const $ = cheerio.load(html);
        // Implementasi fallback sederhana jika perlu
    }

    return { title, episodes };
}

// --- VERCEL SERVERLESS HANDLER ---

module.exports = async (req, res) => {
    const { type, query, url } = req.query;

    try {
        // Endpoint 1: Home
        if (type === 'home') {
            const data = await melolohome();
            return res.status(200).json(data);
        }

        // Endpoint 2: Search
        if (type === 'search') {
            const data = await melolosearch(query);
            return res.status(200).json(data);
        }

        // Endpoint 3: Detail/Episodes
        if (type === 'detail') {
            const data = await melolodl(url);
            return res.status(200).json(data);
        }

        // Endpoint 4: Video Proxy (PENTING AGAR TIDAK ERROR 403)
        // Melolo memblokir request video jika referer salah. Kita proxy stream-nya.
        if (type === 'stream') {
            if (!url) return res.status(400).send("No URL");
            
            const videoUrl = decodeURIComponent(url);
            const videoResponse = await axios({
                method: 'get',
                url: videoUrl,
                responseType: 'stream',
                headers: {
                    ...headers,
                    'Referer': 'https://melolo.com/' // Menipu server asal
                }
            });

            // Set headers video
            res.setHeader('Content-Type', 'video/mp4');
            res.setHeader('Content-Length', videoResponse.headers['content-length']);
            
            // Pipe video stream ke frontend
            videoResponse.data.pipe(res);
            return;
        }

        res.status(400).json({ error: 'Invalid type parameter' });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Internal Server Error', message: e.message });
    }
};
