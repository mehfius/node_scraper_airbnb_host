const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');
const puppeteer = require('puppeteer');

dotenv.config();

async function saveHostHtml() {
    const totalStartTime = performance.now();

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
        console.error("Variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE são obrigatórias.");
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const outputFolderPath = path.join(__dirname, 'html', 'original');

    try {
        await fs.rm(outputFolderPath, { recursive: true, force: true });
        console.log(`Pasta existente "${outputFolderPath}" removida.`);
    } catch (err) {
        console.error(`Erro ao remover pasta existente "${outputFolderPath}":`, err.message);
    }

    try {
        await fs.mkdir(outputFolderPath, { recursive: true });
    } catch (err) {
        console.error(`Erro ao criar pasta "${outputFolderPath}":`, err.message);
        return;
    }

    const { data: hosts, error } = await supabase
        .from('view_except_hosts')
        .select('host'); // Selecionando o campo 'host'

    if (error) {
        console.error('Erro ao buscar os Hosts:', error.message);
        return;
    }

    if (!hosts || hosts.length === 0) {
        console.log(`Nenhum host encontrado.`);
        const totalEndTime = performance.now();
        const totalDurationInSeconds = ((totalEndTime - totalStartTime) / 1000).toFixed(2);
        console.log(`\nTempo total gasto: ${totalDurationInSeconds} segundos.`);
        return;
    }

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--disable-gpu',
                '--disable-dev-shm-usage'
            ]
        });
        console.log(`Navegador Puppeteer iniciado.`);

        for (const hostRecord of hosts) {
            const host = hostRecord.host; // Acessando o valor do campo 'host'
            const airbnbUrl = `https://www.airbnb.com.br/users/show/${host}`;
            const fileName = `${host}.html`;
            const filePath = path.join(outputFolderPath, fileName);

            let page;
            try {
                console.log(`\n    \x1b[33mProcessando Host\x1b[0m: \x1b]8;;${airbnbUrl}\x1b\\${host}\x1b]8;;\x1b\\`);
                const startTime = performance.now();

                page = await browser.newPage();
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                await page.setViewport({ width: 1440, height: 900 });

                // Navega para a URL e espera até que a rede esteja ociosa
                await page.goto(airbnbUrl, { waitUntil: 'networkidle2', timeout: 90000 });

                // Espera pela tag <main> antes de obter o conteúdo HTML
                await page.waitForSelector('main', { timeout: 30000 }); // Ajuste o timeout se necessário

                const content = await page.content();
                await fs.writeFile(filePath, content);

                const endTime = performance.now();
                const durationInSeconds = ((endTime - startTime) / 1000).toFixed(2);
                console.log(`    \x1b[32mHTML do Host ${host} salvo em ${durationInSeconds} segundos.\x1b[0m`);
            } catch (error) {
                console.error(`    Erro ao processar o Host ${host}:`, error.message);
            } finally {
                if (page) {
                    await page.close();
                }
            }
        }

    } catch (browserError) {
        console.error(`Erro ao iniciar ou usar o navegador Puppeteer:`, browserError.message);
    } finally {
        if (browser) {
            await browser.close();
            console.log(`Navegador Puppeteer fechado.`);
        }
    }

    const totalEndTime = performance.now();
    const totalDurationInSeconds = ((totalEndTime - totalStartTime) / 1000).toFixed(2);
    console.log(`\nTempo total gasto: ${totalDurationInSeconds} segundos.`);
}

saveHostHtml();