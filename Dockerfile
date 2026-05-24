# 1. Use an official, lightweight Node.js runtime as the base
FROM node:20-alpine

# 2. Install native compilation tools needed by better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# 3. Create and set the working directory inside the container
WORKDIR /usr/src/app

# 4. Copy package files first to leverage Docker's caching system
COPY package*.json ./

# 5. Install production dependencies cleanly
RUN npm ci --only=production

# 6. Copy the rest of your application files (server.js, database.js, public/)
COPY . .

# 7. Open the port your Express server listens on
EXPOSE 3000

# 8. Start the logistics engine
CMD ["node", "server.js"]