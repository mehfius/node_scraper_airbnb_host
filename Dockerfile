FROM mehfius/node-puppeteer-ngrok

WORKDIR /app

COPY . .
RUN npm install
RUN npx puppeteer browsers install chrome --skip-chrome-check
COPY entrypoint.sh ./entrypoint.sh

RUN chmod +x ./entrypoint.sh

ENTRYPOINT ["./entrypoint.sh"]
CMD []
