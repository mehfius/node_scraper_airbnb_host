const path = require('path');
const fs = require('fs');
const JSDOM = require('jsdom').JSDOM;
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const green = '\x1b[32m';
const red = '\x1b[31m';
const reset = '\x1b[0m';

// Sintaxe ANSI para hyperlink
const ANSI_HYPERLINK_START = '\x1b]8;;';
const ANSI_HYPERLINK_END = '\x1b]8;;\x07';
const BELL_CHAR = '\x07';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function countElementsInHtmlFiles(startPath) {
    if (!fs.existsSync(startPath)) {
        console.log("Diretório não encontrado:", startPath);
        return;
    }

    const files = fs.readdirSync(startPath);

    for (const file of files) {
        const filename = path.join(startPath, file);
        const stat = fs.lstatSync(filename);

        if (stat.isDirectory()) {
            await countElementsInHtmlFiles(filename);
        } else if (filename.endsWith('.html')) {
            try {
                const htmlContent = fs.readFileSync(filename, 'utf-8');
                const dom = new JSDOM(htmlContent);
                const doc = dom.window.document;

                const data = {};

                const fileBaseName = path.basename(filename, '.html');
                if (!isNaN(fileBaseName)) {
                    data.id = parseInt(fileBaseName, 10);
                } else {
                    console.log(`Nome do arquivo "${fileBaseName}" não é um número válido para o ID. Ignorando este arquivo.`);
                    continue;
                }

                const h2DivSpanElement = doc.querySelector('h2 div span');
                if (h2DivSpanElement) {
                    data.name = h2DivSpanElement.textContent.trim();
                }

                const imageElement = doc.querySelector("#site-content picture img");
                if (imageElement && imageElement.src) {
                    data.image = imageElement.src;
                }

                const reviewsElement = doc.querySelector('div[role="group"] > div > div:nth-child(1) > span');
                if (reviewsElement) {
                    data.reviews = reviewsElement.textContent.trim();
                }

                const ratingElement = doc.querySelector('div[role="group"] > div > div:nth-child(3) > span');
                if (ratingElement) {
                    data.rating = ratingElement.textContent.trim();
                }

                const dataToPrint = Object.keys(data)
                    .map(key => {
                        if (key === 'image' && data[key]) {
                            // Usando a sintaxe de hyperlink ANSI
                            return `${key}: ${ANSI_HYPERLINK_START}${data[key]}${BELL_CHAR}Link da Imagem${ANSI_HYPERLINK_END}`;
                        }
                        return `${key}: ${data[key]}`;
                    })
                    .join(' | ');
                console.log(`Objeto a ser inserido/atualizado: ${dataToPrint}`);


                const { data: insertedData, error } = await supabase
                    .from('hosts')
                    .upsert([data], { onConflict: 'id' });

                if (error) {
                    console.error(`${red}Erro ao fazer upsert no Supabase para o ID ${data.id}:`, error.message, `${reset}`);
                } else {
                    if (insertedData && insertedData.length > 0) {
                        const output = Object.keys(insertedData[0])
                            .map(key => {
                                if (key === 'image' && insertedData[0][key]) {
                                    // Usando a sintaxe de hyperlink ANSI
                                    return `${key}: ${ANSI_HYPERLINK_START}${insertedData[0][key]}${BELL_CHAR}Link da Imagem${ANSI_HYPERLINK_END}`;
                                }
                                return `${key}: ${insertedData[0][key]}`;
                            })
                            .join(' - ');
                        console.log(`${green}Dados do arquivo ${filename} inseridos/atualizados com sucesso no Supabase: ${output}${reset}`);
                    } else {
                        console.log(`${green}Dados do arquivo ${filename} inseridos/atualizados com sucesso no Supabase (ID: ${data.id})${reset}`);
                    }
                }

            } catch (error) {
                console.error(`Erro ao processar o arquivo ${filename}: ${error.message}`);
            }
        }
    }
}

async function runScript() {
    const directoryPath = `./html/optimized`;
    await countElementsInHtmlFiles(directoryPath);
}

runScript();