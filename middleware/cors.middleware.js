const cors = require("cors");

module.exports = cors({

    origin: [
    'http://localhost:4200',
    'http://10.1.116.222:4200',
    'http://127.0.0.1:5500',
    'http://localhost:5500',
    'https://mmc-cdhncsgudefcf0hr.eastasia-01.azurewebsites.net'
  ],
    credentials: true

});