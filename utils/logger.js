const fs = require("fs");
const path = require("path");

const logDir = path.join(
    process.cwd(),
    "logs"
);

if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

class Logger {

    log(level, message, meta = {}) {

        const entry = {
            timestamp:
                new Date().toISOString(),
            level,
            message,
            ...meta
        };

        console.log(
            JSON.stringify(entry)
        );

        fs.appendFileSync(
            path.join(logDir, "app.log"),
            JSON.stringify(entry) + "\n"
        );
    }

    info(message, meta = {}) {

        this.log(
            "INFO",
            message,
            meta
        );
    }

    warn(message, meta = {}) {

        this.log(
            "WARN",
            message,
            meta
        );
    }

    error(message, meta = {}) {

        this.log(
            "ERROR",
            message,
            meta
        );
    }

    security(message, meta = {}) {

        this.log(
            "SECURITY",
            message,
            meta
        );
    }
}

module.exports =
    new Logger();