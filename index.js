import {
  addClasses,
  removeClasses,
  parseOptions,
  hide,
  remove,
  hasClass,
  triggerEvent,
  getStyle,
  setStyle
} from './remodal-helpers';

/**
 * Name of the plugin
 * @private
 * @const
 * @type {String}
 */
const PLUGIN_NAME = 'remodal';


/**
 * Special plugin object for instances
 * @public
 * @type {Object}
 */
const remodalInstances = {
  lookup: []
};

/**
 * Namespace for CSS and events
 * @private
 * @const
 * @type {String}
 */
const NAMESPACE = PLUGIN_NAME;

/**
 * Animationstart event with vendor prefixes
 * @private
 * @const
 * @type {String}
 */
const ANIMATIONSTART_EVENTS = [
  'animationstart',
  'webkitAnimationStart',
  'MSAnimationStart',
  'oAnimationStart'
].map(eventName => `${eventName}.${NAMESPACE}`).join(' ');

/**
 * Animationend event with vendor prefixes
 * @private
 * @const
 * @type {String}
 */
const ANIMATIONEND_EVENTS = [
  'animationend',
  'webkitAnimationEnd',
  'MSAnimationEnd',
  'oAnimationEnd'
].map(eventName => `${eventName}.${NAMESPACE}`).join(' ');


/**
 * Default settings
 * @private
 * @const
 * @type {Object}
 */

const DEFAULTS = Object.assign({
  hashTracking: true,
  closeOnConfirm: true,
  closeOnCancel: true,
  closeOnEscape: true,
  closeOnOutsideClick: true,
  modifier: '',
  appendTo: null
}, window.REMODAL_GLOBALS && window.REMODAL_GLOBALS.DEFAULTS);

/**
 * States of the Remodal
 * @private
 * @const
 * @enum {String}
 */
const STATES = {
  CLOSING: 'closing',
  CLOSED: 'closed',
  OPENING: 'opening',
  OPENED: 'opened'
};

/**
 * Reasons of the state change.
 * @private
 * @const
 * @enum {String}
 */
const STATE_CHANGE_REASONS = {
  CONFIRMATION: 'confirmation',
  CANCELLATION: 'cancellation'
};

/**
 * Is animation supported?
 * @private
 * @const
 * @type {Boolean}
 */
const IS_ANIMATION = (function checkIsAnimation(style) {
  return style.animationName !== undefined
    || style.WebkitAnimationName !== undefined
    || style.MozAnimationName !== undefined
    || style.msAnimationName !== undefined
    || style.OAnimationName !== undefined;
}(document.createElement('div').style));

/**
 * Is iOS?
 * @private
 * @const
 * @type {Boolean}
 */
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.platform);

/**
 * Current modal
 * @private
 * @type {Remodal}
 */
let current;

/**
 * Scrollbar position
 * @private
 * @type {Number}
 */
let scrollTop;


function getPrefixedStyles(elem, styleName) {
  const prefixes = ['', '-webkit-', '-moz-', '-o-', '-ms-'];
  let matchingStyle;

  prefixes.forEach(prefix => {
    const style = getStyle(elem, prefix + styleName);
    if (style && style.length) {
      matchingStyle = style;
    }
  });

  return matchingStyle;
}

/**
 * Returns an animation duration
 * @private
 * @param {Element} elem
 * @returns {Number}
 */
function getAnimationDuration(elem) {
  if (IS_ANIMATION && getPrefixedStyles(elem, 'animation-name') === 'none') {
    return 0;
  }

  let duration = getPrefixedStyles(elem, 'animation-duration') || '0s';
  let delay = getStyle(elem, 'animation-delay') || '0s';
  let iterationCount = getStyle(elem, 'animation-iteration-count') || '1';

  let max;
  let len;
  let num;
  let i;

  duration = duration.split(', ');
  delay = delay.split(', ');
  iterationCount = iterationCount.split(', ');

  // The 'duration' size is the same as the 'delay' size
  for (i = 0, len = duration.length, max = Number.NEGATIVE_INFINITY; i < len; i += 1) {
    num = parseFloat(duration[i]) * parseInt(iterationCount[i], 10) + parseFloat(delay[i]);

    if (num > max) {
      max = num;
    }
  }

  return max;
}


/**
 * Returns a scrollbar width
 * @private
 * @returns {Number}
 */
