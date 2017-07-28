[![latest version](https://img.shields.io/npm/v/handlebars-loader.svg?maxAge=2592000)](https://www.npmjs.com/package/handlebars-loader)
[![downloads](https://img.shields.io/npm/dm/handlebars-loader.svg?maxAge=2592000)](https://www.npmjs.com/package/handlebars-loader)
[![Build Status](https://travis-ci.org/pcardune/handlebars-loader.svg?branch=master)](https://travis-ci.org/pcardune/handlebars-loader)
[![Coverage Status](https://coveralls.io/repos/github/pcardune/handlebars-loader/badge.svg?branch=master)](https://coveralls.io/github/pcardune/handlebars-loader?branch=master)

# handlebars-loader

A [handlebars](http://handlebarsjs.com) template loader for [webpack](https://github.com/webpack/webpack).

*Handlebars 4 now supported*

## Installation

`npm i handlebars-loader --save`

## General Usage

### webpack configuration

```javascript
{
  ...
  module: {
    rules: [
      ...
      { test: /\.handlebars$/, loader: "handlebars-loader" }
    ]
  }
}
```

### Your JS making use of the templates

```javascript
var template = require("./file.handlebars");
// => returns file.handlebars content as a template function
```

## Details

The loader resolves partials, helpers and decorators automatically. They are looked up relative to the current directory (this can be modified with the `rootRelative` option) or as a module if you prefix with `$`.

```handlebars
A file "/folder/file.handlebars".
{{> partial}} will reference "/folder/partial.handlebars".
{{> ../partial}} will reference "/partial.handlebars".
{{> $module/partial}} will reference "/folder/node_modules/module/partial.handlebars".

{{helper}} will reference the helper "/folder/helper.js" if this file exists.
{{[nested/helper] 'helper parameter'}} will reference the helper "/folder/nested/helper.js" if this file exists, passes 'helper parameter' as first parameter to helper.
{{../helper}} {{$module/helper}} are resolved similarly to partials.

{{*decorator}} will reference "/folder/decorator.js" if this file exists
{{*[nested/decorator]}} will reference "/folder/nested/decorator.js" if this file exists
{{*$module/decorator}} will reference "/folder/node_modules/module/decorator.js"
```

The following options are supported:

|Name|Type|Description|
|:--:|:--:|:----------|
|**`runtime`**|`{String}`|Path to the handlebars runtime. Defaults to `handlebars/runtime`|
|**`knownHelpers`**|`{Array<String>}`|Helpers that are registered at runtime and should not be included by webpack|
|**`precompileOptions`**|`{Object}`|Additional options for precompile. See [handlebars documentation](http://handlebarsjs.com/reference.html#base-precompile)|
|**`inlineRequires`**|`{Regex}`|Identifies strings within partial and helper parameters that should be replaced with inline require statements|
|**`rootRelative`**|`{String}`|Root path to use when automatically resolving partials, helpers and decorators. Use an empty string to turn off automatic resolution. Defaults to `./`|
|**`partialDirs`**|`{Array<String>}`|Additional directories to search for partials. See [example](examples/partialDirs)|
|**`helperDirs`**|`{Array<String>}`|Additional directories to search for helpers. See [example](examples/helperDirs)|
|**`decoratorDirs`**|`{Array<String>}`|Additional directories to search for decorators. See [example](examples/decoratorDirs)|
|**`extensions`**|`{Array<String>}`|Extensions to use when searching for partial templates. Defaults to `['.handlebars', '.hbs', '']`|
|**`exclude`**|`{Regex}`|Identifies paths to exclude from automatic resolution. For example use `node_modules` to ignore partials, helpers and decorators in modules|
|**`resolver`**|`{Function}`|Customize partial, helper and decorator resolution. See [custom resolver](#custom-resolver)|
|**`debug`**|`{Boolean}`|Shows trace information for partial and helper resolution|

See [`webpack`](https://github.com/webpack/webpack) documentation for more information regarding loaders.

## Custom Resolver

```javascript
/**
 * Resolves the full path for each item in template
 *
 * @param {function} resolve - Function with signature (request, type, callback), returns callback(err, result) with resolved path based on loader options
 * @param {string} request - The item being resolved, typically the partial or helper name
 * @param {string} type - The type of item being resolved, [partial|helper|decorator|unclear]
 * @param {function} callback - Callback function that takes error and full resolved path, call without arguments to ignore request
 */
function resolver(resolve, request, type, callback) {
  // Default behavior is to ignore resolution errors
  resolve(request, type, (err, result) => callback(null, result));
}
```

## Full examples

See the [examples](examples/) folder in this repo. The examples are fully runnable and demonstrate a number of concepts (using partials and helpers) -- just run `webpack` in that directory to produce `dist/bundle.js` in the same folder, open index.html.

## Change Log

See the [CHANGELOG.md](CHANGELOG.md) file.

## License

MIT (http://www.opensource.org/licenses/mit-license)
