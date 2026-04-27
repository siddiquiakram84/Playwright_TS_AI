"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/enabled";
exports.ids = ["vendor-chunks/enabled"];
exports.modules = {

/***/ "(rsc)/../node_modules/enabled/index.js":
/*!****************************************!*\
  !*** ../node_modules/enabled/index.js ***!
  \****************************************/
/***/ ((module) => {

eval("\n\n/**\n * Checks if a given namespace is allowed by the given variable.\n *\n * @param {String} name namespace that should be included.\n * @param {String} variable Value that needs to be tested.\n * @returns {Boolean} Indication if namespace is enabled.\n * @public\n */\nmodule.exports = function enabled(name, variable) {\n  if (!variable) return false;\n\n  var variables = variable.split(/[\\s,]+/)\n    , i = 0;\n\n  for (; i < variables.length; i++) {\n    variable = variables[i].replace('*', '.*?');\n\n    if ('-' === variable.charAt(0)) {\n      if ((new RegExp('^'+ variable.substr(1) +'$')).test(name)) {\n        return false;\n      }\n\n      continue;\n    }\n\n    if ((new RegExp('^'+ variable +'$')).test(name)) {\n      return true;\n    }\n  }\n\n  return false;\n};\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi4vbm9kZV9tb2R1bGVzL2VuYWJsZWQvaW5kZXguanMiLCJtYXBwaW5ncyI6IkFBQWE7O0FBRWI7QUFDQTtBQUNBO0FBQ0EsV0FBVyxRQUFRO0FBQ25CLFdBQVcsUUFBUTtBQUNuQixhQUFhLFNBQVM7QUFDdEI7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQSxTQUFTLHNCQUFzQjtBQUMvQjs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0EiLCJzb3VyY2VzIjpbIi9ob21lL2Nscy93d3cvUGxheXdyaWdodF9UU19BSS9ub2RlX21vZHVsZXMvZW5hYmxlZC9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbi8qKlxuICogQ2hlY2tzIGlmIGEgZ2l2ZW4gbmFtZXNwYWNlIGlzIGFsbG93ZWQgYnkgdGhlIGdpdmVuIHZhcmlhYmxlLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIG5hbWVzcGFjZSB0aGF0IHNob3VsZCBiZSBpbmNsdWRlZC5cbiAqIEBwYXJhbSB7U3RyaW5nfSB2YXJpYWJsZSBWYWx1ZSB0aGF0IG5lZWRzIHRvIGJlIHRlc3RlZC5cbiAqIEByZXR1cm5zIHtCb29sZWFufSBJbmRpY2F0aW9uIGlmIG5hbWVzcGFjZSBpcyBlbmFibGVkLlxuICogQHB1YmxpY1xuICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGVuYWJsZWQobmFtZSwgdmFyaWFibGUpIHtcbiAgaWYgKCF2YXJpYWJsZSkgcmV0dXJuIGZhbHNlO1xuXG4gIHZhciB2YXJpYWJsZXMgPSB2YXJpYWJsZS5zcGxpdCgvW1xccyxdKy8pXG4gICAgLCBpID0gMDtcblxuICBmb3IgKDsgaSA8IHZhcmlhYmxlcy5sZW5ndGg7IGkrKykge1xuICAgIHZhcmlhYmxlID0gdmFyaWFibGVzW2ldLnJlcGxhY2UoJyonLCAnLio/Jyk7XG5cbiAgICBpZiAoJy0nID09PSB2YXJpYWJsZS5jaGFyQXQoMCkpIHtcbiAgICAgIGlmICgobmV3IFJlZ0V4cCgnXicrIHZhcmlhYmxlLnN1YnN0cigxKSArJyQnKSkudGVzdChuYW1lKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG5cbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGlmICgobmV3IFJlZ0V4cCgnXicrIHZhcmlhYmxlICsnJCcpKS50ZXN0KG5hbWUpKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZmFsc2U7XG59O1xuIl0sIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6WzBdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/../node_modules/enabled/index.js\n");

/***/ })

};
;