function getScrollbarWidth() {
  // Nice way to get the true document height
  // https://stackoverflow.com/a/1147768/6523739
  const { body, documentElement } = document;

  const docHeight = Math.max(
    body.scrollHeight,
    body.offsetHeight,
    documentElement.clientHeight,
    documentElement.scrollHeight,
    documentElement.offsetHeight
  );

  const winHeight = window.innerHeight;

  if (docHeight <= winHeight) {
    return 0;
  }

  const outer = document.createElement('div');
  const inner = document.createElement('div');

  setStyle(outer, {
    visibility: 'hidden',
    width: '100px'
  });

  document.body.appendChild(outer);

  const widthNoScroll = outer.offsetWidth;

  // Force scrollbars
  setStyle(outer, { overflow: 'scroll' });

  // Add inner div
  setStyle(inner, { width: '100%' });
  outer.appendChild(inner);

  const widthWithScroll = inner.offsetWidth;

  // Remove divs
  remove(outer);

  return widthNoScroll - widthWithScroll;
}


/**
 * Generates a string separated by dashes and prefixed with NAMESPACE
 * @private
 * @param {...String}
 * @returns {String}
 */
function namespacify(...args) {
  let result = NAMESPACE;

  for (let i = 0; i < args.length; i += 1) {
    result += `-${args[i]}`;
  }

  return result;
}

/**
 * Toggle the screen lock
 * @param {String} action
 * @private
 */
function screenLockToggle(action) {
  if (IS_IOS) return;

  const html = document.querySelector('html');
  const lockedClass = namespacify('is-locked');
  const { body } = document;
  let paddingRight;
  let bodyPaddingRight;
  let scrollBarWidth;

  if (hasClass(html, lockedClass)) {
    bodyPaddingRight = parseInt(getStyle(body, 'padding-right'), 10);
    scrollBarWidth = getScrollbarWidth();

    paddingRight = (action === 'lock')
      ? bodyPaddingRight - scrollBarWidth
      : bodyPaddingRight + scrollBarWidth;

    setStyle(body, {
      'padding-right': `${paddingRight}px`
    });

    if (action === 'lock') {
      addClasses(html, lockedClass);
    } else {
      removeClasses(html, lockedClass);
    }
  }
}


/**
 * Sets a state for an instance
 * @private
 * @param {Remodal} instance
 * @param {STATES} state
 * @param {Boolean} isSilent If true, Remodal does not trigger events
 * @param {String} Reason of a state change.
 */
function setState(instance, state, isSilent, reason) {
  const newState = namespacify('is', state);

  const allStates = Object.values(STATES)
    .map((thisState) => namespacify('is', thisState))
    .join(' ');

  const instEls = [
    instance.bg,
    instance.overlay,
    instance.wrapper,
    instance.modal
  ];

  instEls.forEach(element => {
    removeClasses(element, allStates);
    addClasses(element, newState);
  });

  // eslint-disable-next-line
  instance.state = state;

  if (!isSilent) {
    triggerEvent(instance.modal, state, { reason });
  }
}

/**
 * Synchronizes with the animation
 * @param {Function} doBeforeAnimation
 * @param {Function} doAfterAnimation
 * @param {Remodal} instance
 */
function syncWithAnimation(doBeforeAnimation, doAfterAnimation, instance) {
  let runningAnimationsCount = 0;

  const handleAnimationStart = function _handleAnimationStart(e) {
    if (e.target !== this) {
      return;
    }

    runningAnimationsCount += 1;
  };

  const handleAnimationEnd = function _handleAnimationEnd(e) {
    if (e.target !== this) {
      return;
    }

    // eslint-disable-next-line
    const noMoreAnimations = (--runningAnimationsCount === 0);

    if (noMoreAnimations) {
      // Remove event listeners
      ['bg', 'overlay', 'wrapper', 'modal'].forEach(elemName => {
        instance[elemName].removeNSEventListener(`${ANIMATIONSTART_EVENTS} ${ANIMATIONEND_EVENTS}`);
      });

      doAfterAnimation();
    }
  };

  ['bg', 'overlay', 'wrapper', 'modal'].forEach(elemName => {
    instance[elemName].addNSEventListener(ANIMATIONSTART_EVENTS, handleAnimationStart);
    instance[elemName].addNSEventListener(ANIMATIONEND_EVENTS, handleAnimationEnd);
  });

  doBeforeAnimation();

  // If the animation is not supported by a browser or its duration is 0
  if (
    getAnimationDuration(instance.bg) === 0
    && getAnimationDuration(instance.overlay) === 0
    && getAnimationDuration(instance.wrapper) === 0
    && getAnimationDuration(instance.modal) === 0
  ) {
    // Remove event listeners
    ['bg', 'overlay', 'wrapper', 'modal'].forEach(elemName => {
      instance[elemName].removeNSEventListener(`${ANIMATIONSTART_EVENTS} ${ANIMATIONEND_EVENTS}`);
    });

    doAfterAnimation();
  }
}

/**
 * Closes immediately
 * @private
 * @param {Remodal} instance
 */
