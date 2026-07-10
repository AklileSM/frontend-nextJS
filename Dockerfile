FROM node:20-alpine

WORKDIR /app

ARG BACKEND_URL=http://localhost:3002
ENV BACKEND_URL=${BACKEND_URL}

# Explicitly clear NEXT_PUBLIC_API_URL so the browser bundle always uses the
# same-origin /api rewrite proxy, never a Docker-internal hostname.
ARG NEXT_PUBLIC_API_URL=""
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

COPY package*.json ./
RUN npm ci

COPY . .

ARG NEXT_PUBLIC_ROBOT_TELEMETRY_WS_URL=""
ENV NEXT_PUBLIC_ROBOT_TELEMETRY_WS_URL=${NEXT_PUBLIC_ROBOT_TELEMETRY_WS_URL}

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]