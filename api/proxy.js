export default async function handler(req, res) {
    // Ambil parameter URL target asal (?url=xxx)
    const { url } = req.query;
    
    if (!url) {
        return res.status(400).send("Error: Parameter URL tidak ditemukan!");
    }

    try {
        let targetUrl = url.trim();
        
        // Validasi protokol URL
        if (!/^https?:\/\//i.test(targetUrl)) {
            targetUrl = 'https://' + targetUrl;
        }

        // Lakukan pembacaan/scraping data dari web tujuan eksternal
        const response = await fetch(targetUrl, {
            method: 'GET',
            headers: {
                // Manipulasi user agent agar web tujuan mengira diakses dari Google Chrome Mobile asli
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        });

        // Ambil jenis file dokumen asal (HTML, CSS, JS, atau Gambar)
        const contentType = response.headers.get('content-type') || '';
        
        // HANCURKAN PROTEKSI KEAMANAN IFRAME (Bypass Cors & Frame Restrictions)
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', '*');
        
        // Teruskan header tipe konten asli agar browser tidak salah baca format
        res.setHeader('Content-Type', contentType);

        // Jika konten berupa halaman website (HTML)
        if (contentType.includes('text/html')) {
            let htmlContent = await response.text();
            
            // Dapatkan alamat domain utama asal (Misal: https://docs.google.com atau https://youtube.com)
            const parsedUrl = new URL(targetUrl);
            const domainOrigin = parsedUrl.origin;

            /* SUNTIKKAN TAG <base> UTAMA
               Ini adalah kunci vital agar gambar, stylesheet, dan script bawaan dari web target 
               tidak rusak/hancur berantakan saat dibuka lewat server proxy kita.
            */
            const injectedBase = `<head><base href="${domainOrigin}/">`;
            
            if (htmlContent.includes('<head>')) {
                htmlContent = htmlContent.replace('<head>', injectedBase);
            } else if (htmlContent.includes('<HEAD>')) {
                htmlContent = htmlContent.replace('<HEAD>', injectedBase);
            } else {
                // Jika tag head tidak sengaja tidak ada, paksa suntik di awal html
                htmlContent = injectedBase + htmlContent;
            }

            // Kirim balik data HTML yang sudah berhasil dijebol ke sisi siswa
            return res.status(200).send(htmlContent);

        } else {
            // Jika isi web berupa file gambar/media/css/js murni, teruskan datanya berupa binary buffer
            const bufferData = await response.arrayBuffer();
            return res.status(200).send(Buffer.from(bufferData));
        }

    } catch (error) {
        // Tampilkan pesan jika link server target mati atau menolak koneksi proxy
        return res.status(500).send(`<h3>Gagal Membuka Halaman via Server Proxy</h3><p>Detail Error: ${error.message}</p>`);
    }
}
