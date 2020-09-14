/**
 * @fileoverview Prevent invalid table hierarchy:
 * Valid children:
 * <table> can only contain <thead>, <tbody>, <tfoot> or <tr>
 * <thead>, <tbody>, <tfoot> can only contain <tr>
 * <tr> can only contain <td> or <th>
 * Valid parents:
 * <thead>, <tbody>, <tfoot> can only be children of <table>
 * <tr> can only be child of <table>, <thead>, <tbody> or <tfoot>
 * <td> and <th> can only be children of <tr>
 * @author Igor Malovitsa
 */

'use strict';

const has = require('has');

const Components = require('../util/Components');
const docsUrl = require('../util/docsUrl');

// ------------------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------------------

const HTML_ELEMENT_CONTEXT = {
  // top level elements
  html: {context: 'html', parent: []},
  head: {context: 'head', parent: ['html']},
  title: {context: 'text', parent: ['head']},
  style: {context: 'text', parent: ['head']},
  script: {context: 'text', parent: ['flow', 'phrasing', 'head']},
  link: {context: 'void', parent: ['head']},
  meta: {context: 'void', parent: ['head']},
  base: {context: 'void', parent: ['head']},
  body: {context: 'flow', parent: ['html']},
  // table elements
  table: {context: 'table', parent: ['flow']},
  caption: {context: 'text', parent: ['table']},
  colgroup: {context: 'colgroup', parent: ['table']},
  command: {context: 'void', parent: ['colgroup']},
  col: {context: 'void', parent: ['colgroup']},
  thead: {context: 'table-section', parent: ['table']},
  tbody: {context: 'table-section', parent: ['table']},
  tfoot: {context: 'table-section', parent: ['table']},
  tr: {context: 'tr', parent: ['table', 'table-section']},
  th: {context: 'flow', parent: ['tr']},
  td: {context: 'flow', parent: ['tr']},
  // media elements
  picture: {context: 'picture', parent: ['phrasing', 'flow']},
  video: {context: 'video', parent: ['phrasing', 'flow']},
  audio: {context: 'audio', parent: ['phrasing', 'flow']},
  track: {context: 'void', parent: ['audio', 'video']},
  source: {context: 'void', parent: ['audio', 'video', 'picture']},
  img: {context: 'void', parent: ['phrasing', 'flow', 'picture']},
  // embedded content
  iframe: {context: 'void', parent: ['phrasing', 'flow']},
  embed: {contet: 'void', parent: ['phrasing', 'flow']},
  applet: {contet: 'object', parent: ['phrasing', 'flow']},
  object: {contet: 'object', parent: ['phrasing', 'flow']},
  param: {context: 'void', parent: ['object']},
  // select
  select: {context: 'select', parent: ['phrasing', 'flow']},
  optgroup: {context: 'optgroup', parent: ['select']},
  option: {context: 'text', parent: ['optgroup', 'select', 'datalist']},
  datalist: {context: 'phrasing', parent: 'phrasing'},
  // lists+menu
  menu: {context: 'menu', parent: ['flow']},
  menuitem: {context: 'void', parent: ['menu']},
  dir: {context: 'list', parent: ['flow']},
  ol: {context: 'list', parent: ['flow']},
  ul: {context: 'list', parent: ['flow']},
  li: {context: 'flow', parent: ['menu', 'list']},
  dl: {context: 'dl', parent: ['flow']},
  dt: {context: 'flow', parent: ['dl', 'div']},
  dd: {context: 'flow', parent: ['dl', 'div']},
  div: {context: 'flow', parent: ['flow', 'dl']},

  main: {context: 'flow', parent: ['flow']},
  p: {context: 'phrasing', parent: ['flow']},
  pre: {context: 'phrasing', parent: ['flow']},
  a: {context: 'phrasing', parent: ['flow', 'phrasing']},

  hgroup: {context: 'hgroup', parent: ['flow']},
  textarea: {context: 'text', parent: ['phrasing', 'flow']},
  hr: {context: 'void', parent: ['flow']},
  summary: {context: 'phrasing', parent: ['details']},

  footer: {
    context: 'flow',
    parent: ['flow'],
    exclude: ['footer', 'header', 'address']
  },
  header: {
    context: 'flow',
    parent: ['flow'],
    exclude: ['footer', 'header', 'address']
  },
  section: {context: 'flow', parent: ['flow'], exclude: ['address']},
  article: {context: 'flow', parent: ['flow'], exclude: ['address']},
  aside: {context: 'flow', parent: ['flow'], exclude: ['address']},
  figure: {context: 'flow', parent: ['flow']},
  figcaption: {context: 'flow', parent: ['figcaption']},
  fieldset: {context: 'flow', parent: ['flow']},
  legend: {context: 'phrasing', parent: ['fieldset']},
  // ruby annotation
  ruby: {context: 'phrasing', parent: ['phrasing']},
  rbc: {context: 'phrasing', parent: ['ruby']},
  rtc: {context: 'phrasing', parent: ['ruby']},
  rb: {context: 'phrasing', parent: ['ruby', 'rbc', 'rtc']},
  rp: {context: 'phrasing', parent: ['ruby', 'rbc', 'rtc']},
  rt: {context: 'phrasing', parent: ['ruby', 'rbc', 'rtc']}
};

const setContext = (dict, context, elements) => {
  elements.forEach((element) => {
    if (element in dict) {
      throw new Error(`duplicate key: ${element}`);
    }
    dict[element] = Object.assign({}, context);
  });
};

