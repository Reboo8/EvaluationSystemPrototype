# Cuba prototype — static Vite build served by nginx on Cloud Run (asia-southeast1).
# Build:  docker build --build-arg VITE_GROQ_API_KEY=... -t cuba-prototype .
# The Groq key is baked into the client bundle at build time (the app calls Groq from the browser).

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG VITE_GROQ_API_KEY=
ENV VITE_GROQ_API_KEY=$VITE_GROQ_API_KEY
RUN npm run build

# stable-alpine floats with nginx's supported stable line, so each Cloud Build picks up security patches.
FROM nginx:stable-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
