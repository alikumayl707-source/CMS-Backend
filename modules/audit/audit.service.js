const repository = require("./audit.repository"); 
async function getAuditLogs(page, pageSize, search, module) {
  return repository.getAuditLogs(page, pageSize, search, module);
}

async function getAuditById(id) {

  return repository.getAuditById(id);
}

module.exports = {
  getAuditLogs,
  getAuditById
};
