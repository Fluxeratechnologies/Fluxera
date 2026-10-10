const { workflow } = require('./workflow')

function agent(client, name, fn, opts = {}) {
  return workflow(client, name, fn, { ...opts, actor: 'agent' })
}

module.exports = { agent }
