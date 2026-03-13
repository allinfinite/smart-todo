FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --global serve && npm install

COPY . .

ENV PORT=5000
EXPOSE 5000

CMD ["sh", "-lc", "node ./scripts/render-config.mjs && exec serve -s . -l tcp://0.0.0.0:${PORT:-5000}"]
