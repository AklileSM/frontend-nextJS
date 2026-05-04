FROM node:20-alpine

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN rm -rf .next && npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]