const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
const PORT = 3002;

app.use(express.json());

async function scrapeHostData(hostId) {
    if (!hostId) {
        console.error('Erro: hostId não fornecido.');
        return null;
    }

    const airbnbUrl = `https://www.airbnb.com.br/users/show/${hostId}`;
    console.log(`Raspando URL: ${airbnbUrl}`);

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--disable-gpu',
                '--enable-logging',
                '--disable-dev-shm-usage',
                '--incognito'
            ]
        });
        const page = await browser.newPage();

        await page.goto(airbnbUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

        await page.waitForSelector('h1 span', { timeout: 30000 });

        const name = await page.$eval('h1 span', el => el.innerHTML.trim());
        const profileImageUrl = await page.$eval('#site-content picture img', el => el.src);

        let reviews = null;
        try {
            reviews = await page.$eval('div[role="group"] > div > div:nth-child(1) > span', el => el.textContent.trim());
        } catch (e) {
            console.log('Não foi possível encontrar o número de avaliações.');
        }

        let rating = null;
        try {
            // Verifica a existência do SVG diretamente na estrutura da avaliação.
            const svgElement = await page.$('div[role="group"] > div > div:nth-child(3) svg');

            if (svgElement) {
                // Se o SVG existir, significa que a avaliação está presente.
                // Agora, obtemos o texto do span que contém o valor da avaliação.
                const ratingTextSpan = await page.$('div[role="group"] > div > div:nth-child(3) > span');
                if (ratingTextSpan) {
                    rating = await page.evaluate(el => el.textContent.trim(), ratingTextSpan);
                }
            }
        } catch (e) {
            console.log('Não foi possível encontrar a avaliação em estrelas ou o SVG.');
        }

        console.log(`Dados raspados para o anfitrião ${hostId}:`, { name, profileImageUrl, reviews, rating });

        return { name, profileImageUrl, reviews, rating };
    } catch (error) {
        console.error(`Erro ao raspar dados para o anfitrião ${hostId}:`, error);
        return null;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

app.post('/scrape', async (req, res) => {
    const { hostId } = req.body;

    if (!hostId) {
        return res.status(400).json({ error: 'hostId é obrigatório no corpo da requisição.' });
    }

    try {
        const data = await scrapeHostData(hostId);
        if (data) {
            res.json(data);
        } else {
            res.status(500).json({ error: 'Falha ao raspar dados do anfitrião.' });
        }
    } catch (error) {
        console.error('Erro na rota /scrape:', error);
        res.status(500).json({ error: 'Erro interno do servidor ao raspar dados.' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor de raspagem rodando em http://localhost:${PORT}`);
});
