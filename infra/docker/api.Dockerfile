FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
COPY packages/ packages/
COPY apps/api/package.json apps/api/

RUN npm install

COPY apps/api/ apps/api/

WORKDIR /app/apps/api
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
