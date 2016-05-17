describe 'CLI', ->
  describe 'asking for --help', ->
    beforeEach (done) ->
      cmd '--help', done

    it 'should display usage info', ->
      expect(cmd.stdout).toContain 'tarima [...] [OPTIONS]'

  describe 'asking for --version', ->
    beforeEach (done) ->
      cmd '--version', done

    it 'should display the package version', ->
      expect(cmd.stdout).toContain require('../package.json').version

  describe 'using custom [SRC]', ->
    beforeEach (done) ->
      cmd 'example', done

    it 'should copy unsupported sources', ->
      expect(read('build/dist/example/other/blank.txt')).toEqual "TEXT\n"
