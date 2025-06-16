const express = require('express');
const puppeteer = require('puppeteer');
const app = express();
const PORT = 3002;

app.use(express.json());

async function scrapeHostData(host) {
    if (!host) {
        console.error('Erro: host não fornecido.');
        return null;
    }

    const airbnbUrl = `https://www.airbnb.com.br/users/show/${host}`;
    console.log(`Raspando URL: ${airbnbUrl}`);

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--disable-gpu', '--enable-logging', '--disable-dev-shm-usage', '--incognito']
        });
        const page = await browser.newPage();

        await page.goto(airbnbUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

        await page.waitForSelector('h1 span', { timeout: 30000 });

        const name = await page.$eval('h1 span', el => el.innerHTML.trim());
        const image = await page.$eval('#site-content picture img', el => el.src);

        let reviews = null;
        try {
            reviews = await page.$eval('div[role="group"] > div > div:nth-child(1) > span', el => el.textContent.trim());
        } catch (e) {
            console.log('Não foi possível encontrar o número de avaliações.');
        }

        let rating = null;
        try {
            const svgElement = await page.$('div[role="group"] > div > div:nth-child(3) svg');

            if (svgElement) {
                const ratingTextSpan = await page.$('div[role="group"] > div > div:nth-child(3) > span');
                if (ratingTextSpan) {
                    rating = await page.evaluate(el => el.textContent.trim(), ratingTextSpan);
                }
            }
        } catch (e) {
            console.log('Não foi possível encontrar a avaliação em estrelas ou o SVG.');
        }

        console.log(`Dados raspados para o anfitrião ${host}:`, { name, image, reviews, rating });

        return { name, image, reviews, rating };
    } catch (error) {
        console.error(`Erro ao raspar dados para o anfitrião ${host}:`, error);
        throw error; // Re-throw the error to be caught by the timeout logic
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

app.post('/scrape', async (req, res) => {
    const { host } = req.body;

    if (!host) {
        return res.status(400).json({ error: 'host é obrigatório no corpo da requisição.' });
    }

    const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout de 5 segundos excedido.')), 5000)
    );

    try {
        const data = await Promise.race([
            scrapeHostData(host),
            timeoutPromise
        ]);
        res.json(data);
    } catch (error) {
        console.error('Erro na rota /scrape:', error);
        if (error.message === 'Timeout de 5 segundos excedido.') {
            res.status(500).json({ error: 'Não foi possível raspar. Erro 500: Timeout de 5 segundos excedido.' });
        } else {
            res.status(500).json({ error: 'Erro interno do servidor ao raspar dados.' });
        }
    }
});

app.listen(PORT, () => {
    console.log(`Servidor de raspagem rodando em http://localhost:${PORT}`);
});