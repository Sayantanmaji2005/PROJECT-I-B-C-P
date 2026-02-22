FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY prisma ./prisma
COPY scripts ./scripts
COPY src ./src

RUN npm run prisma:generate

EXPOSE 4000

CMD ["npm", "run", "start"]
