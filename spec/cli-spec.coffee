cmd = require('./helpers/cmd')

describe 'CLI', ->
  describe 'running without arguments', ->
    beforeEach cmd

    it 'should exit with 1', ->
      expect(cmd.exitStatus).toEqual 1

    it 'should not print to the stdout', ->
      expect(cmd.stdout).toEqual ''

    it 'should report the missing directory', ->
      expect(cmd.stderr).toMatch /Missing.*directory/

  describe 'asking for --help', ->
    beforeEach (done) ->
      cmd '--help', done

    it 'should display usage info', ->
      expect(cmd.stdout).toContain 'tarima [SRC] [DEST] [OPTIONS]'

  describe 'asking for --version', ->
    beforeEach (done) ->
      cmd '--version', done

    it 'should display the package version', ->
      expect(cmd.stdout).toContain require('../package.json').version
