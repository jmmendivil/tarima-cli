fs = require('fs')
path = require('path')

exists = (file) ->
  try
    fs.statSync(file).isFile()
  catch e
    false

module.exports = (file) ->
  file = path.join(__dirname, '../fixtures', file)
  fs.readFileSync(file).toString() if exists(file)
