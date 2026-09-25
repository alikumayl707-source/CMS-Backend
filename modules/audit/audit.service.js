const repository = require("./audit.repository");

async function getAuditLogs(page, pageSize, search, filters) {
  return repository.getAuditLogs(page, pageSize, search, filters);
}

async function getAuditById(id) {
  return repository.getAuditById(id);
}

module.exports = {
  getAuditLogs,
  getAuditById
};