/* eslint-disable */

/**
 * Parses a string with options
 * @private
 * @param str
 * @returns {Object}
 */
export function parseOptions(str) {
  var obj = {};
  var arr;
  var len;
  var val;
  var i;

  // Remove spaces before and after delimiters
  str = str.replace(/\s*:\s*/g, ':').replace(/\s*,\s*/g, ',');

  // Parse a string
  arr = str.split(',');
  for (i = 0, len = arr.length; i < len; i++) {
    arr[i] = arr[i].split(':');
    val = arr[i][1];

    // Convert a string value if it is like a boolean
    if (typeof val === 'string' || val instanceof String) {
      val = val === 'true' || (val === 'false' ? false : val);
    }

    // Convert a string value if it is like a number
    if (typeof val === 'string' || val instanceof String) {
      val = !isNaN(val) ? +val : val;
    }

    obj[arr[i][0]] = val;
  }

  return obj;
}

export function addClasses(el, classes) {
  classes = Array.prototype.slice.call (arguments, 1);
  for (var i = classes.length; i--;) {
    classes[i] = classes[i].trim ().split (/\s*,\s*|\s+/);
    for (var j = classes[i].length; j--;) {
      if (classes[i][j] && classes[i][j].length) {
        el.classList.add(classes[i][j]);
      }
    }
  }
}

export function removeClasses(el, classes) {
  classes = Array.prototype.slice.call (arguments, 1);
  for (var i = classes.length; i--;) {
    classes[i] = classes[i].trim ().split (/\s*,\s*|\s+/);
    for (var j = classes[i].length; j--;) {
      if (classes[i][j] && classes[i][j].length) {
        el.classList.remove(classes[i][j]);
      }
    }
  }
}

export function hide(element) {
  element.style.display = 'none';
}

export function show(element) {
  element.style.display = '';
}

export function remove(element) {
  element.parentNode.removeChild(element);
}

export function hasClass(element, className) {
  if (element.classList) {
    return element.classList.contains(className);
  } else {
    return new RegExp('(^| )' + className + '( |$)', 'gi').test(element.className);
  }
}

// Namespaced events
// https://gist.github.com/yairEO/cb60592476a4204b27e83048949dbb45
export var events = {
  on(events, cb, opts) {

    // save the namespaces on the DOM element itself
    if (!this.namespaces) {
      this.namespaces = {};
    }

    function addSingleNSEvent(event) {
      this.namespaces[event] = cb;
      var options = opts || false;

      this.addEventListener( event.split('.')[0], cb, options );
      return this;
    }

    events = events.split(' ');

    for (var i=0, iLen=events.length; i<iLen; i++) {
      addSingleNSEvent.call(this, events[i]);
    }

    return this;
  },

  off(events) {
    function removeSingleNSEvent(event) {
      this.removeEventListener( event.split('.')[0], this.namespaces[event] );
      delete this.namespaces[event];
      return this;
    }

    events = events.split(' ');

    for (var i=0, iLen=events.length; i<iLen; i++) {
      removeSingleNSEvent.call(this, events[i]);
    }
    return this;
  }
}
// Extend the DOM with these above custom methods
window.addNSEventListener = document.addNSEventListener = Element.prototype.addNSEventListener = events.on;
window.removeNSEventListener = document.removeNSEventListener = Element.prototype.removeNSEventListener = events.off;


export function triggerEvent(el, eventType, data = {}) {
  if (window.CustomEvent) {
    var event = new CustomEvent(eventType, {detail: data});
  } else {
    var event = document.createEvent('CustomEvent');
    event.initCustomEvent(eventType, true, true, data);
  }

  el.dispatchEvent(event);
}


export function getStyle(elem, style) {
  let styleList = window.getComputedStyle(elem);
  return styleList.getPropertyValue(style);
}

export function setStyle(elem, styles = {}) {
  for (var property in styles) {
    elem.style[property] = styles[property];
  }
}