function halt(instance) {
  if (instance.state === STATES.CLOSED) {
    return;
  }

  ['bg', 'overlay', 'wrapper', 'modal'].forEach(elemName => {
    instance[elemName].removeNSEventListener(`${ANIMATIONSTART_EVENTS} ${ANIMATIONEND_EVENTS}`);
  });

  removeClasses(instance.bg, instance.settings.modifier);
  removeClasses(instance.overlay, instance.settings.modifier);

  hide(instance.overlay);
  hide(instance.wrapper);

  screenLockToggle('unlock');
  setState(instance, STATES.CLOSED, true);
}


/**
 * Handles the hashchange event
 * @private
 * @listens hashchange
 */
function handleHashChangeEvent() {
  const id = window.location.hash.replace('#', '');
  let instance;
  let elem;

  if (!id) {
    // Check if we have currently opened modal and animation was completed
    if (current && current.state === STATES.OPENED && current.settings.hashTracking) {
      current.close();
    }
  } else {
    // Catch syntax error if your hash is bad
    try {
      elem = document.querySelector(`[data-remodal-id="${id}"]`);
    } catch (err) {
      throw new Error(err);
    }

    if (elem) {
      instance = remodalInstances.lookup[elem.getAttribute('data-remodal')];

      if (instance && instance.settings.hashTracking) {
        instance.open();
      }
    }
  }
}

/**
 * Remodal constructor
 * @constructor
 * @param {Element} modal
 * @param {Object} options
 */
class Remodal {
  constructor(modal, options) {
    const { body } = document;
    let appendTo = body;

    this.settings = Object.assign(DEFAULTS, options);
    this.index = remodalInstances.lookup.push(this) - 1;
    this.state = STATES.CLOSED;

    this.overlay = document.querySelector(`.${namespacify('overlay')}`);

    if (this.settings.appendTo !== null && this.settings.appendTo.length) {
      // eslint-disable-next-line
      appendTo = this.settings.appendTo;
    }

    if (!this.overlay) {
      this.overlay = document.createElement('div');

      addClasses(this.overlay, `${namespacify('overlay')} ${namespacify('is', STATES.CLOSED)}`);

      hide(this.overlay);

      appendTo.appendChild(this.overlay);
    }

    this.bg = document.querySelector(`.${namespacify('bg')}`);

    if (this.bg) {
      this.bg.classList.add(namespacify('is', STATES.CLOSED));
    }

    // Add classes to the modal
    this.modal = modal;
    addClasses(this.modal, `${NAMESPACE} ${namespacify('is-initialized')} ${this.settings.modifier} ${namespacify('is', STATES.CLOSED)}`);
    this.modal.setAttribute('tabindex', '-1');

    this.wrapper = document.createElement('div');
    addClasses(this.wrapper, `${namespacify('wrapper')} ${this.settings.modifier} ${namespacify('is', STATES.CLOSED)}`);
    hide(this.wrapper);
    this.wrapper.appendChild(this.modal);

    appendTo.appendChild(this.wrapper);

    // Add the event listener for the close button
    const closeButtons = this.wrapper.querySelectorAll('[data-remodal-action="close"]');


    if (closeButtons.length) {
      [...closeButtons].forEach(closeButton => {
        closeButton.addNSEventListener('click.remodal', e => {
          e.preventDefault();
          this.close();
        });
      })
    }

    // Add the event listener for the cancel button
    const cancelButton = this.wrapper.querySelector('[data-remodal-action="cancel"]');
    if (cancelButton) {
      cancelButton.addNSEventListener('click.remodal', e => {
        e.preventDefault();

        triggerEvent(this.modal, STATE_CHANGE_REASONS.CANCELLATION);

        if (this.settings.closeOnCancel) {
          this.close(STATE_CHANGE_REASONS.CANCELLATION);
        }
      });
    }

    // Add the event listener for the confirm button
    const confirmButton = this.wrapper.querySelector('[data-remodal-action="confirm"]');
    if (confirmButton) {
      confirmButton.addNSEventListener('click.remodal', e => {
        e.preventDefault();

        triggerEvent(this.modal, STATE_CHANGE_REASONS.CONFIRMATION);

        if (this.settings.closeOnConfirm) {
          this.close(STATE_CHANGE_REASONS.CONFIRMATION);
        }
      });
    }

    // Add the event listener for the overlay
    this.wrapper.addNSEventListener('click.remodal', ({ target }) => {
      if (!hasClass(target, namespacify('wrapper'))) {
        return;
      }

      if (this.settings.closeOnOutsideClick) {
        this.close();
      }
    });
  }


