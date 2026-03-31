# ============================================================
# FILE: Dockerfile
# ============================================================

FROM node:20-alpine

WORKDIR /app

COPY Srcs/package.json ./
RUN npm install

COPY Srcs/ ./Srcs/
RUN rm -f ./Srcs/package.json
COPY Srcs/server/ ./server/
COPY Srcs/public/ ./public/
COPY test/ ./test/
COPY Srcs/indexer.js ./
COPY Srcs/cards.json ./cards.json

EXPOSE 80

CMD ["node", "server/server.js"]