// Flow elements
setContext(HTML_ELEMENT_CONTEXT,
  {context: 'flow', parent: ['flow']},
  [
    'details', 'dialog', 'form', 'address', 'shadow', 'blockquote', 'nav'
  ]);

// Phrasing elements
setContext(HTML_ELEMENT_CONTEXT,
  {context: 'phrasing', parent: ['phrasing', 'flow']},
  [
    'abbr', 'b', 'bdi', 'button', 'canvas', 'cite', 'code', 'data', 'dfn',
    'em', 'i', 'kbd', 'label', 'mark', 'math', 'meter', 'output', 'progress',
    'q', 's', 'samp', 'small', 'slot', 'sub', 'sup', 'time', 'tt', 'u', 'var',
    'del', 'ins', 'span', 'strong'
  ]);

// Headings
setContext(HTML_ELEMENT_CONTEXT,
  {context: 'phrasing', parent: ['flow', 'hgroup', 'legend']},
  ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

// Void elements
setContext(HTML_ELEMENT_CONTEXT,
  {context: 'void', parent: ['phrasing', 'flow']},
  ['area', 'wbr', 'br', 'input', 'keygen']);

// elements that can't be own parents
[
  'a', 'dfn', 'label', 'meter', 'progress', 'canvas', 'main', 'form', 'address'
].forEach((element) => {
  HTML_ELEMENT_CONTEXT[element].exclude = [element];
});

// interactive elements
[
  'a', 'button', 'details', 'embed', 'iframe', 'keygen',
  'label', 'select', 'textarea',
  // these aren't always interactive, but why would you put them in button
  'input', 'menu'
  // audio, video aren't always interactive
].forEach((element) => {
  HTML_ELEMENT_CONTEXT[element].interactive = true;
});

// elements with no interactive children
[
  'a', 'button'
  // TODO: canvas is complicated
].forEach((element) => {
  HTML_ELEMENT_CONTEXT[element].noInteractive = true;
});

// transparent elements
[
  'audio', 'video', 'applet', 'object', 'slot', 'a', 'canvas',
  'del', 'ins'
].forEach((element) => {
  HTML_ELEMENT_CONTEXT[element].transparent = true;
});
// TODO: map, noscript, template

const isValidHTMLChild = (parentName, childName) => {
  if (!has(HTML_ELEMENT_CONTEXT, parentName)) {
    return 'maybe';
  }

  const parentConfig = HTML_ELEMENT_CONTEXT[parentName];
  const parentContext = parentConfig.context;

  if (parentContext.context === 'void') {
    return false;
  }

  if (!has(HTML_ELEMENT_CONTEXT, childName)) {
    return 'maybe';
  }

  const childConfig = HTML_ELEMENT_CONTEXT[childName];
  const allowedParent = childConfig.parent;

  if (parentConfig.noInteractive && childConfig.interactive) {
    return false;
  }

  if (childConfig.exclude && childConfig.exclude.indexOf(parentName) > -1) {
    return false;
  }

  return allowedParent.indexOf(parentContext) > -1
    || allowedParent.indexOf(parentName) > -1;
};

function errorMessage(parentName, elementName) {
  return `Invalid DOM elements hierarchy: <${elementName}>\
 is not a valid child of <${parentName}>.`;
}

const SKIP_PARENT_TYPES = [
  'LogicalExpression', 'ConditionalExpression', 'ReturnStatement',
  'BlockStatement', 'FunctionExpression', 'JSXExpressionContainer',
  'ArrowFunctionExpression'
];

function getCallElementName(node, utils) {
  if (!node || node.type !== 'CallExpression') {
    return;
  }

  if (node.callee.type !== 'MemberExpression'
    && node.callee.type !== 'Identifier') {
    return;
  }

  if (!utils.isCreateElement(node)) {
    return;
  }

  const args = node.arguments;

  // React.createElement() should not crash linter
  // also ignore React.createElement(CustomElement)
  if (args.length < 1 || args[0].type !== 'Literal') {
    return;
  }

  return args[0].value;
}

function findParentName(startNode, utils) {
  let node = startNode.parent;

  while (node) {
    // skip things which aren't important
    if (SKIP_PARENT_TYPES.indexOf(node.type) > -1) {
      node = node.parent;
    } else if (node.type === 'CallExpression'
      && node.callee.type === 'MemberExpression'
      && node.callee.property.type === 'Identifier'
      && node.callee.property.name === 'map') {
      node = node.parent;
    } else {
      if (node.type === 'JSXElement') {
        return node.openingElement.name.name;
      }

      if (node.type === 'CallExpression') {
        return getCallElementName(node, utils);
      }

      return;
    }
  }
}

// ------------------------------------------------------------------------------
// Rule Definition
// ------------------------------------------------------------------------------

module.exports = {
  meta: {
    docs: {
      description: 'Prevent invalid table hierarchy.',
      category: 'Best Practices',
      recommended: false,
      url: docsUrl('valid-dom-hierarchy')
    },
    schema: []
  },
  create: Components.detect((context, components, utils) => ({
    JSXElement(node) {
      const childName = node.openingElement.name.name;
      const parentName = findParentName(node, utils);
      if (!parentName) {
        return;
      }

      if (!isValidHTMLChild(parentName, childName)) {
        context.report({
          node,
          message: errorMessage(parentName, childName)
        });
      }
    },

    CallExpression(node) {
      const elementName = getCallElementName(node, utils);
      const parentName = findParentName(node, utils);
      if (!elementName || !parentName) {
        return;
      }

      if (!isValidHTMLChild(parentName, elementName)) {
        context.report({
          node,
          message: errorMessage(parentName, elementName)
        });
      }
    }
  }))
};
