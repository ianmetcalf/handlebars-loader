'use strict';

const loaderUtils = require("loader-utils");
const handlebars = require("handlebars");
const async = require("async");
const path = require("path");
const assign = require("object-assign");
const fastreplace = require('./lib/fastreplace');
const findNestedRequires = require('./lib/findNestedRequires');

function versionCheck(hbCompiler, hbRuntime) {
  return hbCompiler.COMPILER_REVISION === (hbRuntime["default"] || hbRuntime).COMPILER_REVISION;
}

function defaultResolver(fn, request, type, callback) {
  fn(request, type, (err, result) => callback(null, result));
}

module.exports = function(source) {
  if (this.cacheable) this.cacheable();

  const options = loaderUtils.getOptions(this) || {};

  const runtimePath = options.runtime || require.resolve("handlebars/runtime");

  if (!versionCheck(handlebars, require(runtimePath))) {
    throw new Error('Handlebars compiler version does not match runtime version');
  }

  const precompileOptions = options.precompileOptions || {};

  const knownHelpers = {};

  [].concat(options.knownHelpers, precompileOptions.knownHelpers).forEach(k => {
    if (k && typeof k === 'string') {
      knownHelpers[k] = true;
    }
  });

  const rootRelative = options.rootRelative;

  const partialDirs = [].concat(options.partialDirs || []);
  const helperDirs = [].concat(options.helperDirs || []);
  const decoratorDirs = [].concat(options.decoratorDirs || []);

  // Possible extensions for partials
  let extensions = options.extensions || [".handlebars", ".hbs", ""];

  if (typeof extensions === 'string') {
    extensions = extensions.split(/[ ,;]/g);
  }

  const inlineRequires = options.inlineRequires && new RegExp(options.inlineRequires);
  const exclude = options.exclude && new RegExp(options.exclude);

  const resolver = options.resolver || defaultResolver;

  const debug = !!options.debug;

  function referenceToRequest(ref, type) {
    if (/^\$/.test(ref)) {
      return ref.substring(1);
    }

    // Check if automatic relative helper resolution has been turned off
    if (rootRelative === '') {
      return ref;
    }

    // Use a relative path by default or for helpers if directories are given
    if (!rootRelative || (/helper|unclear/.test(type) && helperDirs.length)) {
      return './' + ref;
    }

    return rootRelative + ref;
  }

  const loaderApi = this;

  function resolve(request, type, callback) {
    let contexts = [loaderApi.context];
    let exts = [];

    if (type === 'partial') {
      contexts = partialDirs.concat(contexts);
      exts = extensions.slice();
    } else if (type === 'decorator') {
      contexts = decoratorDirs.concat(contexts);
    } else {
      contexts = helperDirs.concat(contexts);
    }

    (function resolveWithContexts() {
      const context = contexts.shift();
      const ext = exts.shift() || '';

      let traceMsg = '';

      if (debug) {
        traceMsg = path.normalize(path.join(context, request + ext));
        console.log("Attempting to resolve %s %s", type, traceMsg);
      }

      loaderApi.resolve(context, request + ext, (err, result) => {
        if (err || !result) {
          if (debug) {
            console.log("Failed to resolve %s %s", type, traceMsg);
          }
        } else if (exclude && exclude.test(result)) {
          if (debug) {
            console.log("Excluding %s %s", type, traceMsg);
          }
        } else {
          if (debug) {
            console.log("Resolved %s %s", type, traceMsg);
          }

          return callback(null, result);
        }

        if (exts.length) {
          contexts.unshift(context);
          return resolveWithContexts();
        }

        if (contexts.length) {
          exts = extensions.slice();
          return resolveWithContexts();
        }

        return callback(err);
      });
    }());
  }

  const foundStuff = {};

  const hb = handlebars.create();

  class JavaScriptCompiler extends hb.JavaScriptCompiler {
    get compiler() {
      return JavaScriptCompiler;
    }

    nameLookup(parent, name, type) {
      if (debug) {
        console.log("nameLookup %s %s %s", parent, name, type);
      }

      let key;

      switch (type) {
      case 'partial':
        // this is a built in partial, no need to require it
        if (name === '@partial-block') break;

        key = `>${ name }`;

        if (!foundStuff[key]) {
          foundStuff[key] = null;
        } else if (foundStuff[key].length) {
          return `require(${ JSON.stringify(foundStuff[key]) })`;
        }

        break;

      case 'helper':
        key = `#${ name }`;

        if (!foundStuff[key]) {
          foundStuff[key] = null;
        } else if (foundStuff[key].length) {
          return `__default(require(${ JSON.stringify(foundStuff[key]) }))`;
        }

        break;

      case 'decorator':
        key = `*${ name }`;

        if (!foundStuff[key]) {
          foundStuff[key] = null;
        } else if (foundStuff[key].length) {
          return `__default(require(${ JSON.stringify(foundStuff[key]) }))`;
        }

        break;

      case 'context':
        key = `?${ name }`;

        // This could be a helper too, save it to check it later
        if (!foundStuff[key]) {
          foundStuff[key] = null;
        }

        break;
      }

      return super.nameLookup(parent, name, type);
    }

    pushString(value) {
      if (inlineRequires && inlineRequires.test(value)) {
        return this.pushLiteral(`require(${ JSON.stringify(value) })`);
      }

      return super.pushString(value);
    }

    appendToBuffer(str) {
      // This is a template (stringified HTML) chunk
      if (inlineRequires && str.indexOf && str.indexOf('"') === 0) {
        const replacements = findNestedRequires(str, inlineRequires);

        str = fastreplace(str, replacements, match => (
          `" + require(${ JSON.stringify(match) }) + "`
        ));
      }

      return super.appendToBuffer(str);
    }
  }

  hb.JavaScriptCompiler = JavaScriptCompiler;

  // This is an async loader
  const loaderAsyncCallback = this.async();

  let firstCompile = true;
  let compilationPass = 0;

  (function compile() {
    compilationPass += 1;

    if (debug) {
      console.log("\nCompilation pass %d", compilationPass);
    }

    // Need another compiler pass?
    let needRecompile = false;

    // Precompile template
    let template = '';

    try {
      if (source) {
        template = hb.precompile(source, assign({
          knownHelpersOnly: !firstCompile,
        }, precompileOptions, {
          knownHelpers,
        }));
      }
    } catch (err) {
      return loaderAsyncCallback(err);
    }

    return async.each(Object.keys(foundStuff), (key, callback) => {
      if (foundStuff[key]) {
        return callback();
      }

      const name = key.substr(1);

      const type = {
        '>': 'partial',
        '#': 'helper',
        '?': 'unclear',
        '*': 'decorator',
      }[key[0]];

      const request = referenceToRequest(name, type);

      return resolver(resolve, request, type, (err, result) => {
        if (err) return callback(err);

        foundStuff[key] = true;

        if (result) {
          foundStuff[key.replace(/^\?/, '#')] = result;

          if (/helper|unclear/.test(type)) {
            knownHelpers[name] = true;
          }

          needRecompile = true;
        }

        callback();
      });
    }, err => {
      if (err) return loaderAsyncCallback(err);

      // Do another compiler pass if not everything was resolved
      if (needRecompile) {
        firstCompile = false;
        return compile();
      }

      // Export stub module if template is blank
      if (!template) {
        return loaderAsyncCallback(null, 'module.exports = function(){return "";};');
      }

      const slug = `
var Handlebars = require(${ JSON.stringify(runtimePath) });
function __default(obj) { return obj && (obj.__esModule ? obj["default"] : obj); }
module.exports = __default(Handlebars).template(${ template });
`;

      return loaderAsyncCallback(null, slug);
    });
  }());
};
