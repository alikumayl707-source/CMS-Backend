class AppError extends Error {

    constructor(message, status = 400, meta = {}) {

        super(message);

        this.status = status;
        this.meta = meta;
    }

}

module.exports = AppError;
