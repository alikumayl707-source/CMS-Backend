const helmet = require("helmet");
const compression = require("compression");

module.exports = [

    helmet(),

    compression()

];