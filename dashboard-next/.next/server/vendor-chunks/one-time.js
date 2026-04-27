"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/one-time";
exports.ids = ["vendor-chunks/one-time"];
exports.modules = {

/***/ "(rsc)/../node_modules/one-time/index.js":
/*!*****************************************!*\
  !*** ../node_modules/one-time/index.js ***!
  \*****************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

eval("\n\nvar name = __webpack_require__(/*! fn.name */ \"(rsc)/../node_modules/fn.name/index.js\");\n\n/**\n * Wrap callbacks to prevent double execution.\n *\n * @param {Function} fn Function that should only be called once.\n * @returns {Function} A wrapped callback which prevents multiple executions.\n * @public\n */\nmodule.exports = function one(fn) {\n  var called = 0\n    , value;\n\n  /**\n   * The function that prevents double execution.\n   *\n   * @private\n   */\n  function onetime() {\n    if (called) return value;\n\n    called = 1;\n    value = fn.apply(this, arguments);\n    fn = null;\n\n    return value;\n  }\n\n  //\n  // To make debugging more easy we want to use the name of the supplied\n  // function. So when you look at the functions that are assigned to event\n  // listeners you don't see a load of `onetime` functions but actually the\n  // names of the functions that this module will call.\n  //\n  // NOTE: We cannot override the `name` property, as that is `readOnly`\n  // property, so displayName will have to do.\n  //\n  onetime.displayName = name(fn);\n  return onetime;\n};\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi4vbm9kZV9tb2R1bGVzL29uZS10aW1lL2luZGV4LmpzIiwibWFwcGluZ3MiOiJBQUFhOztBQUViLFdBQVcsbUJBQU8sQ0FBQyx1REFBUzs7QUFFNUI7QUFDQTtBQUNBO0FBQ0EsV0FBVyxVQUFVO0FBQ3JCLGFBQWEsVUFBVTtBQUN2QjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXMiOlsiL2hvbWUvY2xzL3d3dy9QbGF5d3JpZ2h0X1RTX0FJL25vZGVfbW9kdWxlcy9vbmUtdGltZS9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbnZhciBuYW1lID0gcmVxdWlyZSgnZm4ubmFtZScpO1xuXG4vKipcbiAqIFdyYXAgY2FsbGJhY2tzIHRvIHByZXZlbnQgZG91YmxlIGV4ZWN1dGlvbi5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmbiBGdW5jdGlvbiB0aGF0IHNob3VsZCBvbmx5IGJlIGNhbGxlZCBvbmNlLlxuICogQHJldHVybnMge0Z1bmN0aW9ufSBBIHdyYXBwZWQgY2FsbGJhY2sgd2hpY2ggcHJldmVudHMgbXVsdGlwbGUgZXhlY3V0aW9ucy5cbiAqIEBwdWJsaWNcbiAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBvbmUoZm4pIHtcbiAgdmFyIGNhbGxlZCA9IDBcbiAgICAsIHZhbHVlO1xuXG4gIC8qKlxuICAgKiBUaGUgZnVuY3Rpb24gdGhhdCBwcmV2ZW50cyBkb3VibGUgZXhlY3V0aW9uLlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgZnVuY3Rpb24gb25ldGltZSgpIHtcbiAgICBpZiAoY2FsbGVkKSByZXR1cm4gdmFsdWU7XG5cbiAgICBjYWxsZWQgPSAxO1xuICAgIHZhbHVlID0gZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICBmbiA9IG51bGw7XG5cbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cblxuICAvL1xuICAvLyBUbyBtYWtlIGRlYnVnZ2luZyBtb3JlIGVhc3kgd2Ugd2FudCB0byB1c2UgdGhlIG5hbWUgb2YgdGhlIHN1cHBsaWVkXG4gIC8vIGZ1bmN0aW9uLiBTbyB3aGVuIHlvdSBsb29rIGF0IHRoZSBmdW5jdGlvbnMgdGhhdCBhcmUgYXNzaWduZWQgdG8gZXZlbnRcbiAgLy8gbGlzdGVuZXJzIHlvdSBkb24ndCBzZWUgYSBsb2FkIG9mIGBvbmV0aW1lYCBmdW5jdGlvbnMgYnV0IGFjdHVhbGx5IHRoZVxuICAvLyBuYW1lcyBvZiB0aGUgZnVuY3Rpb25zIHRoYXQgdGhpcyBtb2R1bGUgd2lsbCBjYWxsLlxuICAvL1xuICAvLyBOT1RFOiBXZSBjYW5ub3Qgb3ZlcnJpZGUgdGhlIGBuYW1lYCBwcm9wZXJ0eSwgYXMgdGhhdCBpcyBgcmVhZE9ubHlgXG4gIC8vIHByb3BlcnR5LCBzbyBkaXNwbGF5TmFtZSB3aWxsIGhhdmUgdG8gZG8uXG4gIC8vXG4gIG9uZXRpbWUuZGlzcGxheU5hbWUgPSBuYW1lKGZuKTtcbiAgcmV0dXJuIG9uZXRpbWU7XG59O1xuIl0sIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6WzBdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/../node_modules/one-time/index.js\n");

/***/ })

};
;