describe 'CLI', ->
  # describe 'running without arguments', ->
  #   beforeEach cmd

  #   it 'should exit with 1', ->
  #     expect(cmd.exitStatus).toEqual 1

  #   it 'should not print to the stdout', ->
  #     expect(cmd.stdout).toContain 'Processing files from'
  #     expect(cmd.stdout).toContain 'Compiling to'

  #   it 'should report the missing directory', ->
  #     expect(cmd.stderr).toMatch /Missing.*directory/

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

  describe 'using custom [SRC]', ->
    beforeEach (done) ->
      cmd 'example', done

    it 'should copy unsupported sources', ->
      expect(read('build/dist/other/blank.txt')).toEqual "TEXT\n"
