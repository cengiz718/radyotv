# Cloud Run için sunucu imajı (server.ts: Express API + üretim arayüzü)
FROM node:22-slim

WORKDIR /app

# Bağımlılıkları kur (build ve tsx için devDependencies dahil)
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . .
RUN npm run build

ENV NODE_ENV=production
# Cloud Run PORT'u kendisi verir (varsayılan 8080); server.ts bu değeri kullanır
EXPOSE 8080

CMD ["npx", "tsx", "server.ts"]
