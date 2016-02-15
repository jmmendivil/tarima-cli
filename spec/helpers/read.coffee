fs = require('fs')
path = require('path')

module.exports = (file) ->
  file = path.join(__dirname, '../fixtures', file)
  fs.readFileSync(file).toString() if fs.existsSync(file)
