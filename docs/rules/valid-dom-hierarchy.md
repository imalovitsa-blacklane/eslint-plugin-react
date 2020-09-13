# Prevent invalid DOM element hierarchy (e.g. nested `<p />` elements)

HTML has rules on which elements can be placed in which parents.
For example, `<head>` can only be a child of `<html>`, `<td>` can only be a child of `<tr>`.

If you try to nest `<p />` elements in an HTML file, the browser will transform the DOM
by splitting the outer `<p />` element at the point of inner `<p />` element.

## Rule Details

The following patterns are considered warnings:

```jsx
<table><td /><table>
<br><span /></br>
<p><p /></p>
React.createElement('table', undefined, React.createElement('td'))
```

The following patterns are **not** considered warnings:

```jsx
<table><tr><td /></tr></table>
<div><p /></div>
<p><span /></p>
React.createElement('div', undefined, React.createElement('p'))
React.createElement('table', undefined,
  React.createElement('tr', undefined,
    React.createElement('td')))
```