  /**
   * Opens a modal window
   * @public
   */
  open() {
    // Check if the animation was completed
    if (this.state === STATES.OPENING || this.state === STATES.CLOSING) {
      return;
    }

    const id = this.modal.getAttribute('data-remodal-id');

    if (id && this.settings.hashTracking) {
      const supportPageOffset = window.pageXOffset !== undefined;
      const isCSS1Compat = ((document.compatMode || "") === "CSS1Compat");
      const y = supportPageOffset ? window.pageYOffset : isCSS1Compat ? document.documentElement.scrollTop : document.body.scrollTop;

      scrollTop = y;
      window.location.hash = id;
    }

    if (current && current !== this) {
      halt(current);
    }

    current = this;
    screenLockToggle('lock');

    addClasses(this.bg, this.settings.modifier);
    addClasses(this.overlay, this.settings.modifier);

    setStyle(this.overlay, { display: 'block' });
    setStyle(this.wrapper, { display: 'block' });

    this.wrapper.scrollTo(0, 0);
    this.modal.focus();

    syncWithAnimation(
      () => { setState(this, STATES.OPENING); },
      () => { setState(this, STATES.OPENED); },
      this
    );
  }


  /**
   * Closes a modal window
   * @public
   * @param {String} reason
   */
  close(reason) {
    // Check if the animation was completed
    if (
      this.state === STATES.OPENING
        || this.state === STATES.CLOSING
        || this.state === STATES.CLOSED
    ) {
      return;
    }

    if (this.settings.hashTracking && this.modal.getAttribute('data-remodal-id') === window.location.hash.substr(1)) {
      window.location.hash = '';
      window.scrollTo(0, 0);
    }

    syncWithAnimation(
      () => {
        setState(this, STATES.CLOSING, false, reason);
      },
      () => {
        removeClasses(this.bg, this.settings.modifier);
        removeClasses(this.overlay, this.settings.modifier);
        hide(this.overlay);
        hide(this.wrapper);

        screenLockToggle('unlock');

        setState(this, STATES.CLOSED, false, reason);
      },
      this
    );
  }


  /**
   * Returns a current state of a modal
   * @public
   * @returns {STATES}
   */
  getState() {
    return this.state;
  }

  /**
   * Destroys a modal
   * @public
   */
  destroy() {
    const { lookup } = remodalInstances;

    halt(this);
    remove(this.wrapper);

    delete lookup[this.index];

    // TODO, make sure this is working as expected.
    const instanceCount = lookup.filter(instance => !!instance).length;

    if (instanceCount === 0) {
      remove(this.overlay);
      removeClasses(this.bg, `${namespacify('is', STATES.CLOSING)} ${namespacify('is', STATES.OPENING)} ${namespacify('is', STATES.CLOSED)} ${namespacify('is', STATES.OPENED)}`);
    }
  }
}

function remodal(element, opts) {
  let instance;

  // Make sure modal hasn't already be initalised
  if (element.getAttribute('data-remodal') == null) {
    instance = new Remodal(element, opts);
    element.setAttribute('data-remodal', instance.index);

    if (instance.settings.hashTracking && element.getAttribute('data-remodal-id') === window.location.hash.substr(1)) {
      instance.open();
    }
  } else {
    instance = remodalInstances.lookup[element.getAttribute('data-remodal')];
  }

  return instance;
}

function init() {
  // data-remodal-target opens a modal window with the special Id
  [...document.querySelectorAll('[data-remodal-target]')].forEach(modalTarget => {
    modalTarget.addNSEventListener('click', (e) => {
      e.preventDefault();

      const elem = e.currentTarget;
      const id = elem.getAttribute('data-remodal-target');
      const target = document.querySelector(`[data-remodal-id="${id}"]`);

      remodalInstances.lookup[target.getAttribute('data-remodal')].open();
    });
  });

  // Auto initialization of modal windows
  // They should have the 'remodal' class attribute
  // Also you can write the `data-remodal-options` attribute to pass params into the modal
  [...document.querySelectorAll('.remodal')].forEach(container => {
    let options = container.getAttribute('data-remodal-options');

    if (!options) {
      options = {};
    } else if (typeof options === 'string' || options instanceof String) {
      options = parseOptions(options);
    }

    // Create an instance of the Remodal class
    remodal(container, options);
  });

  // Handles the keydown event
  document.addNSEventListener('keydown.remodal', ({ keyCode }) => {
    if (
      current
      && current.settings.closeOnEscape
      && current.state === STATES.OPENED
      && keyCode === 27
    ) {
      current.close();
    }
  });

  // Handles the hashchange event
  window.addNSEventListener('hashchange.remodal', handleHashChangeEvent);
}

export default function() {
  // If document is already loaded
  if (document.readyState === 'complete' || document.readyState === 'loaded') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }

  return remodal;
}
