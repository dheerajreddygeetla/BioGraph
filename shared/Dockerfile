# Not intended to be built standalone — included for reference.
# Shared library is COPYed into each service's build.
FROM node:20-alpine AS base
WORKDIR /shared
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
CMD ["node", "-e", "console.log('shared: no runtime entrypoint')"]