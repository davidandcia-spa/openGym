FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force
COPY server.js coach.js entry.js ./
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "entry.js"]
