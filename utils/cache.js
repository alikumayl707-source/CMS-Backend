const redisClient = require("../config/redis");

class Cache {

    async set(key, value, ttlSeconds = 300) {

        await redisClient.set(
            key,
            JSON.stringify(value),
            {
                EX: ttlSeconds
            }
        );
    }

    async get(key) {

        const value = await redisClient.get(key);

        if (!value) {
            return null;
        }

        return JSON.parse(value);
    }

    async delete(key) {

        await redisClient.del(key);
    }

    async clear() {

        await redisClient.flushDb();
    }
}

module.exports = new Cache();