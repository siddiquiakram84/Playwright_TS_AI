"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/fn.name";
exports.ids = ["vendor-chunks/fn.name"];
exports.modules = {

/***/ "(rsc)/../node_modules/fn.name/index.js":
/*!****************************************!*\
  !*** ../node_modules/fn.name/index.js ***!
  \****************************************/
/***/ ((module) => {

eval("\n\nvar toString = Object.prototype.toString;\n\n/**\n * Extract names from functions.\n *\n * @param {Function} fn The function who's name we need to extract.\n * @returns {String} The name of the function.\n * @public\n */\nmodule.exports = function name(fn) {\n  if ('string' === typeof fn.displayName && fn.constructor.name) {\n    return fn.displayName;\n  } else if ('string' === typeof fn.name && fn.name) {\n    return fn.name;\n  }\n\n  //\n  // Check to see if the constructor has a name.\n  //\n  if (\n       'object' === typeof fn\n    && fn.constructor\n    && 'string' === typeof fn.constructor.name\n  ) return fn.constructor.name;\n\n  //\n  // toString the given function and attempt to parse it out of it, or determine\n  // the class.\n  //\n  var named = fn.toString()\n    , type = toString.call(fn).slice(8, -1);\n\n  if ('Function' === type) {\n    named = named.substring(named.indexOf('(') + 1, named.indexOf(')'));\n  } else {\n    named = type;\n  }\n\n  return named || 'anonymous';\n};\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi4vbm9kZV9tb2R1bGVzL2ZuLm5hbWUvaW5kZXguanMiLCJtYXBwaW5ncyI6IkFBQWE7O0FBRWI7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsV0FBVyxVQUFVO0FBQ3JCLGFBQWEsUUFBUTtBQUNyQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBSTtBQUNKO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLElBQUk7QUFDSjtBQUNBOztBQUVBO0FBQ0EiLCJzb3VyY2VzIjpbIi9ob21lL2Nscy93d3cvUGxheXdyaWdodF9UU19BSS9ub2RlX21vZHVsZXMvZm4ubmFtZS9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbnZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmc7XG5cbi8qKlxuICogRXh0cmFjdCBuYW1lcyBmcm9tIGZ1bmN0aW9ucy5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmbiBUaGUgZnVuY3Rpb24gd2hvJ3MgbmFtZSB3ZSBuZWVkIHRvIGV4dHJhY3QuXG4gKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgbmFtZSBvZiB0aGUgZnVuY3Rpb24uXG4gKiBAcHVibGljXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gbmFtZShmbikge1xuICBpZiAoJ3N0cmluZycgPT09IHR5cGVvZiBmbi5kaXNwbGF5TmFtZSAmJiBmbi5jb25zdHJ1Y3Rvci5uYW1lKSB7XG4gICAgcmV0dXJuIGZuLmRpc3BsYXlOYW1lO1xuICB9IGVsc2UgaWYgKCdzdHJpbmcnID09PSB0eXBlb2YgZm4ubmFtZSAmJiBmbi5uYW1lKSB7XG4gICAgcmV0dXJuIGZuLm5hbWU7XG4gIH1cblxuICAvL1xuICAvLyBDaGVjayB0byBzZWUgaWYgdGhlIGNvbnN0cnVjdG9yIGhhcyBhIG5hbWUuXG4gIC8vXG4gIGlmIChcbiAgICAgICAnb2JqZWN0JyA9PT0gdHlwZW9mIGZuXG4gICAgJiYgZm4uY29uc3RydWN0b3JcbiAgICAmJiAnc3RyaW5nJyA9PT0gdHlwZW9mIGZuLmNvbnN0cnVjdG9yLm5hbWVcbiAgKSByZXR1cm4gZm4uY29uc3RydWN0b3IubmFtZTtcblxuICAvL1xuICAvLyB0b1N0cmluZyB0aGUgZ2l2ZW4gZnVuY3Rpb24gYW5kIGF0dGVtcHQgdG8gcGFyc2UgaXQgb3V0IG9mIGl0LCBvciBkZXRlcm1pbmVcbiAgLy8gdGhlIGNsYXNzLlxuICAvL1xuICB2YXIgbmFtZWQgPSBmbi50b1N0cmluZygpXG4gICAgLCB0eXBlID0gdG9TdHJpbmcuY2FsbChmbikuc2xpY2UoOCwgLTEpO1xuXG4gIGlmICgnRnVuY3Rpb24nID09PSB0eXBlKSB7XG4gICAgbmFtZWQgPSBuYW1lZC5zdWJzdHJpbmcobmFtZWQuaW5kZXhPZignKCcpICsgMSwgbmFtZWQuaW5kZXhPZignKScpKTtcbiAgfSBlbHNlIHtcbiAgICBuYW1lZCA9IHR5cGU7XG4gIH1cblxuICByZXR1cm4gbmFtZWQgfHwgJ2Fub255bW91cyc7XG59O1xuIl0sIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6WzBdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/../node_modules/fn.name/index.js\n");

/***/ })

};
;