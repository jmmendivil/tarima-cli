## Tarima CLI

Built on top of [tarima](https://github.com/gextech/tarima) to provide a simple build pipeline with watching support.

1. It can take any amount of files and produce different outputs based on supplied configuration, you can filter out some files, rename different subests, bundle them, etc.

2. Provides a simple hook system to catch-all non supported files, then are piped out to different handlers if they exists.

3. Otherwise, all non supported files are simply copied.

It comes with basic dependency tracking, so any change will affect only its dependent sources.

## How it works?

The best way is adding tarima as dependency, global or locally, and then setup your `package.json` for using it:

```javascript
{ // package.json
  "scripts": {
    "dev": "tarima -w",
    "build": "tarima -f"
  }
}
```

Now calling `npm run dev` will start in watch-mode and `npm run build` will force a complete rebuild of all sources.

The default source directory is `./src` if you need anything else you can provide arguments, e.g. `tarima foo bar` which will produce `{foo,bar}/**/*` as input.

Also you can specify this option in your `package.json` file:

```javascript
{ // package.json
  "tarima": {
    "src": "{controllers,models,views}/**/*"
  }
}
```

### Handling sources

All files then are read or watch from given directories, any change will trigger a compilation process.

This process will transpile the given source file if tarima supports it, if not it will be piped or copied as stated above.

Basically you can write `./src/index.md` and obtain `./build/dist/src/index.html` as result.

> You'll notice that the source's filepath will be maintained as is, because you can specify multiple source directories and it will be difficult to resolve everything.

You can use the `rename` option for cut-off directories from the destination filepath:

```javascript
{ // package.json
  "tarima": {
    "rename": "**:{filepath/1}/{filename}.{extname}"
  }
}
```

This will match `./src/index.md` to `./build/dist/index.html` directly.

> The `{filepath/1}` expression will split the source's _dirname_ and remove the first directory from its left, e.g. `./dest/src/file.ext` becomes `./dest/file.ext` and such.

If you change the `dest` or `public` option you would obtain `./some-directory/index.html`, etc.

Tarima will let you organize your source files as your pleasure, and them process them as you expect, to write them finally wherever you want.

Not a complete building tool but damn useful for daily work.

### Notifications

Tarima will use `node-notifier` to display some feedback about the process.

You can customize some values of the notification popup:

```javascript
{ // package.json
  "tarima": {
    "notifications": {
      "title": "My app",
      "okIcon": "./success.png",
      "errIcon": "./failure.png"
    }
  }
}
```

### Caching support

Tarima is efficient by tracking dependencies using a json-file for caching, this way on each startup nothing will be compiled unless they are changes or dirty files.

By default the cache is taken from the `dest` directory, but you use a different file specifying the `cacheFile` option:

```javascript
{ // package.json
  "tarima": {
    "cacheFile": "./tarima.cache.json"
  }
}
```

### Bundle support

By default all scripts are transpiled only, you must enable the `bundle` option for globally treat each entry-point as bundle.

Or locally set the `_bundle` option as front-matter, like below:

```javascript
/**
---
_bundle: true
---
*/

import { getValue } from './other/script';

export default function () {
  return getValue(...arguments);
};
```

> When using `_bundle` you don't need to declare it on each imported file, only within the entry-points you want to bundle.

Even stylesheets are entry-points by nature:

```less
@import 'colors.less';

a { color: @link-text-color; }
```

So you don't need anything else to bundle stylesheets. ;)

## Ignore sources

Ignoring sources will skip all matched files from watching, Tarima will never track them for any purpose.

You can use the `ignoreFiles` to provide a glob-based file with patterns to be ignored.

Example:

```javascript
{ // package.json
  "tarima": {
    "ignoreFiles": [".gitignore"]
  }
}
```

Any `.gitignore` compatible format is supported.

## Filtering sources

Filtered sources are watched but not used for any transpilation process, they are ignored because they should be imported from any other entry-point file.

A common pattern is ignoring everything which starts with underscore:

```javascript
{ // package.json
  "tarima": {
    "filter": [
      "!_*",
      "!_*/**",
      "!**/_*",
      "!**/_*/**"
    ]
  }
}
```

## Rollup.js support

You can provide a configuration file for [rollup](https://github.com/rollup/rollup) using the `rollupFile` option:

```javascript
{ // package.json
  "tarima": {
    "rollupFile": "./rollup.config.js"
  }
}
```

The `src` and `dest` options are ignored since tarima will override them internally.

You can setup the specific behavior of bundling using `bundleOptions`:

```javascript
{ // package.json
  "tarima": {
    "bundleOptions": {
      "babel": {},
      "less": { "plugins": [] }
    }
  }
}
```

All given options are passed directly when calling the `bundle()` method on Tarima.

## Locals support

You can pass a global `locals` object accesible for all parsed templates, this way you can reuse anything do you need:

```javascript
{ // package.json
  "tarima": {
    "locals": {
      "title": "My project"
    }
  }
}
```

Given locals are passed directly when calling any `render()` method on Tarima.

## Plugins

Using the `plugins` option you can declare scripts or modules to be loaded and perform specific tasks, common plugins are:

- `tarima-bower` &mdash; Quick support for bower files.
- `tarima-images` &mdash; Support for sprites and lazy loading.
- `tarima-browser-sync` &mdash; Quick server live-reloading and more.

Some plugins can take its configuration from `pluginOptions` or directly from the main configuration:

```javascript
{ // package.json
  "tarima": {
    "pluginOptions": {
      "bower": { "bundle": true }
    }
  }
}
```
