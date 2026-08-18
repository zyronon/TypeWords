/*! shepherd.js 14.5.1 */

/**
 * Checks if `value` is classified as an `Element`.
 * @param value The param to check if it is an Element
 */
function isElement$1(value) {
  return value instanceof Element;
}

/**
 * Checks if `value` is classified as an `HTMLElement`.
 * @param value The param to check if it is an HTMLElement
 */
function isHTMLElement$1(value) {
  return value instanceof HTMLElement;
}

/**
 * Checks if `value` is classified as a `Function` object.
 * @param value The param to check if it is a function
 */
// eslint-disable-next-line @typescript-eslint/ban-types
function isFunction(value) {
  return typeof value === 'function';
}

/**
 * Checks if `value` is classified as a `String` object.
 * @param value The param to check if it is a string
 */
function isString(value) {
  return typeof value === 'string';
}

/**
 * Checks if `value` is undefined.
 * @param value The param to check if it is undefined
 */
function isUndefined(value) {
  return value === undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any

class Evented {
  /**
   * Adds an event listener for the given event string.
   *
   * @param {string} event
   * @param {Function} handler
   * @param ctx
   * @param {boolean} once
   * @returns
   */
  on(event, handler, ctx, once = false) {
    var _this$bindings$event;
    if (isUndefined(this.bindings)) {
      this.bindings = {};
    }
    if (isUndefined(this.bindings[event])) {
      this.bindings[event] = [];
    }
    (_this$bindings$event = this.bindings[event]) == null || _this$bindings$event.push({
      handler,
      ctx,
      once
    });
    return this;
  }

  /**
   * Adds an event listener that only fires once for the given event string.
   *
   * @param {string} event
   * @param {Function} handler
   * @param ctx
   * @returns
   */
  once(event, handler, ctx) {
    return this.on(event, handler, ctx, true);
  }

  /**
   * Removes an event listener for the given event string.
   *
   * @param {string} event
   * @param {Function} handler
   * @returns
   */
  off(event, handler) {
    if (isUndefined(this.bindings) || isUndefined(this.bindings[event])) {
      return this;
    }
    if (isUndefined(handler)) {
      delete this.bindings[event];
    } else {
      var _this$bindings$event2;
      (_this$bindings$event2 = this.bindings[event]) == null || _this$bindings$event2.forEach((binding, index) => {
        if (binding.handler === handler) {
          var _this$bindings$event3;
          (_this$bindings$event3 = this.bindings[event]) == null || _this$bindings$event3.splice(index, 1);
        }
      });
    }
    return this;
  }

  /**
   * Triggers an event listener for the given event string.
   *
   * @param {string} event
   * @returns
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trigger(event, ...args) {
    if (!isUndefined(this.bindings) && this.bindings[event]) {
      var _this$bindings$event4;
      (_this$bindings$event4 = this.bindings[event]) == null || _this$bindings$event4.forEach((binding, index) => {
        const {
          ctx,
          handler,
          once
        } = binding;
        const context = ctx || this;
        handler.apply(context, args);
        if (once) {
          var _this$bindings$event5;
          (_this$bindings$event5 = this.bindings[event]) == null || _this$bindings$event5.splice(index, 1);
        }
      });
    }
    return this;
  }
}

function _extends() {
  return _extends = Object.assign ? Object.assign.bind() : function (n) {
    for (var e = 1; e < arguments.length; e++) {
      var t = arguments[e];
      for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
    }
    return n;
  }, _extends.apply(null, arguments);
}
function _objectWithoutPropertiesLoose(r, e) {
  if (null == r) return {};
  var t = {};
  for (var n in r) if ({}.hasOwnProperty.call(r, n)) {
    if (e.includes(n)) continue;
    t[n] = r[n];
  }
  return t;
}

/**
 * Special values that tell deepmerge to perform a certain action.
 */
const actions = {
  defaultMerge: Symbol("deepmerge-ts: default merge"),
  skip: Symbol("deepmerge-ts: skip")
};
/**
 * Special values that tell deepmergeInto to perform a certain action.
 */
({
  defaultMerge: actions.defaultMerge
});

/**
 * The default function to update meta data.
 *
 * It doesn't update the meta data.
 */
function defaultMetaDataUpdater(previousMeta, metaMeta) {
  return metaMeta;
}
/**
 * The default function to filter values.
 *
 * It filters out undefined values.
 */
function defaultFilterValues(values, meta) {
  return values.filter(value => value !== undefined);
}

/**
 * The different types of objects deepmerge-ts support.
 */
var ObjectType;
(function (ObjectType) {
  ObjectType[ObjectType["NOT"] = 0] = "NOT";
  ObjectType[ObjectType["RECORD"] = 1] = "RECORD";
  ObjectType[ObjectType["ARRAY"] = 2] = "ARRAY";
  ObjectType[ObjectType["SET"] = 3] = "SET";
  ObjectType[ObjectType["MAP"] = 4] = "MAP";
  ObjectType[ObjectType["OTHER"] = 5] = "OTHER";
})(ObjectType || (ObjectType = {}));
/**
 * Get the type of the given object.
 *
 * @param object - The object to get the type of.
 * @returns The type of the given object.
 */
function getObjectType(object) {
  if (typeof object !== "object" || object === null) {
    return 0 /* ObjectType.NOT */;
  }
  if (Array.isArray(object)) {
    return 2 /* ObjectType.ARRAY */;
  }
  if (isRecord(object)) {
    return 1 /* ObjectType.RECORD */;
  }
  if (object instanceof Set) {
    return 3 /* ObjectType.SET */;
  }
  if (object instanceof Map) {
    return 4 /* ObjectType.MAP */;
  }
  return 5 /* ObjectType.OTHER */;
}
/**
 * Get the keys of the given objects including symbol keys.
 *
 * Note: Only keys to enumerable properties are returned.
 *
 * @param objects - An array of objects to get the keys of.
 * @returns A set containing all the keys of all the given objects.
 */
function getKeys(objects) {
  const keys = new Set();
  for (const object of objects) {
    for (const key of [...Object.keys(object), ...Object.getOwnPropertySymbols(object)]) {
      keys.add(key);
    }
  }
  return keys;
}
/**
 * Does the given object have the given property.
 *
 * @param object - The object to test.
 * @param property - The property to test.
 * @returns Whether the object has the property.
 */
function objectHasProperty(object, property) {
  return typeof object === "object" && Object.prototype.propertyIsEnumerable.call(object, property);
}
/**
 * Get an iterable object that iterates over the given iterables.
 */
function getIterableOfIterables(iterables) {
  return {
    *[Symbol.iterator]() {
      for (const iterable of iterables) {
        for (const value of iterable) {
          yield value;
        }
      }
    }
  };
}
const validRecordToStringValues = new Set(["[object Object]", "[object Module]"]);
/**
 * Does the given object appear to be a record.
 */
function isRecord(value) {
  // All records are objects.
  if (!validRecordToStringValues.has(Object.prototype.toString.call(value))) {
    return false;
  }
  const {
    constructor
  } = value;
  // If has modified constructor.
  // eslint-disable-next-line ts/no-unnecessary-condition
  if (constructor === undefined) {
    return true;
  }
  const prototype = constructor.prototype;
  // If has modified prototype.
  if (prototype === null || typeof prototype !== "object" || !validRecordToStringValues.has(Object.prototype.toString.call(prototype))) {
    return false;
  }
  // If constructor does not have an Object-specific method.
  // eslint-disable-next-line sonar/prefer-single-boolean-return, no-prototype-builtins
  if (!prototype.hasOwnProperty("isPrototypeOf")) {
    return false;
  }
  // Most likely a record.
  return true;
}

/**
 * The default strategy to merge records.
 *
 * @param values - The records.
 */
function mergeRecords$1(values, utils, meta) {
  const result = {};
  for (const key of getKeys(values)) {
    const propValues = [];
    for (const value of values) {
      if (objectHasProperty(value, key)) {
        propValues.push(value[key]);
      }
    }
    if (propValues.length === 0) {
      continue;
    }
    const updatedMeta = utils.metaDataUpdater(meta, {
      key,
      parents: values
    });
    const propertyResult = mergeUnknowns(propValues, utils, updatedMeta);
    if (propertyResult === actions.skip) {
      continue;
    }
    if (key === "__proto__") {
      Object.defineProperty(result, key, {
        value: propertyResult,
        configurable: true,
        enumerable: true,
        writable: true
      });
    } else {
      result[key] = propertyResult;
    }
  }
  return result;
}
/**
 * The default strategy to merge arrays.
 *
 * @param values - The arrays.
 */
function mergeArrays$1(values) {
  return values.flat();
}
/**
 * The default strategy to merge sets.
 *
 * @param values - The sets.
 */
function mergeSets$1(values) {
  return new Set(getIterableOfIterables(values));
}
/**
 * The default strategy to merge maps.
 *
 * @param values - The maps.
 */
function mergeMaps$1(values) {
  return new Map(getIterableOfIterables(values));
}
/**
 * Get the last non-undefined value in the given array.
 */
function mergeOthers$1(values) {
  return values.at(-1);
}
/**
 * The merge functions.
 */
const mergeFunctions = {
  mergeRecords: mergeRecords$1,
  mergeArrays: mergeArrays$1,
  mergeSets: mergeSets$1,
  mergeMaps: mergeMaps$1,
  mergeOthers: mergeOthers$1
};

/**
 * Deeply merge objects.
 *
 * @param objects - The objects to merge.
 */
function deepmerge(...objects) {
  return deepmergeCustom({})(...objects);
}
function deepmergeCustom(options, rootMetaData) {
  const utils = getUtils(options, customizedDeepmerge);
  /**
   * The customized deepmerge function.
   */
  function customizedDeepmerge(...objects) {
    return mergeUnknowns(objects, utils, rootMetaData);
  }
  return customizedDeepmerge;
}
/**
 * The the utils that are available to the merge functions.
 *
 * @param options - The options the user specified
 */
function getUtils(options, customizedDeepmerge) {
  var _options$metaDataUpda, _options$enableImplic, _options$filterValues;
  return {
    defaultMergeFunctions: mergeFunctions,
    mergeFunctions: _extends({}, mergeFunctions, Object.fromEntries(Object.entries(options).filter(([key, option]) => Object.hasOwn(mergeFunctions, key)).map(([key, option]) => option === false ? [key, mergeFunctions.mergeOthers] : [key, option]))),
    metaDataUpdater: (_options$metaDataUpda = options.metaDataUpdater) != null ? _options$metaDataUpda : defaultMetaDataUpdater,
    deepmerge: customizedDeepmerge,
    useImplicitDefaultMerging: (_options$enableImplic = options.enableImplicitDefaultMerging) != null ? _options$enableImplic : false,
    filterValues: options.filterValues === false ? undefined : (_options$filterValues = options.filterValues) != null ? _options$filterValues : defaultFilterValues,
    actions
  };
}
/**
 * Merge unknown things.
 *
 * @param values - The values.
 */
function mergeUnknowns(values, utils, meta) {
  var _utils$filterValues;
  const filteredValues = (_utils$filterValues = utils.filterValues == null ? void 0 : utils.filterValues(values, meta)) != null ? _utils$filterValues : values;
  if (filteredValues.length === 0) {
    return undefined;
  }
  if (filteredValues.length === 1) {
    return mergeOthers(filteredValues, utils, meta);
  }
  const type = getObjectType(filteredValues[0]);
  if (type !== 0 /* ObjectType.NOT */ && type !== 5 /* ObjectType.OTHER */) {
    for (let m_index = 1; m_index < filteredValues.length; m_index++) {
      if (getObjectType(filteredValues[m_index]) === type) {
        continue;
      }
      return mergeOthers(filteredValues, utils, meta);
    }
  }
  switch (type) {
    case 1 /* ObjectType.RECORD */:
      {
        return mergeRecords(filteredValues, utils, meta);
      }
    case 2 /* ObjectType.ARRAY */:
      {
        return mergeArrays(filteredValues, utils, meta);
      }
    case 3 /* ObjectType.SET */:
      {
        return mergeSets(filteredValues, utils, meta);
      }
    case 4 /* ObjectType.MAP */:
      {
        return mergeMaps(filteredValues, utils, meta);
      }
    default:
      {
        return mergeOthers(filteredValues, utils, meta);
      }
  }
}
/**
 * Merge records.
 *
 * @param values - The records.
 */
function mergeRecords(values, utils, meta) {
  const result = utils.mergeFunctions.mergeRecords(values, utils, meta);
  if (result === actions.defaultMerge || utils.useImplicitDefaultMerging && result === undefined && utils.mergeFunctions.mergeRecords !== utils.defaultMergeFunctions.mergeRecords) {
    return utils.defaultMergeFunctions.mergeRecords(values, utils, meta);
  }
  return result;
}
/**
 * Merge arrays.
 *
 * @param values - The arrays.
 */
function mergeArrays(values, utils, meta) {
  const result = utils.mergeFunctions.mergeArrays(values, utils, meta);
  if (result === actions.defaultMerge || utils.useImplicitDefaultMerging && result === undefined && utils.mergeFunctions.mergeArrays !== utils.defaultMergeFunctions.mergeArrays) {
    return utils.defaultMergeFunctions.mergeArrays(values);
  }
  return result;
}
/**
 * Merge sets.
 *
 * @param values - The sets.
 */
function mergeSets(values, utils, meta) {
  const result = utils.mergeFunctions.mergeSets(values, utils, meta);
  if (result === actions.defaultMerge || utils.useImplicitDefaultMerging && result === undefined && utils.mergeFunctions.mergeSets !== utils.defaultMergeFunctions.mergeSets) {
    return utils.defaultMergeFunctions.mergeSets(values);
  }
  return result;
}
/**
 * Merge maps.
 *
 * @param values - The maps.
 */
function mergeMaps(values, utils, meta) {
  const result = utils.mergeFunctions.mergeMaps(values, utils, meta);
  if (result === actions.defaultMerge || utils.useImplicitDefaultMerging && result === undefined && utils.mergeFunctions.mergeMaps !== utils.defaultMergeFunctions.mergeMaps) {
    return utils.defaultMergeFunctions.mergeMaps(values);
  }
  return result;
}
/**
 * Merge other things.
 *
 * @param values - The other things.
 */
function mergeOthers(values, utils, meta) {
  const result = utils.mergeFunctions.mergeOthers(values, utils, meta);
  if (result === actions.defaultMerge || utils.useImplicitDefaultMerging && result === undefined && utils.mergeFunctions.mergeOthers !== utils.defaultMergeFunctions.mergeOthers) {
    return utils.defaultMergeFunctions.mergeOthers(values);
  }
  return result;
}

/**
 * Binds all the methods on a JS Class to the `this` context of the class.
 * Adapted from https://github.com/sindresorhus/auto-bind
 * @param self The `this` context of the class
 * @return The `this` context of the class
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function autoBind(self) {
  const keys = Object.getOwnPropertyNames(self.constructor.prototype);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const val = self[key];
    if (key !== 'constructor' && typeof val === 'function') {
      self[key] = val.bind(self);
    }
  }
  return self;
}

/**
 * Sets up the handler to determine if we should advance the tour
 * @param step The step instance
 * @param selector
 * @private
 */
function _setupAdvanceOnHandler(step, selector) {
  return event => {
    if (step.isOpen()) {
      const targetIsEl = step.el && event.currentTarget === step.el;
      const targetIsSelector = !isUndefined(selector) && event.currentTarget.matches(selector);
      if (targetIsSelector || targetIsEl) {
        step.tour.next();
      }
    }
  };
}

/**
 * Bind the event handler for advanceOn
 * @param step The step instance
 */
function bindAdvance(step) {
  // An empty selector matches the step element
  const {
    event,
    selector
  } = step.options.advanceOn || {};
  if (event) {
    const handler = _setupAdvanceOnHandler(step, selector);

    // TODO: this should also bind/unbind on show/hide
    let el = null;
    if (!isUndefined(selector)) {
      el = document.querySelector(selector);
      if (!el) {
        return console.error(`No element was found for the selector supplied to advanceOn: ${selector}`);
      }
    }
    if (el) {
      el.addEventListener(event, handler);
      step.on('destroy', () => {
        return el.removeEventListener(event, handler);
      });
    } else {
      document.body.addEventListener(event, handler, true);
      step.on('destroy', () => {
        return document.body.removeEventListener(event, handler, true);
      });
    }
  } else {
    return console.error('advanceOn was defined, but no event name was passed.');
  }
}

class StepNoOp {
  constructor(_options) {}
}
class TourNoOp {
  constructor(_tour, _options) {}
}

/**
 * Ensure class prefix ends in `-`
 * @param prefix - The prefix to prepend to the class names generated by nano-css
 * @return The prefix ending in `-`
 */
function normalizePrefix(prefix) {
  if (!isString(prefix) || prefix === '') {
    return '';
  }
  return prefix.charAt(prefix.length - 1) !== '-' ? `${prefix}-` : prefix;
}

/**
 * Resolves attachTo options, converting element option value to a qualified HTMLElement.
 * @param step - The step instance
 * @returns {{}|{element, on}}
 * `element` is a qualified HTML Element
 * `on` is a string position value
 */
function parseAttachTo(step) {
  const options = step.options.attachTo || {};
  const returnOpts = Object.assign({}, options);
  if (isFunction(returnOpts.element)) {
    // Bind the callback to step so that it has access to the object, to enable running additional logic
    returnOpts.element = returnOpts.element.call(step);
  }
  if (isString(returnOpts.element)) {
    // Can't override the element in user opts reference because we can't
    // guarantee that the element will exist in the future.
    try {
      returnOpts.element = document.querySelector(returnOpts.element);
    } catch (e) {
      // TODO
    }
    if (!returnOpts.element) {
      console.error(`The element for this Shepherd step was not found ${options.element}`);
    }
  }
  return returnOpts;
}

/*
 * Resolves the step's `extraHighlights` option, converting any locator values to HTMLElements.
 */
function parseExtraHighlights(step) {
  if (step.options.extraHighlights) {
    return step.options.extraHighlights.flatMap(highlight => {
      return Array.from(document.querySelectorAll(highlight));
    });
  }
  return [];
}

/**
 * Checks if the step should be centered or not. Does not trigger attachTo.element evaluation, making it a pure
 * alternative for the deprecated step.isCentered() method.
 */
function shouldCenterStep(resolvedAttachToOptions) {
  if (resolvedAttachToOptions === undefined || resolvedAttachToOptions === null) {
    return true;
  }
  return !resolvedAttachToOptions.element || !resolvedAttachToOptions.on;
}

/**
 * Create a unique id for steps, tours, modals, etc
 */
function uuid() {
  let d = Date.now();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c == 'x' ? r : r & 0x3 | 0x8).toString(16);
  });
}

/**
 * Custom positioning reference element.
 * @see https://floating-ui.com/docs/virtual-elements
 */

const sides = ['top', 'right', 'bottom', 'left'];
const alignments = ['start', 'end'];
const placements = /*#__PURE__*/sides.reduce((acc, side) => acc.concat(side, side + "-" + alignments[0], side + "-" + alignments[1]), []);
const min = Math.min;
const max = Math.max;
const round = Math.round;
const floor = Math.floor;
const createCoords = v => ({
  x: v,
  y: v
});
const oppositeSideMap = {
  left: 'right',
  right: 'left',
  bottom: 'top',
  top: 'bottom'
};
const oppositeAlignmentMap = {
  start: 'end',
  end: 'start'
};
function clamp(start, value, end) {
  return max(start, min(value, end));
}
function evaluate(value, param) {
  return typeof value === 'function' ? value(param) : value;
}
function getSide(placement) {
  return placement.split('-')[0];
}
function getAlignment(placement) {
  return placement.split('-')[1];
}
function getOppositeAxis(axis) {
  return axis === 'x' ? 'y' : 'x';
}
function getAxisLength(axis) {
  return axis === 'y' ? 'height' : 'width';
}
function getSideAxis(placement) {
  return ['top', 'bottom'].includes(getSide(placement)) ? 'y' : 'x';
}
function getAlignmentAxis(placement) {
  return getOppositeAxis(getSideAxis(placement));
}
function getAlignmentSides(placement, rects, rtl) {
  if (rtl === void 0) {
    rtl = false;
  }
  const alignment = getAlignment(placement);
  const alignmentAxis = getAlignmentAxis(placement);
  const length = getAxisLength(alignmentAxis);
  let mainAlignmentSide = alignmentAxis === 'x' ? alignment === (rtl ? 'end' : 'start') ? 'right' : 'left' : alignment === 'start' ? 'bottom' : 'top';
  if (rects.reference[length] > rects.floating[length]) {
    mainAlignmentSide = getOppositePlacement(mainAlignmentSide);
  }
  return [mainAlignmentSide, getOppositePlacement(mainAlignmentSide)];
}
function getExpandedPlacements(placement) {
  const oppositePlacement = getOppositePlacement(placement);
  return [getOppositeAlignmentPlacement(placement), oppositePlacement, getOppositeAlignmentPlacement(oppositePlacement)];
}
function getOppositeAlignmentPlacement(placement) {
  return placement.replace(/start|end/g, alignment => oppositeAlignmentMap[alignment]);
}
function getSideList(side, isStart, rtl) {
  const lr = ['left', 'right'];
  const rl = ['right', 'left'];
  const tb = ['top', 'bottom'];
  const bt = ['bottom', 'top'];
  switch (side) {
    case 'top':
    case 'bottom':
      if (rtl) return isStart ? rl : lr;
      return isStart ? lr : rl;
    case 'left':
    case 'right':
      return isStart ? tb : bt;
    default:
      return [];
  }
}
function getOppositeAxisPlacements(placement, flipAlignment, direction, rtl) {
  const alignment = getAlignment(placement);
  let list = getSideList(getSide(placement), direction === 'start', rtl);
  if (alignment) {
    list = list.map(side => side + "-" + alignment);
    if (flipAlignment) {
      list = list.concat(list.map(getOppositeAlignmentPlacement));
    }
  }
  return list;
}
function getOppositePlacement(placement) {
  return placement.replace(/left|right|bottom|top/g, side => oppositeSideMap[side]);
}
function expandPaddingObject(padding) {
  return _extends({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  }, padding);
}
function getPaddingObject(padding) {
  return typeof padding !== 'number' ? expandPaddingObject(padding) : {
    top: padding,
    right: padding,
    bottom: padding,
    left: padding
  };
}
function rectToClientRect(rect) {
  const {
    x,
    y,
    width,
    height
  } = rect;
  return {
    width,
    height,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
    x,
    y
  };
}

const _excluded = ["crossAxis", "alignment", "allowedPlacements", "autoAlignment"],
  _excluded2 = ["mainAxis", "crossAxis", "fallbackPlacements", "fallbackStrategy", "fallbackAxisSideDirection", "flipAlignment"],
  _excluded4 = ["mainAxis", "crossAxis", "limiter"];
function computeCoordsFromPlacement(_ref, placement, rtl) {
  let {
    reference,
    floating
  } = _ref;
  const sideAxis = getSideAxis(placement);
  const alignmentAxis = getAlignmentAxis(placement);
  const alignLength = getAxisLength(alignmentAxis);
  const side = getSide(placement);
  const isVertical = sideAxis === 'y';
  const commonX = reference.x + reference.width / 2 - floating.width / 2;
  const commonY = reference.y + reference.height / 2 - floating.height / 2;
  const commonAlign = reference[alignLength] / 2 - floating[alignLength] / 2;
  let coords;
  switch (side) {
    case 'top':
      coords = {
        x: commonX,
        y: reference.y - floating.height
      };
      break;
    case 'bottom':
      coords = {
        x: commonX,
        y: reference.y + reference.height
      };
      break;
    case 'right':
      coords = {
        x: reference.x + reference.width,
        y: commonY
      };
      break;
    case 'left':
      coords = {
        x: reference.x - floating.width,
        y: commonY
      };
      break;
    default:
      coords = {
        x: reference.x,
        y: reference.y
      };
  }
  switch (getAlignment(placement)) {
    case 'start':
      coords[alignmentAxis] -= commonAlign * (rtl && isVertical ? -1 : 1);
      break;
    case 'end':
      coords[alignmentAxis] += commonAlign * (rtl && isVertical ? -1 : 1);
      break;
  }
  return coords;
}

/**
 * Computes the `x` and `y` coordinates that will place the floating element
 * next to a given reference element.
 *
 * This export does not have any `platform` interface logic. You will need to
 * write one for the platform you are using Floating UI with.
 */
const computePosition$1 = async (reference, floating, config) => {
  const {
    placement = 'bottom',
    strategy = 'absolute',
    middleware = [],
    platform
  } = config;
  const validMiddleware = middleware.filter(Boolean);
  const rtl = await (platform.isRTL == null ? void 0 : platform.isRTL(floating));
  let rects = await platform.getElementRects({
    reference,
    floating,
    strategy
  });
  let {
    x,
    y
  } = computeCoordsFromPlacement(rects, placement, rtl);
  let statefulPlacement = placement;
  let middlewareData = {};
  let resetCount = 0;
  for (let i = 0; i < validMiddleware.length; i++) {
    const {
      name,
      fn
    } = validMiddleware[i];
    const {
      x: nextX,
      y: nextY,
      data,
      reset
    } = await fn({
      x,
      y,
      initialPlacement: placement,
      placement: statefulPlacement,
      strategy,
      middlewareData,
      rects,
      platform,
      elements: {
        reference,
        floating
      }
    });
    x = nextX != null ? nextX : x;
    y = nextY != null ? nextY : y;
    middlewareData = _extends({}, middlewareData, {
      [name]: _extends({}, middlewareData[name], data)
    });
    if (reset && resetCount <= 50) {
      resetCount++;
      if (typeof reset === 'object') {
        if (reset.placement) {
          statefulPlacement = reset.placement;
        }
        if (reset.rects) {
          rects = reset.rects === true ? await platform.getElementRects({
            reference,
            floating,
            strategy
          }) : reset.rects;
        }
        ({
          x,
          y
        } = computeCoordsFromPlacement(rects, statefulPlacement, rtl));
      }
      i = -1;
    }
  }
  return {
    x,
    y,
    placement: statefulPlacement,
    strategy,
    middlewareData
  };
};

/**
 * Resolves with an object of overflow side offsets that determine how much the
 * element is overflowing a given clipping boundary on each side.
 * - positive = overflowing the boundary by that number of pixels
 * - negative = how many pixels left before it will overflow
 * - 0 = lies flush with the boundary
 * @see https://floating-ui.com/docs/detectOverflow
 */
async function detectOverflow(state, options) {
  var _await$platform$isEle;
  if (options === void 0) {
    options = {};
  }
  const {
    x,
    y,
    platform,
    rects,
    elements,
    strategy
  } = state;
  const {
    boundary = 'clippingAncestors',
    rootBoundary = 'viewport',
    elementContext = 'floating',
    altBoundary = false,
    padding = 0
  } = evaluate(options, state);
  const paddingObject = getPaddingObject(padding);
  const altContext = elementContext === 'floating' ? 'reference' : 'floating';
  const element = elements[altBoundary ? altContext : elementContext];
  const clippingClientRect = rectToClientRect(await platform.getClippingRect({
    element: ((_await$platform$isEle = await (platform.isElement == null ? void 0 : platform.isElement(element))) != null ? _await$platform$isEle : true) ? element : element.contextElement || (await (platform.getDocumentElement == null ? void 0 : platform.getDocumentElement(elements.floating))),
    boundary,
    rootBoundary,
    strategy
  }));
  const rect = elementContext === 'floating' ? {
    x,
    y,
    width: rects.floating.width,
    height: rects.floating.height
  } : rects.reference;
  const offsetParent = await (platform.getOffsetParent == null ? void 0 : platform.getOffsetParent(elements.floating));
  const offsetScale = (await (platform.isElement == null ? void 0 : platform.isElement(offsetParent))) ? (await (platform.getScale == null ? void 0 : platform.getScale(offsetParent))) || {
    x: 1,
    y: 1
  } : {
    x: 1,
    y: 1
  };
  const elementClientRect = rectToClientRect(platform.convertOffsetParentRelativeRectToViewportRelativeRect ? await platform.convertOffsetParentRelativeRectToViewportRelativeRect({
    elements,
    rect,
    offsetParent,
    strategy
  }) : rect);
  return {
    top: (clippingClientRect.top - elementClientRect.top + paddingObject.top) / offsetScale.y,
    bottom: (elementClientRect.bottom - clippingClientRect.bottom + paddingObject.bottom) / offsetScale.y,
    left: (clippingClientRect.left - elementClientRect.left + paddingObject.left) / offsetScale.x,
    right: (elementClientRect.right - clippingClientRect.right + paddingObject.right) / offsetScale.x
  };
}

/**
 * Provides data to position an inner element of the floating element so that it
 * appears centered to the reference element.
 * @see https://floating-ui.com/docs/arrow
 */
const arrow$1 = options => ({
  name: 'arrow',
  options,
  async fn(state) {
    const {
      x,
      y,
      placement,
      rects,
      platform,
      elements,
      middlewareData
    } = state;
    // Since `element` is required, we don't Partial<> the type.
    const {
      element,
      padding = 0
    } = evaluate(options, state) || {};
    if (element == null) {
      return {};
    }
    const paddingObject = getPaddingObject(padding);
    const coords = {
      x,
      y
    };
    const axis = getAlignmentAxis(placement);
    const length = getAxisLength(axis);
    const arrowDimensions = await platform.getDimensions(element);
    const isYAxis = axis === 'y';
    const minProp = isYAxis ? 'top' : 'left';
    const maxProp = isYAxis ? 'bottom' : 'right';
    const clientProp = isYAxis ? 'clientHeight' : 'clientWidth';
    const endDiff = rects.reference[length] + rects.reference[axis] - coords[axis] - rects.floating[length];
    const startDiff = coords[axis] - rects.reference[axis];
    const arrowOffsetParent = await (platform.getOffsetParent == null ? void 0 : platform.getOffsetParent(element));
    let clientSize = arrowOffsetParent ? arrowOffsetParent[clientProp] : 0;

    // DOM platform can return `window` as the `offsetParent`.
    if (!clientSize || !(await (platform.isElement == null ? void 0 : platform.isElement(arrowOffsetParent)))) {
      clientSize = elements.floating[clientProp] || rects.floating[length];
    }
    const centerToReference = endDiff / 2 - startDiff / 2;

    // If the padding is large enough that it causes the arrow to no longer be
    // centered, modify the padding so that it is centered.
    const largestPossiblePadding = clientSize / 2 - arrowDimensions[length] / 2 - 1;
    const minPadding = min(paddingObject[minProp], largestPossiblePadding);
    const maxPadding = min(paddingObject[maxProp], largestPossiblePadding);

    // Make sure the arrow doesn't overflow the floating element if the center
    // point is outside the floating element's bounds.
    const min$1 = minPadding;
    const max = clientSize - arrowDimensions[length] - maxPadding;
    const center = clientSize / 2 - arrowDimensions[length] / 2 + centerToReference;
    const offset = clamp(min$1, center, max);

    // If the reference is small enough that the arrow's padding causes it to
    // to point to nothing for an aligned placement, adjust the offset of the
    // floating element itself. To ensure `shift()` continues to take action,
    // a single reset is performed when this is true.
    const shouldAddOffset = !middlewareData.arrow && getAlignment(placement) != null && center !== offset && rects.reference[length] / 2 - (center < min$1 ? minPadding : maxPadding) - arrowDimensions[length] / 2 < 0;
    const alignmentOffset = shouldAddOffset ? center < min$1 ? center - min$1 : center - max : 0;
    return {
      [axis]: coords[axis] + alignmentOffset,
      data: _extends({
        [axis]: offset,
        centerOffset: center - offset - alignmentOffset
      }, shouldAddOffset && {
        alignmentOffset
      }),
      reset: shouldAddOffset
    };
  }
});
function getPlacementList(alignment, autoAlignment, allowedPlacements) {
  const allowedPlacementsSortedByAlignment = alignment ? [...allowedPlacements.filter(placement => getAlignment(placement) === alignment), ...allowedPlacements.filter(placement => getAlignment(placement) !== alignment)] : allowedPlacements.filter(placement => getSide(placement) === placement);
  return allowedPlacementsSortedByAlignment.filter(placement => {
    if (alignment) {
      return getAlignment(placement) === alignment || (autoAlignment ? getOppositeAlignmentPlacement(placement) !== placement : false);
    }
    return true;
  });
}
/**
 * Optimizes the visibility of the floating element by choosing the placement
 * that has the most space available automatically, without needing to specify a
 * preferred placement. Alternative to `flip`.
 * @see https://floating-ui.com/docs/autoPlacement
 */
const autoPlacement$1 = function autoPlacement(options) {
  if (options === void 0) {
    options = {};
  }
  return {
    name: 'autoPlacement',
    options,
    async fn(state) {
      var _middlewareData$autoP, _middlewareData$autoP2, _placementsThatFitOnE;
      const {
        rects,
        middlewareData,
        placement,
        platform,
        elements
      } = state;
      const _evaluate = evaluate(options, state),
        {
          crossAxis = false,
          alignment,
          allowedPlacements = placements,
          autoAlignment = true
        } = _evaluate,
        detectOverflowOptions = _objectWithoutPropertiesLoose(_evaluate, _excluded);
      const placements$1 = alignment !== undefined || allowedPlacements === placements ? getPlacementList(alignment || null, autoAlignment, allowedPlacements) : allowedPlacements;
      const overflow = await detectOverflow(state, detectOverflowOptions);
      const currentIndex = ((_middlewareData$autoP = middlewareData.autoPlacement) == null ? void 0 : _middlewareData$autoP.index) || 0;
      const currentPlacement = placements$1[currentIndex];
      if (currentPlacement == null) {
        return {};
      }
      const alignmentSides = getAlignmentSides(currentPlacement, rects, await (platform.isRTL == null ? void 0 : platform.isRTL(elements.floating)));

      // Make `computeCoords` start from the right place.
      if (placement !== currentPlacement) {
        return {
          reset: {
            placement: placements$1[0]
          }
        };
      }
      const currentOverflows = [overflow[getSide(currentPlacement)], overflow[alignmentSides[0]], overflow[alignmentSides[1]]];
      const allOverflows = [...(((_middlewareData$autoP2 = middlewareData.autoPlacement) == null ? void 0 : _middlewareData$autoP2.overflows) || []), {
        placement: currentPlacement,
        overflows: currentOverflows
      }];
      const nextPlacement = placements$1[currentIndex + 1];

      // There are more placements to check.
      if (nextPlacement) {
        return {
          data: {
            index: currentIndex + 1,
            overflows: allOverflows
          },
          reset: {
            placement: nextPlacement
          }
        };
      }
      const placementsSortedByMostSpace = allOverflows.map(d => {
        const alignment = getAlignment(d.placement);
        return [d.placement, alignment && crossAxis ?
        // Check along the mainAxis and main crossAxis side.
        d.overflows.slice(0, 2).reduce((acc, v) => acc + v, 0) :
        // Check only the mainAxis.
        d.overflows[0], d.overflows];
      }).sort((a, b) => a[1] - b[1]);
      const placementsThatFitOnEachSide = placementsSortedByMostSpace.filter(d => d[2].slice(0,
      // Aligned placements should not check their opposite crossAxis
      // side.
      getAlignment(d[0]) ? 2 : 3).every(v => v <= 0));
      const resetPlacement = ((_placementsThatFitOnE = placementsThatFitOnEachSide[0]) == null ? void 0 : _placementsThatFitOnE[0]) || placementsSortedByMostSpace[0][0];
      if (resetPlacement !== placement) {
        return {
          data: {
            index: currentIndex + 1,
            overflows: allOverflows
          },
          reset: {
            placement: resetPlacement
          }
        };
      }
      return {};
    }
  };
};

/**
 * Optimizes the visibility of the floating element by flipping the `placement`
 * in order to keep it in view when the preferred placement(s) will overflow the
 * clipping boundary. Alternative to `autoPlacement`.
 * @see https://floating-ui.com/docs/flip
 */
const flip$1 = function flip(options) {
  if (options === void 0) {
    options = {};
  }
  return {
    name: 'flip',
    options,
    async fn(state) {
      var _middlewareData$arrow, _middlewareData$flip;
      const {
        placement,
        middlewareData,
        rects,
        initialPlacement,
        platform,
        elements
      } = state;
      const _evaluate2 = evaluate(options, state),
        {
          mainAxis: checkMainAxis = true,
          crossAxis: checkCrossAxis = true,
          fallbackPlacements: specifiedFallbackPlacements,
          fallbackStrategy = 'bestFit',
          fallbackAxisSideDirection = 'none',
          flipAlignment = true
        } = _evaluate2,
        detectOverflowOptions = _objectWithoutPropertiesLoose(_evaluate2, _excluded2);

      // If a reset by the arrow was caused due to an alignment offset being
      // added, we should skip any logic now since `flip()` has already done its
      // work.
      // https://github.com/floating-ui/floating-ui/issues/2549#issuecomment-1719601643
      if ((_middlewareData$arrow = middlewareData.arrow) != null && _middlewareData$arrow.alignmentOffset) {
        return {};
      }
      const side = getSide(placement);
      const initialSideAxis = getSideAxis(initialPlacement);
      const isBasePlacement = getSide(initialPlacement) === initialPlacement;
      const rtl = await (platform.isRTL == null ? void 0 : platform.isRTL(elements.floating));
      const fallbackPlacements = specifiedFallbackPlacements || (isBasePlacement || !flipAlignment ? [getOppositePlacement(initialPlacement)] : getExpandedPlacements(initialPlacement));
      const hasFallbackAxisSideDirection = fallbackAxisSideDirection !== 'none';
      if (!specifiedFallbackPlacements && hasFallbackAxisSideDirection) {
        fallbackPlacements.push(...getOppositeAxisPlacements(initialPlacement, flipAlignment, fallbackAxisSideDirection, rtl));
      }
      const placements = [initialPlacement, ...fallbackPlacements];
      const overflow = await detectOverflow(state, detectOverflowOptions);
      const overflows = [];
      let overflowsData = ((_middlewareData$flip = middlewareData.flip) == null ? void 0 : _middlewareData$flip.overflows) || [];
      if (checkMainAxis) {
        overflows.push(overflow[side]);
      }
      if (checkCrossAxis) {
        const sides = getAlignmentSides(placement, rects, rtl);
        overflows.push(overflow[sides[0]], overflow[sides[1]]);
      }
      overflowsData = [...overflowsData, {
        placement,
        overflows
      }];

      // One or more sides is overflowing.
      if (!overflows.every(side => side <= 0)) {
        var _middlewareData$flip2, _overflowsData$filter;
        const nextIndex = (((_middlewareData$flip2 = middlewareData.flip) == null ? void 0 : _middlewareData$flip2.index) || 0) + 1;
        const nextPlacement = placements[nextIndex];
        if (nextPlacement) {
          var _overflowsData$;
          const ignoreCrossAxisOverflow = checkCrossAxis === 'alignment' ? initialSideAxis !== getSideAxis(nextPlacement) : false;
          const hasInitialMainAxisOverflow = ((_overflowsData$ = overflowsData[0]) == null ? void 0 : _overflowsData$.overflows[0]) > 0;
          if (!ignoreCrossAxisOverflow || hasInitialMainAxisOverflow) {
            // Try next placement and re-run the lifecycle.
            return {
              data: {
                index: nextIndex,
                overflows: overflowsData
              },
              reset: {
                placement: nextPlacement
              }
            };
          }
        }

        // First, find the candidates that fit on the mainAxis side of overflow,
        // then find the placement that fits the best on the main crossAxis side.
        let resetPlacement = (_overflowsData$filter = overflowsData.filter(d => d.overflows[0] <= 0).sort((a, b) => a.overflows[1] - b.overflows[1])[0]) == null ? void 0 : _overflowsData$filter.placement;

        // Otherwise fallback.
        if (!resetPlacement) {
          switch (fallbackStrategy) {
            case 'bestFit':
              {
                var _overflowsData$filter2;
                const placement = (_overflowsData$filter2 = overflowsData.filter(d => {
                  if (hasFallbackAxisSideDirection) {
                    const currentSideAxis = getSideAxis(d.placement);
                    return currentSideAxis === initialSideAxis ||
                    // Create a bias to the `y` side axis due to horizontal
                    // reading directions favoring greater width.
                    currentSideAxis === 'y';
                  }
                  return true;
                }).map(d => [d.placement, d.overflows.filter(overflow => overflow > 0).reduce((acc, overflow) => acc + overflow, 0)]).sort((a, b) => a[1] - b[1])[0]) == null ? void 0 : _overflowsData$filter2[0];
                if (placement) {
                  resetPlacement = placement;
                }
                break;
              }
            case 'initialPlacement':
              resetPlacement = initialPlacement;
              break;
          }
        }
        if (placement !== resetPlacement) {
          return {
            reset: {
              placement: resetPlacement
            }
          };
        }
      }
      return {};
    }
  };
};

/**
 * Optimizes the visibility of the floating element by shifting it in order to
 * keep it in view when it will overflow the clipping boundary.
 * @see https://floating-ui.com/docs/shift
 */
const shift$1 = function shift(options) {
  if (options === void 0) {
    options = {};
  }
  return {
    name: 'shift',
    options,
    async fn(state) {
      const {
        x,
        y,
        placement
      } = state;
      const _evaluate4 = evaluate(options, state),
        {
          mainAxis: checkMainAxis = true,
          crossAxis: checkCrossAxis = false,
          limiter = {
            fn: _ref => {
              let {
                x,
                y
              } = _ref;
              return {
                x,
                y
              };
            }
          }
        } = _evaluate4,
        detectOverflowOptions = _objectWithoutPropertiesLoose(_evaluate4, _excluded4);
      const coords = {
        x,
        y
      };
      const overflow = await detectOverflow(state, detectOverflowOptions);
      const crossAxis = getSideAxis(getSide(placement));
      const mainAxis = getOppositeAxis(crossAxis);
      let mainAxisCoord = coords[mainAxis];
      let crossAxisCoord = coords[crossAxis];
      if (checkMainAxis) {
        const minSide = mainAxis === 'y' ? 'top' : 'left';
        const maxSide = mainAxis === 'y' ? 'bottom' : 'right';
        const min = mainAxisCoord + overflow[minSide];
        const max = mainAxisCoord - overflow[maxSide];
        mainAxisCoord = clamp(min, mainAxisCoord, max);
      }
      if (checkCrossAxis) {
        const minSide = crossAxis === 'y' ? 'top' : 'left';
        const maxSide = crossAxis === 'y' ? 'bottom' : 'right';
        const min = crossAxisCoord + overflow[minSide];
        const max = crossAxisCoord - overflow[maxSide];
        crossAxisCoord = clamp(min, crossAxisCoord, max);
      }
      const limitedCoords = limiter.fn(_extends({}, state, {
        [mainAxis]: mainAxisCoord,
        [crossAxis]: crossAxisCoord
      }));
      return _extends({}, limitedCoords, {
        data: {
          x: limitedCoords.x - x,
          y: limitedCoords.y - y,
          enabled: {
            [mainAxis]: checkMainAxis,
            [crossAxis]: checkCrossAxis
          }
        }
      });
    }
  };
};
/**
 * Built-in `limiter` that will stop `shift()` at a certain point.
 */
const limitShift$1 = function limitShift(options) {
  if (options === void 0) {
    options = {};
  }
  return {
    options,
    fn(state) {
      const {
        x,
        y,
        placement,
        rects,
        middlewareData
      } = state;
      const {
        offset = 0,
        mainAxis: checkMainAxis = true,
        crossAxis: checkCrossAxis = true
      } = evaluate(options, state);
      const coords = {
        x,
        y
      };
      const crossAxis = getSideAxis(placement);
      const mainAxis = getOppositeAxis(crossAxis);
      let mainAxisCoord = coords[mainAxis];
      let crossAxisCoord = coords[crossAxis];
      const rawOffset = evaluate(offset, state);
      const computedOffset = typeof rawOffset === 'number' ? {
        mainAxis: rawOffset,
        crossAxis: 0
      } : _extends({
        mainAxis: 0,
        crossAxis: 0
      }, rawOffset);
      if (checkMainAxis) {
        const len = mainAxis === 'y' ? 'height' : 'width';
        const limitMin = rects.reference[mainAxis] - rects.floating[len] + computedOffset.mainAxis;
        const limitMax = rects.reference[mainAxis] + rects.reference[len] - computedOffset.mainAxis;
        if (mainAxisCoord < limitMin) {
          mainAxisCoord = limitMin;
        } else if (mainAxisCoord > limitMax) {
          mainAxisCoord = limitMax;
        }
      }
      if (checkCrossAxis) {
        var _middlewareData$offse, _middlewareData$offse2;
        const len = mainAxis === 'y' ? 'width' : 'height';
        const isOriginSide = ['top', 'left'].includes(getSide(placement));
        const limitMin = rects.reference[crossAxis] - rects.floating[len] + (isOriginSide ? ((_middlewareData$offse = middlewareData.offset) == null ? void 0 : _middlewareData$offse[crossAxis]) || 0 : 0) + (isOriginSide ? 0 : computedOffset.crossAxis);
        const limitMax = rects.reference[crossAxis] + rects.reference[len] + (isOriginSide ? 0 : ((_middlewareData$offse2 = middlewareData.offset) == null ? void 0 : _middlewareData$offse2[crossAxis]) || 0) - (isOriginSide ? computedOffset.crossAxis : 0);
        if (crossAxisCoord < limitMin) {
          crossAxisCoord = limitMin;
        } else if (crossAxisCoord > limitMax) {
          crossAxisCoord = limitMax;
        }
      }
      return {
        [mainAxis]: mainAxisCoord,
        [crossAxis]: crossAxisCoord
      };
    }
  };
};

function hasWindow() {
  return typeof window !== 'undefined';
}
function getNodeName(node) {
  if (isNode(node)) {
    return (node.nodeName || '').toLowerCase();
  }
  // Mocked nodes in testing environments may not be instances of Node. By
  // returning `#document` an infinite loop won't occur.
  // https://github.com/floating-ui/floating-ui/issues/2317
  return '#document';
}
function getWindow(node) {
  var _node$ownerDocument;
  return (node == null || (_node$ownerDocument = node.ownerDocument) == null ? void 0 : _node$ownerDocument.defaultView) || window;
}
function getDocumentElement(node) {
  var _ref;
  return (_ref = (isNode(node) ? node.ownerDocument : node.document) || window.document) == null ? void 0 : _ref.documentElement;
}
function isNode(value) {
  if (!hasWindow()) {
    return false;
  }
  return value instanceof Node || value instanceof getWindow(value).Node;
}
function isElement(value) {
  if (!hasWindow()) {
    return false;
  }
  return value instanceof Element || value instanceof getWindow(value).Element;
}
function isHTMLElement(value) {
  if (!hasWindow()) {
    return false;
  }
  return value instanceof HTMLElement || value instanceof getWindow(value).HTMLElement;
}
function isShadowRoot(value) {
  if (!hasWindow() || typeof ShadowRoot === 'undefined') {
    return false;
  }
  return value instanceof ShadowRoot || value instanceof getWindow(value).ShadowRoot;
}
function isOverflowElement(element) {
  const {
    overflow,
    overflowX,
    overflowY,
    display
  } = getComputedStyle(element);
  return /auto|scroll|overlay|hidden|clip/.test(overflow + overflowY + overflowX) && !['inline', 'contents'].includes(display);
}
function isTableElement(element) {
  return ['table', 'td', 'th'].includes(getNodeName(element));
}
function isTopLayer(element) {
  return [':popover-open', ':modal'].some(selector => {
    try {
      return element.matches(selector);
    } catch (e) {
      return false;
    }
  });
}
function isContainingBlock(elementOrCss) {
  const webkit = isWebKit();
  const css = isElement(elementOrCss) ? getComputedStyle(elementOrCss) : elementOrCss;

  // https://developer.mozilla.org/en-US/docs/Web/CSS/Containing_block#identifying_the_containing_block
  // https://drafts.csswg.org/css-transforms-2/#individual-transforms
  return ['transform', 'translate', 'scale', 'rotate', 'perspective'].some(value => css[value] ? css[value] !== 'none' : false) || (css.containerType ? css.containerType !== 'normal' : false) || !webkit && (css.backdropFilter ? css.backdropFilter !== 'none' : false) || !webkit && (css.filter ? css.filter !== 'none' : false) || ['transform', 'translate', 'scale', 'rotate', 'perspective', 'filter'].some(value => (css.willChange || '').includes(value)) || ['paint', 'layout', 'strict', 'content'].some(value => (css.contain || '').includes(value));
}
function getContainingBlock(element) {
  let currentNode = getParentNode(element);
  while (isHTMLElement(currentNode) && !isLastTraversableNode(currentNode)) {
    if (isContainingBlock(currentNode)) {
      return currentNode;
    } else if (isTopLayer(currentNode)) {
      return null;
    }
    currentNode = getParentNode(currentNode);
  }
  return null;
}
function isWebKit() {
  if (typeof CSS === 'undefined' || !CSS.supports) return false;
  return CSS.supports('-webkit-backdrop-filter', 'none');
}
function isLastTraversableNode(node) {
  return ['html', 'body', '#document'].includes(getNodeName(node));
}
function getComputedStyle(element) {
  return getWindow(element).getComputedStyle(element);
}
function getNodeScroll(element) {
  if (isElement(element)) {
    return {
      scrollLeft: element.scrollLeft,
      scrollTop: element.scrollTop
    };
  }
  return {
    scrollLeft: element.scrollX,
    scrollTop: element.scrollY
  };
}
function getParentNode(node) {
  if (getNodeName(node) === 'html') {
    return node;
  }
  const result =
  // Step into the shadow DOM of the parent of a slotted node.
  node.assignedSlot ||
  // DOM Element detected.
  node.parentNode ||
  // ShadowRoot detected.
  isShadowRoot(node) && node.host ||
  // Fallback.
  getDocumentElement(node);
  return isShadowRoot(result) ? result.host : result;
}
function getNearestOverflowAncestor(node) {
  const parentNode = getParentNode(node);
  if (isLastTraversableNode(parentNode)) {
    return node.ownerDocument ? node.ownerDocument.body : node.body;
  }
  if (isHTMLElement(parentNode) && isOverflowElement(parentNode)) {
    return parentNode;
  }
  return getNearestOverflowAncestor(parentNode);
}
function getOverflowAncestors(node, list, traverseIframes) {
  var _node$ownerDocument2;
  if (list === void 0) {
    list = [];
  }
  if (traverseIframes === void 0) {
    traverseIframes = true;
  }
  const scrollableAncestor = getNearestOverflowAncestor(node);
  const isBody = scrollableAncestor === ((_node$ownerDocument2 = node.ownerDocument) == null ? void 0 : _node$ownerDocument2.body);
  const win = getWindow(scrollableAncestor);
  if (isBody) {
    const frameElement = getFrameElement(win);
    return list.concat(win, win.visualViewport || [], isOverflowElement(scrollableAncestor) ? scrollableAncestor : [], frameElement && traverseIframes ? getOverflowAncestors(frameElement) : []);
  }
  return list.concat(scrollableAncestor, getOverflowAncestors(scrollableAncestor, [], traverseIframes));
}
function getFrameElement(win) {
  return win.parent && Object.getPrototypeOf(win.parent) ? win.frameElement : null;
}

function getCssDimensions(element) {
  const css = getComputedStyle(element);
  // In testing environments, the `width` and `height` properties are empty
  // strings for SVG elements, returning NaN. Fallback to `0` in this case.
  let width = parseFloat(css.width) || 0;
  let height = parseFloat(css.height) || 0;
  const hasOffset = isHTMLElement(element);
  const offsetWidth = hasOffset ? element.offsetWidth : width;
  const offsetHeight = hasOffset ? element.offsetHeight : height;
  const shouldFallback = round(width) !== offsetWidth || round(height) !== offsetHeight;
  if (shouldFallback) {
    width = offsetWidth;
    height = offsetHeight;
  }
  return {
    width,
    height,
    $: shouldFallback
  };
}
function unwrapElement(element) {
  return !isElement(element) ? element.contextElement : element;
}
function getScale(element) {
  const domElement = unwrapElement(element);
  if (!isHTMLElement(domElement)) {
    return createCoords(1);
  }
  const rect = domElement.getBoundingClientRect();
  const {
    width,
    height,
    $
  } = getCssDimensions(domElement);
  let x = ($ ? round(rect.width) : rect.width) / width;
  let y = ($ ? round(rect.height) : rect.height) / height;

  // 0, NaN, or Infinity should always fallback to 1.

  if (!x || !Number.isFinite(x)) {
    x = 1;
  }
  if (!y || !Number.isFinite(y)) {
    y = 1;
  }
  return {
    x,
    y
  };
}
const noOffsets = /*#__PURE__*/createCoords(0);
function getVisualOffsets(element) {
  const win = getWindow(element);
  if (!isWebKit() || !win.visualViewport) {
    return noOffsets;
  }
  return {
    x: win.visualViewport.offsetLeft,
    y: win.visualViewport.offsetTop
  };
}
function shouldAddVisualOffsets(element, isFixed, floatingOffsetParent) {
  if (isFixed === void 0) {
    isFixed = false;
  }
  if (!floatingOffsetParent || isFixed && floatingOffsetParent !== getWindow(element)) {
    return false;
  }
  return isFixed;
}
function getBoundingClientRect(element, includeScale, isFixedStrategy, offsetParent) {
  if (includeScale === void 0) {
    includeScale = false;
  }
  if (isFixedStrategy === void 0) {
    isFixedStrategy = false;
  }
  const clientRect = element.getBoundingClientRect();
  const domElement = unwrapElement(element);
  let scale = createCoords(1);
  if (includeScale) {
    if (offsetParent) {
      if (isElement(offsetParent)) {
        scale = getScale(offsetParent);
      }
    } else {
      scale = getScale(element);
    }
  }
  const visualOffsets = shouldAddVisualOffsets(domElement, isFixedStrategy, offsetParent) ? getVisualOffsets(domElement) : createCoords(0);
  let x = (clientRect.left + visualOffsets.x) / scale.x;
  let y = (clientRect.top + visualOffsets.y) / scale.y;
  let width = clientRect.width / scale.x;
  let height = clientRect.height / scale.y;
  if (domElement) {
    const win = getWindow(domElement);
    const offsetWin = offsetParent && isElement(offsetParent) ? getWindow(offsetParent) : offsetParent;
    let currentWin = win;
    let currentIFrame = getFrameElement(currentWin);
    while (currentIFrame && offsetParent && offsetWin !== currentWin) {
      const iframeScale = getScale(currentIFrame);
      const iframeRect = currentIFrame.getBoundingClientRect();
      const css = getComputedStyle(currentIFrame);
      const left = iframeRect.left + (currentIFrame.clientLeft + parseFloat(css.paddingLeft)) * iframeScale.x;
      const top = iframeRect.top + (currentIFrame.clientTop + parseFloat(css.paddingTop)) * iframeScale.y;
      x *= iframeScale.x;
      y *= iframeScale.y;
      width *= iframeScale.x;
      height *= iframeScale.y;
      x += left;
      y += top;
      currentWin = getWindow(currentIFrame);
      currentIFrame = getFrameElement(currentWin);
    }
  }
  return rectToClientRect({
    width,
    height,
    x,
    y
  });
}

// If <html> has a CSS width greater than the viewport, then this will be
// incorrect for RTL.
function getWindowScrollBarX(element, rect) {
  const leftScroll = getNodeScroll(element).scrollLeft;
  if (!rect) {
    return getBoundingClientRect(getDocumentElement(element)).left + leftScroll;
  }
  return rect.left + leftScroll;
}
function getHTMLOffset(documentElement, scroll, ignoreScrollbarX) {
  if (ignoreScrollbarX === void 0) {
    ignoreScrollbarX = false;
  }
  const htmlRect = documentElement.getBoundingClientRect();
  const x = htmlRect.left + scroll.scrollLeft - (ignoreScrollbarX ? 0 :
  // RTL <body> scrollbar.
  getWindowScrollBarX(documentElement, htmlRect));
  const y = htmlRect.top + scroll.scrollTop;
  return {
    x,
    y
  };
}
function convertOffsetParentRelativeRectToViewportRelativeRect(_ref) {
  let {
    elements,
    rect,
    offsetParent,
    strategy
  } = _ref;
  const isFixed = strategy === 'fixed';
  const documentElement = getDocumentElement(offsetParent);
  const topLayer = elements ? isTopLayer(elements.floating) : false;
  if (offsetParent === documentElement || topLayer && isFixed) {
    return rect;
  }
  let scroll = {
    scrollLeft: 0,
    scrollTop: 0
  };
  let scale = createCoords(1);
  const offsets = createCoords(0);
  const isOffsetParentAnElement = isHTMLElement(offsetParent);
  if (isOffsetParentAnElement || !isOffsetParentAnElement && !isFixed) {
    if (getNodeName(offsetParent) !== 'body' || isOverflowElement(documentElement)) {
      scroll = getNodeScroll(offsetParent);
    }
    if (isHTMLElement(offsetParent)) {
      const offsetRect = getBoundingClientRect(offsetParent);
      scale = getScale(offsetParent);
      offsets.x = offsetRect.x + offsetParent.clientLeft;
      offsets.y = offsetRect.y + offsetParent.clientTop;
    }
  }
  const htmlOffset = documentElement && !isOffsetParentAnElement && !isFixed ? getHTMLOffset(documentElement, scroll, true) : createCoords(0);
  return {
    width: rect.width * scale.x,
    height: rect.height * scale.y,
    x: rect.x * scale.x - scroll.scrollLeft * scale.x + offsets.x + htmlOffset.x,
    y: rect.y * scale.y - scroll.scrollTop * scale.y + offsets.y + htmlOffset.y
  };
}
function getClientRects(element) {
  return Array.from(element.getClientRects());
}

// Gets the entire size of the scrollable document area, even extending outside
// of the `<html>` and `<body>` rect bounds if horizontally scrollable.
function getDocumentRect(element) {
  const html = getDocumentElement(element);
  const scroll = getNodeScroll(element);
  const body = element.ownerDocument.body;
  const width = max(html.scrollWidth, html.clientWidth, body.scrollWidth, body.clientWidth);
  const height = max(html.scrollHeight, html.clientHeight, body.scrollHeight, body.clientHeight);
  let x = -scroll.scrollLeft + getWindowScrollBarX(element);
  const y = -scroll.scrollTop;
  if (getComputedStyle(body).direction === 'rtl') {
    x += max(html.clientWidth, body.clientWidth) - width;
  }
  return {
    width,
    height,
    x,
    y
  };
}
function getViewportRect(element, strategy) {
  const win = getWindow(element);
  const html = getDocumentElement(element);
  const visualViewport = win.visualViewport;
  let width = html.clientWidth;
  let height = html.clientHeight;
  let x = 0;
  let y = 0;
  if (visualViewport) {
    width = visualViewport.width;
    height = visualViewport.height;
    const visualViewportBased = isWebKit();
    if (!visualViewportBased || visualViewportBased && strategy === 'fixed') {
      x = visualViewport.offsetLeft;
      y = visualViewport.offsetTop;
    }
  }
  return {
    width,
    height,
    x,
    y
  };
}

// Returns the inner client rect, subtracting scrollbars if present.
function getInnerBoundingClientRect(element, strategy) {
  const clientRect = getBoundingClientRect(element, true, strategy === 'fixed');
  const top = clientRect.top + element.clientTop;
  const left = clientRect.left + element.clientLeft;
  const scale = isHTMLElement(element) ? getScale(element) : createCoords(1);
  const width = element.clientWidth * scale.x;
  const height = element.clientHeight * scale.y;
  const x = left * scale.x;
  const y = top * scale.y;
  return {
    width,
    height,
    x,
    y
  };
}
function getClientRectFromClippingAncestor(element, clippingAncestor, strategy) {
  let rect;
  if (clippingAncestor === 'viewport') {
    rect = getViewportRect(element, strategy);
  } else if (clippingAncestor === 'document') {
    rect = getDocumentRect(getDocumentElement(element));
  } else if (isElement(clippingAncestor)) {
    rect = getInnerBoundingClientRect(clippingAncestor, strategy);
  } else {
    const visualOffsets = getVisualOffsets(element);
    rect = {
      x: clippingAncestor.x - visualOffsets.x,
      y: clippingAncestor.y - visualOffsets.y,
      width: clippingAncestor.width,
      height: clippingAncestor.height
    };
  }
  return rectToClientRect(rect);
}
function hasFixedPositionAncestor(element, stopNode) {
  const parentNode = getParentNode(element);
  if (parentNode === stopNode || !isElement(parentNode) || isLastTraversableNode(parentNode)) {
    return false;
  }
  return getComputedStyle(parentNode).position === 'fixed' || hasFixedPositionAncestor(parentNode, stopNode);
}

// A "clipping ancestor" is an `overflow` element with the characteristic of
// clipping (or hiding) child elements. This returns all clipping ancestors
// of the given element up the tree.
function getClippingElementAncestors(element, cache) {
  const cachedResult = cache.get(element);
  if (cachedResult) {
    return cachedResult;
  }
  let result = getOverflowAncestors(element, [], false).filter(el => isElement(el) && getNodeName(el) !== 'body');
  let currentContainingBlockComputedStyle = null;
  const elementIsFixed = getComputedStyle(element).position === 'fixed';
  let currentNode = elementIsFixed ? getParentNode(element) : element;

  // https://developer.mozilla.org/en-US/docs/Web/CSS/Containing_block#identifying_the_containing_block
  while (isElement(currentNode) && !isLastTraversableNode(currentNode)) {
    const computedStyle = getComputedStyle(currentNode);
    const currentNodeIsContaining = isContainingBlock(currentNode);
    if (!currentNodeIsContaining && computedStyle.position === 'fixed') {
      currentContainingBlockComputedStyle = null;
    }
    const shouldDropCurrentNode = elementIsFixed ? !currentNodeIsContaining && !currentContainingBlockComputedStyle : !currentNodeIsContaining && computedStyle.position === 'static' && !!currentContainingBlockComputedStyle && ['absolute', 'fixed'].includes(currentContainingBlockComputedStyle.position) || isOverflowElement(currentNode) && !currentNodeIsContaining && hasFixedPositionAncestor(element, currentNode);
    if (shouldDropCurrentNode) {
      // Drop non-containing blocks.
      result = result.filter(ancestor => ancestor !== currentNode);
    } else {
      // Record last containing block for next iteration.
      currentContainingBlockComputedStyle = computedStyle;
    }
    currentNode = getParentNode(currentNode);
  }
  cache.set(element, result);
  return result;
}

// Gets the maximum area that the element is visible in due to any number of
// clipping ancestors.
function getClippingRect(_ref) {
  let {
    element,
    boundary,
    rootBoundary,
    strategy
  } = _ref;
  const elementClippingAncestors = boundary === 'clippingAncestors' ? isTopLayer(element) ? [] : getClippingElementAncestors(element, this._c) : [].concat(boundary);
  const clippingAncestors = [...elementClippingAncestors, rootBoundary];
  const firstClippingAncestor = clippingAncestors[0];
  const clippingRect = clippingAncestors.reduce((accRect, clippingAncestor) => {
    const rect = getClientRectFromClippingAncestor(element, clippingAncestor, strategy);
    accRect.top = max(rect.top, accRect.top);
    accRect.right = min(rect.right, accRect.right);
    accRect.bottom = min(rect.bottom, accRect.bottom);
    accRect.left = max(rect.left, accRect.left);
    return accRect;
  }, getClientRectFromClippingAncestor(element, firstClippingAncestor, strategy));
  return {
    width: clippingRect.right - clippingRect.left,
    height: clippingRect.bottom - clippingRect.top,
    x: clippingRect.left,
    y: clippingRect.top
  };
}
function getDimensions(element) {
  const {
    width,
    height
  } = getCssDimensions(element);
  return {
    width,
    height
  };
}
function getRectRelativeToOffsetParent(element, offsetParent, strategy) {
  const isOffsetParentAnElement = isHTMLElement(offsetParent);
  const documentElement = getDocumentElement(offsetParent);
  const isFixed = strategy === 'fixed';
  const rect = getBoundingClientRect(element, true, isFixed, offsetParent);
  let scroll = {
    scrollLeft: 0,
    scrollTop: 0
  };
  const offsets = createCoords(0);

  // If the <body> scrollbar appears on the left (e.g. RTL systems). Use
  // Firefox with layout.scrollbar.side = 3 in about:config to test this.
  function setLeftRTLScrollbarOffset() {
    offsets.x = getWindowScrollBarX(documentElement);
  }
  if (isOffsetParentAnElement || !isOffsetParentAnElement && !isFixed) {
    if (getNodeName(offsetParent) !== 'body' || isOverflowElement(documentElement)) {
      scroll = getNodeScroll(offsetParent);
    }
    if (isOffsetParentAnElement) {
      const offsetRect = getBoundingClientRect(offsetParent, true, isFixed, offsetParent);
      offsets.x = offsetRect.x + offsetParent.clientLeft;
      offsets.y = offsetRect.y + offsetParent.clientTop;
    } else if (documentElement) {
      setLeftRTLScrollbarOffset();
    }
  }
  if (isFixed && !isOffsetParentAnElement && documentElement) {
    setLeftRTLScrollbarOffset();
  }
  const htmlOffset = documentElement && !isOffsetParentAnElement && !isFixed ? getHTMLOffset(documentElement, scroll) : createCoords(0);
  const x = rect.left + scroll.scrollLeft - offsets.x - htmlOffset.x;
  const y = rect.top + scroll.scrollTop - offsets.y - htmlOffset.y;
  return {
    x,
    y,
    width: rect.width,
    height: rect.height
  };
}
function isStaticPositioned(element) {
  return getComputedStyle(element).position === 'static';
}
function getTrueOffsetParent(element, polyfill) {
  if (!isHTMLElement(element) || getComputedStyle(element).position === 'fixed') {
    return null;
  }
  if (polyfill) {
    return polyfill(element);
  }
  let rawOffsetParent = element.offsetParent;

  // Firefox returns the <html> element as the offsetParent if it's non-static,
  // while Chrome and Safari return the <body> element. The <body> element must
  // be used to perform the correct calculations even if the <html> element is
  // non-static.
  if (getDocumentElement(element) === rawOffsetParent) {
    rawOffsetParent = rawOffsetParent.ownerDocument.body;
  }
  return rawOffsetParent;
}

// Gets the closest ancestor positioned element. Handles some edge cases,
// such as table ancestors and cross browser bugs.
function getOffsetParent(element, polyfill) {
  const win = getWindow(element);
  if (isTopLayer(element)) {
    return win;
  }
  if (!isHTMLElement(element)) {
    let svgOffsetParent = getParentNode(element);
    while (svgOffsetParent && !isLastTraversableNode(svgOffsetParent)) {
      if (isElement(svgOffsetParent) && !isStaticPositioned(svgOffsetParent)) {
        return svgOffsetParent;
      }
      svgOffsetParent = getParentNode(svgOffsetParent);
    }
    return win;
  }
  let offsetParent = getTrueOffsetParent(element, polyfill);
  while (offsetParent && isTableElement(offsetParent) && isStaticPositioned(offsetParent)) {
    offsetParent = getTrueOffsetParent(offsetParent, polyfill);
  }
  if (offsetParent && isLastTraversableNode(offsetParent) && isStaticPositioned(offsetParent) && !isContainingBlock(offsetParent)) {
    return win;
  }
  return offsetParent || getContainingBlock(element) || win;
}
const getElementRects = async function getElementRects(data) {
  const getOffsetParentFn = this.getOffsetParent || getOffsetParent;
  const getDimensionsFn = this.getDimensions;
  const floatingDimensions = await getDimensionsFn(data.floating);
  return {
    reference: getRectRelativeToOffsetParent(data.reference, await getOffsetParentFn(data.floating), data.strategy),
    floating: {
      x: 0,
      y: 0,
      width: floatingDimensions.width,
      height: floatingDimensions.height
    }
  };
};
function isRTL(element) {
  return getComputedStyle(element).direction === 'rtl';
}
const platform = {
  convertOffsetParentRelativeRectToViewportRelativeRect,
  getDocumentElement,
  getClippingRect,
  getOffsetParent,
  getElementRects,
  getClientRects,
  getDimensions,
  getScale,
  isElement,
  isRTL
};
function rectsAreEqual(a, b) {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

// https://samthor.au/2021/observing-dom/
function observeMove(element, onMove) {
  let io = null;
  let timeoutId;
  const root = getDocumentElement(element);
  function cleanup() {
    var _io;
    clearTimeout(timeoutId);
    (_io = io) == null || _io.disconnect();
    io = null;
  }
  function refresh(skip, threshold) {
    if (skip === void 0) {
      skip = false;
    }
    if (threshold === void 0) {
      threshold = 1;
    }
    cleanup();
    const elementRectForRootMargin = element.getBoundingClientRect();
    const {
      left,
      top,
      width,
      height
    } = elementRectForRootMargin;
    if (!skip) {
      onMove();
    }
    if (!width || !height) {
      return;
    }
    const insetTop = floor(top);
    const insetRight = floor(root.clientWidth - (left + width));
    const insetBottom = floor(root.clientHeight - (top + height));
    const insetLeft = floor(left);
    const rootMargin = -insetTop + "px " + -insetRight + "px " + -insetBottom + "px " + -insetLeft + "px";
    const options = {
      rootMargin,
      threshold: max(0, min(1, threshold)) || 1
    };
    let isFirstUpdate = true;
    function handleObserve(entries) {
      const ratio = entries[0].intersectionRatio;
      if (ratio !== threshold) {
        if (!isFirstUpdate) {
          return refresh();
        }
        if (!ratio) {
          // If the reference is clipped, the ratio is 0. Throttle the refresh
          // to prevent an infinite loop of updates.
          timeoutId = setTimeout(() => {
            refresh(false, 1e-7);
          }, 1000);
        } else {
          refresh(false, ratio);
        }
      }
      if (ratio === 1 && !rectsAreEqual(elementRectForRootMargin, element.getBoundingClientRect())) {
        // It's possible that even though the ratio is reported as 1, the
        // element is not actually fully within the IntersectionObserver's root
        // area anymore. This can happen under performance constraints. This may
        // be a bug in the browser's IntersectionObserver implementation. To
        // work around this, we compare the element's bounding rect now with
        // what it was at the time we created the IntersectionObserver. If they
        // are not equal then the element moved, so we refresh.
        refresh();
      }
      isFirstUpdate = false;
    }

    // Older browsers don't support a `document` as the root and will throw an
    // error.
    try {
      io = new IntersectionObserver(handleObserve, _extends({}, options, {
        // Handle <iframe>s
        root: root.ownerDocument
      }));
    } catch (_e) {
      io = new IntersectionObserver(handleObserve, options);
    }
    io.observe(element);
  }
  refresh(true);
  return cleanup;
}

/**
 * Automatically updates the position of the floating element when necessary.
 * Should only be called when the floating element is mounted on the DOM or
 * visible on the screen.
 * @returns cleanup function that should be invoked when the floating element is
 * removed from the DOM or hidden from the screen.
 * @see https://floating-ui.com/docs/autoUpdate
 */
function autoUpdate(reference, floating, update, options) {
  if (options === void 0) {
    options = {};
  }
  const {
    ancestorScroll = true,
    ancestorResize = true,
    elementResize = typeof ResizeObserver === 'function',
    layoutShift = typeof IntersectionObserver === 'function',
    animationFrame = false
  } = options;
  const referenceEl = unwrapElement(reference);
  const ancestors = ancestorScroll || ancestorResize ? [...(referenceEl ? getOverflowAncestors(referenceEl) : []), ...getOverflowAncestors(floating)] : [];
  ancestors.forEach(ancestor => {
    ancestorScroll && ancestor.addEventListener('scroll', update, {
      passive: true
    });
    ancestorResize && ancestor.addEventListener('resize', update);
  });
  const cleanupIo = referenceEl && layoutShift ? observeMove(referenceEl, update) : null;
  let reobserveFrame = -1;
  let resizeObserver = null;
  if (elementResize) {
    resizeObserver = new ResizeObserver(_ref => {
      let [firstEntry] = _ref;
      if (firstEntry && firstEntry.target === referenceEl && resizeObserver) {
        // Prevent update loops when using the `size` middleware.
        // https://github.com/floating-ui/floating-ui/issues/1740
        resizeObserver.unobserve(floating);
        cancelAnimationFrame(reobserveFrame);
        reobserveFrame = requestAnimationFrame(() => {
          var _resizeObserver;
          (_resizeObserver = resizeObserver) == null || _resizeObserver.observe(floating);
        });
      }
      update();
    });
    if (referenceEl && !animationFrame) {
      resizeObserver.observe(referenceEl);
    }
    resizeObserver.observe(floating);
  }
  let frameId;
  let prevRefRect = animationFrame ? getBoundingClientRect(reference) : null;
  if (animationFrame) {
    frameLoop();
  }
  function frameLoop() {
    const nextRefRect = getBoundingClientRect(reference);
    if (prevRefRect && !rectsAreEqual(prevRefRect, nextRefRect)) {
      update();
    }
    prevRefRect = nextRefRect;
    frameId = requestAnimationFrame(frameLoop);
  }
  update();
  return () => {
    var _resizeObserver2;
    ancestors.forEach(ancestor => {
      ancestorScroll && ancestor.removeEventListener('scroll', update);
      ancestorResize && ancestor.removeEventListener('resize', update);
    });
    cleanupIo == null || cleanupIo();
    (_resizeObserver2 = resizeObserver) == null || _resizeObserver2.disconnect();
    resizeObserver = null;
    if (animationFrame) {
      cancelAnimationFrame(frameId);
    }
  };
}

/**
 * Optimizes the visibility of the floating element by choosing the placement
 * that has the most space available automatically, without needing to specify a
 * preferred placement. Alternative to `flip`.
 * @see https://floating-ui.com/docs/autoPlacement
 */
const autoPlacement = autoPlacement$1;

/**
 * Optimizes the visibility of the floating element by shifting it in order to
 * keep it in view when it will overflow the clipping boundary.
 * @see https://floating-ui.com/docs/shift
 */
const shift = shift$1;

/**
 * Optimizes the visibility of the floating element by flipping the `placement`
 * in order to keep it in view when the preferred placement(s) will overflow the
 * clipping boundary. Alternative to `autoPlacement`.
 * @see https://floating-ui.com/docs/flip
 */
const flip = flip$1;

/**
 * Provides data to position an inner element of the floating element so that it
 * appears centered to the reference element.
 * @see https://floating-ui.com/docs/arrow
 */
const arrow = arrow$1;

/**
 * Built-in `limiter` that will stop `shift()` at a certain point.
 */
const limitShift = limitShift$1;

/**
 * Computes the `x` and `y` coordinates that will place the floating element
 * next to a given reference element.
 */
const computePosition = (reference, floating, options) => {
  // This caches the expensive `getClippingElementAncestors` function so that
  // multiple lifecycle resets re-use the same result. It only lives for a
  // single call. If other functions become expensive, we can add them as well.
  const cache = new Map();
  const mergedOptions = _extends({
    platform
  }, options);
  const platformWithCache = _extends({}, mergedOptions.platform, {
    _c: cache
  });
  return computePosition$1(reference, floating, _extends({}, mergedOptions, {
    platform: platformWithCache
  }));
};

/**
 * Determines options for the tooltip and initializes event listeners.
 *
 * @param step The step instance
 */
function setupTooltip(step) {
  if (step.cleanup) {
    step.cleanup();
  }
  const attachToOptions = step._getResolvedAttachToOptions();
  let target = attachToOptions.element;
  const floatingUIOptions = getFloatingUIOptions(attachToOptions, step);
  const shouldCenter = shouldCenterStep(attachToOptions);
  if (shouldCenter) {
    target = document.body;
    // @ts-expect-error TODO: fix this type error when we type Svelte
    const content = step.shepherdElementComponent.getElement();
    content.classList.add('shepherd-centered');
  }
  step.cleanup = autoUpdate(target, step.el, () => {
    // The element might have already been removed by the end of the tour.
    if (!step.el) {
      step.cleanup == null || step.cleanup();
      return;
    }
    setPosition(target, step, floatingUIOptions, shouldCenter);
  });
  step.target = attachToOptions.element;
  return floatingUIOptions;
}

/**
 * Merge tooltip options handling nested keys.
 *
 * @param tourOptions - The default tour options.
 * @param options - Step specific options.
 *
 * @return {floatingUIOptions: FloatingUIOptions}
 */
function mergeTooltipConfig(tourOptions, options) {
  return {
    floatingUIOptions: deepmerge(tourOptions.floatingUIOptions || {}, options.floatingUIOptions || {})
  };
}

/**
 * Cleanup function called when the step is closed/destroyed.
 *
 * @param step
 */
function destroyTooltip(step) {
  if (step.cleanup) {
    step.cleanup();
  }
  step.cleanup = null;
}
function setPosition(target, step, floatingUIOptions, shouldCenter) {
  return computePosition(target, step.el, floatingUIOptions).then(floatingUIposition(step, shouldCenter))
  // Wait before forcing focus.
  .then(step => new Promise(resolve => {
    setTimeout(() => resolve(step), 300);
  }))
  // Replaces focusAfterRender modifier.
  .then(step => {
    if (step != null && step.el) {
      step.el.tabIndex = 0;
      step.el.focus({
        preventScroll: true
      });
    }
  });
}
function floatingUIposition(step, shouldCenter) {
  return ({
    x,
    y,
    placement,
    middlewareData
  }) => {
    if (!step.el) {
      return step;
    }
    if (shouldCenter) {
      Object.assign(step.el.style, {
        position: 'fixed',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)'
      });
    } else {
      Object.assign(step.el.style, {
        position: 'absolute',
        left: `${x}px`,
        top: `${y}px`
      });
    }
    step.el.dataset['popperPlacement'] = placement;
    placeArrow(step.el, middlewareData);
    return step;
  };
}
function placeArrow(el, middlewareData) {
  const arrowEl = el.querySelector('.shepherd-arrow');
  if (isHTMLElement$1(arrowEl) && middlewareData.arrow) {
    const {
      x: arrowX,
      y: arrowY
    } = middlewareData.arrow;
    Object.assign(arrowEl.style, {
      left: arrowX != null ? `${arrowX}px` : '',
      top: arrowY != null ? `${arrowY}px` : ''
    });
  }
}

/**
 * Gets the `Floating UI` options from a set of base `attachTo` options
 * @param attachToOptions
 * @param step The step instance
 * @private
 */
function getFloatingUIOptions(attachToOptions, step) {
  var _attachToOptions$on, _attachToOptions$on2, _attachToOptions$on3;
  const options = {
    strategy: 'absolute'
  };
  options.middleware = [];
  const arrowEl = addArrow(step);
  const shouldCenter = shouldCenterStep(attachToOptions);
  const hasAutoPlacement = (_attachToOptions$on = attachToOptions.on) == null ? void 0 : _attachToOptions$on.includes('auto');
  const hasEdgeAlignment = (attachToOptions == null || (_attachToOptions$on2 = attachToOptions.on) == null ? void 0 : _attachToOptions$on2.includes('-start')) || (attachToOptions == null || (_attachToOptions$on3 = attachToOptions.on) == null ? void 0 : _attachToOptions$on3.includes('-end'));
  if (!shouldCenter) {
    if (hasAutoPlacement) {
      var _attachToOptions$on4;
      options.middleware.push(autoPlacement({
        crossAxis: true,
        alignment: hasEdgeAlignment ? attachToOptions == null || (_attachToOptions$on4 = attachToOptions.on) == null ? void 0 : _attachToOptions$on4.split('-').pop() : null
      }));
    } else {
      options.middleware.push(flip());
    }
    options.middleware.push(
    // Replicate PopperJS default behavior.
    shift({
      limiter: limitShift(),
      crossAxis: true
    }));
    if (arrowEl) {
      const arrowOptions = typeof step.options.arrow === 'object' ? step.options.arrow : {
        padding: 4
      };
      options.middleware.push(arrow({
        element: arrowEl,
        padding: hasEdgeAlignment ? arrowOptions.padding : 0
      }));
    }
    if (!hasAutoPlacement) options.placement = attachToOptions.on;
  }
  return deepmerge(options, step.options.floatingUIOptions || {});
}
function addArrow(step) {
  if (step.options.arrow && step.el) {
    return step.el.querySelector('.shepherd-arrow');
  }
  return false;
}

/** @returns {void} */
function noop() {}

/**
 * @template T
 * @template S
 * @param {T} tar
 * @param {S} src
 * @returns {T & S}
 */
function assign(tar, src) {
  // @ts-ignore
  for (const k in src) tar[k] = src[k];
  return /** @type {T & S} */tar;
}
function run(fn) {
  return fn();
}
function blank_object() {
  return Object.create(null);
}

/**
 * @param {Function[]} fns
 * @returns {void}
 */
function run_all(fns) {
  fns.forEach(run);
}

/**
 * @param {any} thing
 * @returns {thing is Function}
 */
function is_function(thing) {
  return typeof thing === 'function';
}

/** @returns {boolean} */
function safe_not_equal(a, b) {
  return a != a ? b == b : a !== b || a && typeof a === 'object' || typeof a === 'function';
}

/** @returns {boolean} */
function is_empty(obj) {
  return Object.keys(obj).length === 0;
}

/**
 * @param {Node} target
 * @param {Node} node
 * @returns {void}
 */
function append(target, node) {
  target.appendChild(node);
}

/**
 * @param {Node} target
 * @param {Node} node
 * @param {Node} [anchor]
 * @returns {void}
 */
function insert(target, node, anchor) {
  target.insertBefore(node, anchor || null);
}

/**
 * @param {Node} node
 * @returns {void}
 */
function detach(node) {
  if (node.parentNode) {
    node.parentNode.removeChild(node);
  }
}

/**
 * @returns {void} */
function destroy_each(iterations, detaching) {
  for (let i = 0; i < iterations.length; i += 1) {
    if (iterations[i]) iterations[i].d(detaching);
  }
}

/**
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} name
 * @returns {HTMLElementTagNameMap[K]}
 */
function element(name) {
  return document.createElement(name);
}

/**
 * @template {keyof SVGElementTagNameMap} K
 * @param {K} name
 * @returns {SVGElement}
 */
function svg_element(name) {
  return document.createElementNS('http://www.w3.org/2000/svg', name);
}

/**
 * @param {string} data
 * @returns {Text}
 */
function text(data) {
  return document.createTextNode(data);
}

/**
 * @returns {Text} */
function space() {
  return text(' ');
}

/**
 * @returns {Text} */
function empty() {
  return text('');
}

/**
 * @param {EventTarget} node
 * @param {string} event
 * @param {EventListenerOrEventListenerObject} handler
 * @param {boolean | AddEventListenerOptions | EventListenerOptions} [options]
 * @returns {() => void}
 */
function listen(node, event, handler, options) {
  node.addEventListener(event, handler, options);
  return () => node.removeEventListener(event, handler, options);
}

/**
 * @param {Element} node
 * @param {string} attribute
 * @param {string} [value]
 * @returns {void}
 */
function attr(node, attribute, value) {
  if (value == null) node.removeAttribute(attribute);else if (node.getAttribute(attribute) !== value) node.setAttribute(attribute, value);
}
/**
 * List of attributes that should always be set through the attr method,
 * because updating them through the property setter doesn't work reliably.
 * In the example of `width`/`height`, the problem is that the setter only
 * accepts numeric values, but the attribute can also be set to a string like `50%`.
 * If this list becomes too big, rethink this approach.
 */
const always_set_through_set_attribute = ['width', 'height'];

/**
 * @param {Element & ElementCSSInlineStyle} node
 * @param {{ [x: string]: string }} attributes
 * @returns {void}
 */
function set_attributes(node, attributes) {
  // @ts-ignore
  const descriptors = Object.getOwnPropertyDescriptors(node.__proto__);
  for (const key in attributes) {
    if (attributes[key] == null) {
      node.removeAttribute(key);
    } else if (key === 'style') {
      node.style.cssText = attributes[key];
    } else if (key === '__value') {
      /** @type {any} */node.value = node[key] = attributes[key];
    } else if (descriptors[key] && descriptors[key].set && always_set_through_set_attribute.indexOf(key) === -1) {
      node[key] = attributes[key];
    } else {
      attr(node, key, attributes[key]);
    }
  }
}

/**
 * @param {Element} element
 * @returns {ChildNode[]}
 */
function children(element) {
  return Array.from(element.childNodes);
}

/**
 * @returns {void} */
function toggle_class(element, name, toggle) {
  // The `!!` is required because an `undefined` flag means flipping the current state.
  element.classList.toggle(name, !!toggle);
}

/**
 * @typedef {Node & {
 * 	claim_order?: number;
 * 	hydrate_init?: true;
 * 	actual_end_child?: NodeEx;
 * 	childNodes: NodeListOf<NodeEx>;
 * }} NodeEx
 */

/** @typedef {ChildNode & NodeEx} ChildNodeEx */

/** @typedef {NodeEx & { claim_order: number }} NodeEx2 */

/**
 * @typedef {ChildNodeEx[] & {
 * 	claim_info?: {
 * 		last_index: number;
 * 		total_claimed: number;
 * 	};
 * }} ChildNodeArray
 */

let current_component;

/** @returns {void} */
function set_current_component(component) {
  current_component = component;
}
function get_current_component() {
  if (!current_component) throw new Error('Function called outside component initialization');
  return current_component;
}

/**
 * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
 * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
 * it can be called from an external module).
 *
 * If a function is returned _synchronously_ from `onMount`, it will be called when the component is unmounted.
 *
 * `onMount` does not run inside a [server-side component](https://svelte.dev/docs#run-time-server-side-component-api).
 *
 * https://svelte.dev/docs/svelte#onmount
 * @template T
 * @param {() => import('./private.js').NotFunction<T> | Promise<import('./private.js').NotFunction<T>> | (() => any)} fn
 * @returns {void}
 */
function onMount(fn) {
  get_current_component().$$.on_mount.push(fn);
}

/**
 * Schedules a callback to run immediately after the component has been updated.
 *
 * The first time the callback runs will be after the initial `onMount`
 *
 * https://svelte.dev/docs/svelte#afterupdate
 * @param {() => any} fn
 * @returns {void}
 */
function afterUpdate(fn) {
  get_current_component().$$.after_update.push(fn);
}

/**
 * Schedules a callback to run immediately before the component is unmounted.
 *
 * Out of `onMount`, `beforeUpdate`, `afterUpdate` and `onDestroy`, this is the
 * only one that runs inside a server-side component.
 *
 * https://svelte.dev/docs/svelte#ondestroy
 * @param {() => any} fn
 * @returns {void}
 */
function onDestroy(fn) {
  get_current_component().$$.on_destroy.push(fn);
}

const dirty_components = [];
const binding_callbacks = [];
let render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = /* @__PURE__ */Promise.resolve();
let update_scheduled = false;

/** @returns {void} */
function schedule_update() {
  if (!update_scheduled) {
    update_scheduled = true;
    resolved_promise.then(flush);
  }
}

/** @returns {void} */
function add_render_callback(fn) {
  render_callbacks.push(fn);
}

// flush() calls callbacks in this order:
// 1. All beforeUpdate callbacks, in order: parents before children
// 2. All bind:this callbacks, in reverse order: children before parents.
// 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
//    for afterUpdates called during the initial onMount, which are called in
//    reverse order: children before parents.
// Since callbacks might update component values, which could trigger another
// call to flush(), the following steps guard against this:
// 1. During beforeUpdate, any updated components will be added to the
//    dirty_components array and will cause a reentrant call to flush(). Because
//    the flush index is kept outside the function, the reentrant call will pick
//    up where the earlier call left off and go through all dirty components. The
//    current_component value is saved and restored so that the reentrant call will
//    not interfere with the "parent" flush() call.
// 2. bind:this callbacks cannot trigger new flush() calls.
// 3. During afterUpdate, any updated components will NOT have their afterUpdate
//    callback called a second time; the seen_callbacks set, outside the flush()
//    function, guarantees this behavior.
const seen_callbacks = new Set();
let flushidx = 0; // Do *not* move this inside the flush() function

/** @returns {void} */
function flush() {
  // Do not reenter flush while dirty components are updated, as this can
  // result in an infinite loop. Instead, let the inner flush handle it.
  // Reentrancy is ok afterwards for bindings etc.
  if (flushidx !== 0) {
    return;
  }
  const saved_component = current_component;
  do {
    // first, call beforeUpdate functions
    // and update components
    try {
      while (flushidx < dirty_components.length) {
        const component = dirty_components[flushidx];
        flushidx++;
        set_current_component(component);
        update(component.$$);
      }
    } catch (e) {
      // reset dirty state to not end up in a deadlocked state and then rethrow
      dirty_components.length = 0;
      flushidx = 0;
      throw e;
    }
    set_current_component(null);
    dirty_components.length = 0;
    flushidx = 0;
    while (binding_callbacks.length) binding_callbacks.pop()();
    // then, once components are updated, call
    // afterUpdate functions. This may cause
    // subsequent updates...
    for (let i = 0; i < render_callbacks.length; i += 1) {
      const callback = render_callbacks[i];
      if (!seen_callbacks.has(callback)) {
        // ...so guard against infinite loops
        seen_callbacks.add(callback);
        callback();
      }
    }
    render_callbacks.length = 0;
  } while (dirty_components.length);
  while (flush_callbacks.length) {
    flush_callbacks.pop()();
  }
  update_scheduled = false;
  seen_callbacks.clear();
  set_current_component(saved_component);
}

/** @returns {void} */
function update($$) {
  if ($$.fragment !== null) {
    $$.update();
    run_all($$.before_update);
    const dirty = $$.dirty;
    $$.dirty = [-1];
    $$.fragment && $$.fragment.p($$.ctx, dirty);
    $$.after_update.forEach(add_render_callback);
  }
}

/**
 * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
 * @param {Function[]} fns
 * @returns {void}
 */
function flush_render_callbacks(fns) {
  const filtered = [];
  const targets = [];
  render_callbacks.forEach(c => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
  targets.forEach(c => c());
  render_callbacks = filtered;
}

const outroing = new Set();

/**
 * @type {Outro}
 */
let outros;

/**
 * @returns {void} */
function group_outros() {
  outros = {
    r: 0,
    c: [],
    p: outros // parent group
  };
}

/**
 * @returns {void} */
function check_outros() {
  if (!outros.r) {
    run_all(outros.c);
  }
  outros = outros.p;
}

/**
 * @param {import('./private.js').Fragment} block
 * @param {0 | 1} [local]
 * @returns {void}
 */
function transition_in(block, local) {
  if (block && block.i) {
    outroing.delete(block);
    block.i(local);
  }
}

/**
 * @param {import('./private.js').Fragment} block
 * @param {0 | 1} local
 * @param {0 | 1} [detach]
 * @param {() => void} [callback]
 * @returns {void}
 */
function transition_out(block, local, detach, callback) {
  if (block && block.o) {
    if (outroing.has(block)) return;
    outroing.add(block);
    outros.c.push(() => {
      outroing.delete(block);
      if (callback) {
        if (detach) block.d(1);
        callback();
      }
    });
    block.o(local);
  } else if (callback) {
    callback();
  }
}

/** @typedef {1} INTRO */
/** @typedef {0} OUTRO */
/** @typedef {{ direction: 'in' | 'out' | 'both' }} TransitionOptions */
/** @typedef {(node: Element, params: any, options: TransitionOptions) => import('../transition/public.js').TransitionConfig} TransitionFn */

/**
 * @typedef {Object} Outro
 * @property {number} r
 * @property {Function[]} c
 * @property {Object} p
 */

/**
 * @typedef {Object} PendingProgram
 * @property {number} start
 * @property {INTRO|OUTRO} b
 * @property {Outro} [group]
 */

/**
 * @typedef {Object} Program
 * @property {number} a
 * @property {INTRO|OUTRO} b
 * @property {1|-1} d
 * @property {number} duration
 * @property {number} start
 * @property {number} end
 * @property {Outro} [group]
 */

// general each functions:

function ensure_array_like(array_like_or_iterator) {
  return (array_like_or_iterator == null ? void 0 : array_like_or_iterator.length) !== undefined ? array_like_or_iterator : Array.from(array_like_or_iterator);
}

/** @returns {{}} */
function get_spread_update(levels, updates) {
  const update = {};
  const to_null_out = {};
  const accounted_for = {
    $$scope: 1
  };
  let i = levels.length;
  while (i--) {
    const o = levels[i];
    const n = updates[i];
    if (n) {
      for (const key in o) {
        if (!(key in n)) to_null_out[key] = 1;
      }
      for (const key in n) {
        if (!accounted_for[key]) {
          update[key] = n[key];
          accounted_for[key] = 1;
        }
      }
      levels[i] = n;
    } else {
      for (const key in o) {
        accounted_for[key] = 1;
      }
    }
  }
  for (const key in to_null_out) {
    if (!(key in update)) update[key] = undefined;
  }
  return update;
}

/** @returns {void} */
function create_component(block) {
  block && block.c();
}

/** @returns {void} */
function mount_component(component, target, anchor) {
  const {
    fragment,
    after_update
  } = component.$$;
  fragment && fragment.m(target, anchor);
  // onMount happens before the initial afterUpdate
  add_render_callback(() => {
    const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
    // if the component was destroyed immediately
    // it will update the `$$.on_destroy` reference to `null`.
    // the destructured on_destroy may still reference to the old array
    if (component.$$.on_destroy) {
      component.$$.on_destroy.push(...new_on_destroy);
    } else {
      // Edge case - component was destroyed immediately,
      // most likely as a result of a binding initialising
      run_all(new_on_destroy);
    }
    component.$$.on_mount = [];
  });
  after_update.forEach(add_render_callback);
}

/** @returns {void} */
function destroy_component(component, detaching) {
  const $$ = component.$$;
  if ($$.fragment !== null) {
    flush_render_callbacks($$.after_update);
    run_all($$.on_destroy);
    $$.fragment && $$.fragment.d(detaching);
    // TODO null out other refs, including component.$$ (but need to
    // preserve final state?)
    $$.on_destroy = $$.fragment = null;
    $$.ctx = [];
  }
}

/** @returns {void} */
function make_dirty(component, i) {
  if (component.$$.dirty[0] === -1) {
    dirty_components.push(component);
    schedule_update();
    component.$$.dirty.fill(0);
  }
  component.$$.dirty[i / 31 | 0] |= 1 << i % 31;
}

// TODO: Document the other params
/**
 * @param {SvelteComponent} component
 * @param {import('./public.js').ComponentConstructorOptions} options
 *
 * @param {import('./utils.js')['not_equal']} not_equal Used to compare props and state values.
 * @param {(target: Element | ShadowRoot) => void} [append_styles] Function that appends styles to the DOM when the component is first initialised.
 * This will be the `add_css` function from the compiled component.
 *
 * @returns {void}
 */
function init(component, options, instance, create_fragment, not_equal, props, append_styles = null, dirty = [-1]) {
  const parent_component = current_component;
  set_current_component(component);
  /** @type {import('./private.js').T$$} */
  const $$ = component.$$ = {
    fragment: null,
    ctx: [],
    // state
    props,
    update: noop,
    not_equal,
    bound: blank_object(),
    // lifecycle
    on_mount: [],
    on_destroy: [],
    on_disconnect: [],
    before_update: [],
    after_update: [],
    context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
    // everything else
    callbacks: blank_object(),
    dirty,
    skip_bound: false,
    root: options.target || parent_component.$$.root
  };
  append_styles && append_styles($$.root);
  let ready = false;
  $$.ctx = instance ? instance(component, options.props || {}, (i, ret, ...rest) => {
    const value = rest.length ? rest[0] : ret;
    if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
      if (!$$.skip_bound && $$.bound[i]) $$.bound[i](value);
      if (ready) make_dirty(component, i);
    }
    return ret;
  }) : [];
  $$.update();
  ready = true;
  run_all($$.before_update);
  // `false` as a special case of no DOM component
  $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
  if (options.target) {
    if (options.hydrate) {
      // TODO: what is the correct type here?
      // @ts-expect-error
      const nodes = children(options.target);
      $$.fragment && $$.fragment.l(nodes);
      nodes.forEach(detach);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      $$.fragment && $$.fragment.c();
    }
    if (options.intro) transition_in(component.$$.fragment);
    mount_component(component, options.target, options.anchor);
    flush();
  }
  set_current_component(parent_component);
}

/**
 * Base class for Svelte components. Used when dev=false.
 *
 * @template {Record<string, any>} [Props=any]
 * @template {Record<string, any>} [Events=any]
 */
class SvelteComponent {
  constructor() {
    /**
     * ### PRIVATE API
     *
     * Do not use, may change at any time
     *
     * @type {any}
     */
    this.$$ = undefined;
    /**
     * ### PRIVATE API
     *
     * Do not use, may change at any time
     *
     * @type {any}
     */
    this.$$set = undefined;
  }
  /** @returns {void} */
  $destroy() {
    destroy_component(this, 1);
    this.$destroy = noop;
  }

  /**
   * @template {Extract<keyof Events, string>} K
   * @param {K} type
   * @param {((e: Events[K]) => void) | null | undefined} callback
   * @returns {() => void}
   */
  $on(type, callback) {
    if (!is_function(callback)) {
      return noop;
    }
    const callbacks = this.$$.callbacks[type] || (this.$$.callbacks[type] = []);
    callbacks.push(callback);
    return () => {
      const index = callbacks.indexOf(callback);
      if (index !== -1) callbacks.splice(index, 1);
    };
  }

  /**
   * @param {Partial<Props>} props
   * @returns {void}
   */
  $set(props) {
    if (this.$$set && !is_empty(props)) {
      this.$$.skip_bound = true;
      this.$$set(props);
      this.$$.skip_bound = false;
    }
  }
}

/**
 * @typedef {Object} CustomElementPropDefinition
 * @property {string} [attribute]
 * @property {boolean} [reflect]
 * @property {'String'|'Boolean'|'Number'|'Array'|'Object'} [type]
 */

// generated during release, do not modify

const PUBLIC_VERSION = '4';

if (typeof window !== 'undefined')
  // @ts-ignore
  (window.__svelte || (window.__svelte = {
    v: new Set()
  })).v.add(PUBLIC_VERSION);

/* src/components/shepherd-button.svelte generated by Svelte v4.2.19 */
function create_fragment$8(ctx) {
  let button;
  let button_aria_label_value;
  let button_class_value;
  let mounted;
  let dispose;
  return {
    c() {
      button = element("button");
      attr(button, "aria-label", button_aria_label_value = /*label*/ctx[3] ? /*label*/ctx[3] : null);
      attr(button, "class", button_class_value = `${/*classes*/ctx[1] || ''} shepherd-button ${/*secondary*/ctx[4] ? 'shepherd-button-secondary' : ''}`);
      button.disabled = /*disabled*/ctx[2];
      attr(button, "tabindex", "0");
      attr(button, "type", "button");
    },
    m(target, anchor) {
      insert(target, button, anchor);
      button.innerHTML = /*text*/ctx[5];
      if (!mounted) {
        dispose = listen(button, "click", function () {
          if (is_function(/*action*/ctx[0])) /*action*/ctx[0].apply(this, arguments);
        });
        mounted = true;
      }
    },
    p(new_ctx, [dirty]) {
      ctx = new_ctx;
      if (dirty & /*text*/32) button.innerHTML = /*text*/ctx[5];
      if (dirty & /*label*/8 && button_aria_label_value !== (button_aria_label_value = /*label*/ctx[3] ? /*label*/ctx[3] : null)) {
        attr(button, "aria-label", button_aria_label_value);
      }
      if (dirty & /*classes, secondary*/18 && button_class_value !== (button_class_value = `${/*classes*/ctx[1] || ''} shepherd-button ${/*secondary*/ctx[4] ? 'shepherd-button-secondary' : ''}`)) {
        attr(button, "class", button_class_value);
      }
      if (dirty & /*disabled*/4) {
        button.disabled = /*disabled*/ctx[2];
      }
    },
    i: noop,
    o: noop,
    d(detaching) {
      if (detaching) {
        detach(button);
      }
      mounted = false;
      dispose();
    }
  };
}
function instance$8($$self, $$props, $$invalidate) {
  let {
    config,
    step
  } = $$props;
  let action, classes, disabled, label, secondary, text;
  function getConfigOption(option) {
    if (isFunction(option)) {
      return option = option.call(step);
    }
    return option;
  }
  $$self.$$set = $$props => {
    if ('config' in $$props) $$invalidate(6, config = $$props.config);
    if ('step' in $$props) $$invalidate(7, step = $$props.step);
  };
  $$self.$$.update = () => {
    if ($$self.$$.dirty & /*config, step*/192) {
      {
        $$invalidate(0, action = config.action ? config.action.bind(step.tour) : null);
        $$invalidate(1, classes = config.classes);
        $$invalidate(2, disabled = config.disabled ? getConfigOption(config.disabled) : false);
        $$invalidate(3, label = config.label ? getConfigOption(config.label) : null);
        $$invalidate(4, secondary = config.secondary);
        $$invalidate(5, text = config.text ? getConfigOption(config.text) : null);
      }
    }
  };
  return [action, classes, disabled, label, secondary, text, config, step];
}
class Shepherd_button extends SvelteComponent {
  constructor(options) {
    super();
    init(this, options, instance$8, create_fragment$8, safe_not_equal, {
      config: 6,
      step: 7
    });
  }
}

/* src/components/shepherd-footer.svelte generated by Svelte v4.2.19 */
function get_each_context(ctx, list, i) {
  const child_ctx = ctx.slice();
  child_ctx[2] = list[i];
  return child_ctx;
}

// (10:2) {#if buttons}
function create_if_block$3(ctx) {
  let each_1_anchor;
  let current;
  let each_value = ensure_array_like(/*buttons*/ctx[1]);
  let each_blocks = [];
  for (let i = 0; i < each_value.length; i += 1) {
    each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
  }
  const out = i => transition_out(each_blocks[i], 1, 1, () => {
    each_blocks[i] = null;
  });
  return {
    c() {
      for (let i = 0; i < each_blocks.length; i += 1) {
        each_blocks[i].c();
      }
      each_1_anchor = empty();
    },
    m(target, anchor) {
      for (let i = 0; i < each_blocks.length; i += 1) {
        if (each_blocks[i]) {
          each_blocks[i].m(target, anchor);
        }
      }
      insert(target, each_1_anchor, anchor);
      current = true;
    },
    p(ctx, dirty) {
      if (dirty & /*buttons, step*/3) {
        each_value = ensure_array_like(/*buttons*/ctx[1]);
        let i;
        for (i = 0; i < each_value.length; i += 1) {
          const child_ctx = get_each_context(ctx, each_value, i);
          if (each_blocks[i]) {
            each_blocks[i].p(child_ctx, dirty);
            transition_in(each_blocks[i], 1);
          } else {
            each_blocks[i] = create_each_block(child_ctx);
            each_blocks[i].c();
            transition_in(each_blocks[i], 1);
            each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
          }
        }
        group_outros();
        for (i = each_value.length; i < each_blocks.length; i += 1) {
          out(i);
        }
        check_outros();
      }
    },
    i(local) {
      if (current) return;
      for (let i = 0; i < each_value.length; i += 1) {
        transition_in(each_blocks[i]);
      }
      current = true;
    },
    o(local) {
      each_blocks = each_blocks.filter(Boolean);
      for (let i = 0; i < each_blocks.length; i += 1) {
        transition_out(each_blocks[i]);
      }
      current = false;
    },
    d(detaching) {
      if (detaching) {
        detach(each_1_anchor);
      }
      destroy_each(each_blocks, detaching);
    }
  };
}

// (11:4) {#each buttons as config}
function create_each_block(ctx) {
  let shepherdbutton;
  let current;
  shepherdbutton = new Shepherd_button({
    props: {
      config: /*config*/ctx[2],
      step: /*step*/ctx[0]
    }
  });
  return {
    c() {
      create_component(shepherdbutton.$$.fragment);
    },
    m(target, anchor) {
      mount_component(shepherdbutton, target, anchor);
      current = true;
    },
    p(ctx, dirty) {
      const shepherdbutton_changes = {};
      if (dirty & /*buttons*/2) shepherdbutton_changes.config = /*config*/ctx[2];
      if (dirty & /*step*/1) shepherdbutton_changes.step = /*step*/ctx[0];
      shepherdbutton.$set(shepherdbutton_changes);
    },
    i(local) {
      if (current) return;
      transition_in(shepherdbutton.$$.fragment, local);
      current = true;
    },
    o(local) {
      transition_out(shepherdbutton.$$.fragment, local);
      current = false;
    },
    d(detaching) {
      destroy_component(shepherdbutton, detaching);
    }
  };
}
function create_fragment$7(ctx) {
  let footer;
  let current;
  let if_block = /*buttons*/ctx[1] && create_if_block$3(ctx);
  return {
    c() {
      footer = element("footer");
      if (if_block) if_block.c();
      attr(footer, "class", "shepherd-footer");
    },
    m(target, anchor) {
      insert(target, footer, anchor);
      if (if_block) if_block.m(footer, null);
      current = true;
    },
    p(ctx, [dirty]) {
      if (/*buttons*/ctx[1]) {
        if (if_block) {
          if_block.p(ctx, dirty);
          if (dirty & /*buttons*/2) {
            transition_in(if_block, 1);
          }
        } else {
          if_block = create_if_block$3(ctx);
          if_block.c();
          transition_in(if_block, 1);
          if_block.m(footer, null);
        }
      } else if (if_block) {
        group_outros();
        transition_out(if_block, 1, 1, () => {
          if_block = null;
        });
        check_outros();
      }
    },
    i(local) {
      if (current) return;
      transition_in(if_block);
      current = true;
    },
    o(local) {
      transition_out(if_block);
      current = false;
    },
    d(detaching) {
      if (detaching) {
        detach(footer);
      }
      if (if_block) if_block.d();
    }
  };
}
function instance$7($$self, $$props, $$invalidate) {
  let buttons;
  let {
    step
  } = $$props;
  $$self.$$set = $$props => {
    if ('step' in $$props) $$invalidate(0, step = $$props.step);
  };
  $$self.$$.update = () => {
    if ($$self.$$.dirty & /*step*/1) {
      $$invalidate(1, buttons = step.options.buttons);
    }
  };
  return [step, buttons];
}
class Shepherd_footer extends SvelteComponent {
  constructor(options) {
    super();
    init(this, options, instance$7, create_fragment$7, safe_not_equal, {
      step: 0
    });
  }
}

/* src/components/shepherd-cancel-icon.svelte generated by Svelte v4.2.19 */
function create_fragment$6(ctx) {
  let button;
  let span;
  let button_aria_label_value;
  let mounted;
  let dispose;
  return {
    c() {
      button = element("button");
      span = element("span");
      span.textContent = "×";
      attr(span, "aria-hidden", "true");
      attr(button, "aria-label", button_aria_label_value = /*cancelIcon*/ctx[0].label ? /*cancelIcon*/ctx[0].label : 'Close Tour');
      attr(button, "class", "shepherd-cancel-icon");
      attr(button, "type", "button");
    },
    m(target, anchor) {
      insert(target, button, anchor);
      append(button, span);
      if (!mounted) {
        dispose = listen(button, "click", /*handleCancelClick*/ctx[1]);
        mounted = true;
      }
    },
    p(ctx, [dirty]) {
      if (dirty & /*cancelIcon*/1 && button_aria_label_value !== (button_aria_label_value = /*cancelIcon*/ctx[0].label ? /*cancelIcon*/ctx[0].label : 'Close Tour')) {
        attr(button, "aria-label", button_aria_label_value);
      }
    },
    i: noop,
    o: noop,
    d(detaching) {
      if (detaching) {
        detach(button);
      }
      mounted = false;
      dispose();
    }
  };
}
function instance$6($$self, $$props, $$invalidate) {
  let {
    cancelIcon,
    step
  } = $$props;

  /**
  * Add a click listener to the cancel link that cancels the tour
  */
  const handleCancelClick = e => {
    e.preventDefault();
    step.cancel();
  };
  $$self.$$set = $$props => {
    if ('cancelIcon' in $$props) $$invalidate(0, cancelIcon = $$props.cancelIcon);
    if ('step' in $$props) $$invalidate(2, step = $$props.step);
  };
  return [cancelIcon, handleCancelClick, step];
}
class Shepherd_cancel_icon extends SvelteComponent {
  constructor(options) {
    super();
    init(this, options, instance$6, create_fragment$6, safe_not_equal, {
      cancelIcon: 0,
      step: 2
    });
  }
}

/* src/components/shepherd-title.svelte generated by Svelte v4.2.19 */
function create_fragment$5(ctx) {
  let h3;
  return {
    c() {
      h3 = element("h3");
      attr(h3, "id", /*labelId*/ctx[1]);
      attr(h3, "class", "shepherd-title");
    },
    m(target, anchor) {
      insert(target, h3, anchor);
      /*h3_binding*/
      ctx[3](h3);
    },
    p(ctx, [dirty]) {
      if (dirty & /*labelId*/2) {
        attr(h3, "id", /*labelId*/ctx[1]);
      }
    },
    i: noop,
    o: noop,
    d(detaching) {
      if (detaching) {
        detach(h3);
      }

      /*h3_binding*/
      ctx[3](null);
    }
  };
}
function instance$5($$self, $$props, $$invalidate) {
  let {
    labelId,
    element,
    title
  } = $$props;
  afterUpdate(() => {
    if (isFunction(title)) {
      $$invalidate(2, title = title());
    }
    $$invalidate(0, element.innerHTML = title, element);
  });
  function h3_binding($$value) {
    binding_callbacks[$$value ? 'unshift' : 'push'](() => {
      element = $$value;
      $$invalidate(0, element);
    });
  }
  $$self.$$set = $$props => {
    if ('labelId' in $$props) $$invalidate(1, labelId = $$props.labelId);
    if ('element' in $$props) $$invalidate(0, element = $$props.element);
    if ('title' in $$props) $$invalidate(2, title = $$props.title);
  };
  return [element, labelId, title, h3_binding];
}
class Shepherd_title extends SvelteComponent {
  constructor(options) {
    super();
    init(this, options, instance$5, create_fragment$5, safe_not_equal, {
      labelId: 1,
      element: 0,
      title: 2
    });
  }
}

/* src/components/shepherd-header.svelte generated by Svelte v4.2.19 */
function create_if_block_1$1(ctx) {
  let shepherdtitle;
  let current;
  shepherdtitle = new Shepherd_title({
    props: {
      labelId: /*labelId*/ctx[0],
      title: /*title*/ctx[2]
    }
  });
  return {
    c() {
      create_component(shepherdtitle.$$.fragment);
    },
    m(target, anchor) {
      mount_component(shepherdtitle, target, anchor);
      current = true;
    },
    p(ctx, dirty) {
      const shepherdtitle_changes = {};
      if (dirty & /*labelId*/1) shepherdtitle_changes.labelId = /*labelId*/ctx[0];
      if (dirty & /*title*/4) shepherdtitle_changes.title = /*title*/ctx[2];
      shepherdtitle.$set(shepherdtitle_changes);
    },
    i(local) {
      if (current) return;
      transition_in(shepherdtitle.$$.fragment, local);
      current = true;
    },
    o(local) {
      transition_out(shepherdtitle.$$.fragment, local);
      current = false;
    },
    d(detaching) {
      destroy_component(shepherdtitle, detaching);
    }
  };
}

// (19:2) {#if cancelIcon && cancelIcon.enabled}
function create_if_block$2(ctx) {
  let shepherdcancelicon;
  let current;
  shepherdcancelicon = new Shepherd_cancel_icon({
    props: {
      cancelIcon: /*cancelIcon*/ctx[3],
      step: /*step*/ctx[1]
    }
  });
  return {
    c() {
      create_component(shepherdcancelicon.$$.fragment);
    },
    m(target, anchor) {
      mount_component(shepherdcancelicon, target, anchor);
      current = true;
    },
    p(ctx, dirty) {
      const shepherdcancelicon_changes = {};
      if (dirty & /*cancelIcon*/8) shepherdcancelicon_changes.cancelIcon = /*cancelIcon*/ctx[3];
      if (dirty & /*step*/2) shepherdcancelicon_changes.step = /*step*/ctx[1];
      shepherdcancelicon.$set(shepherdcancelicon_changes);
    },
    i(local) {
      if (current) return;
      transition_in(shepherdcancelicon.$$.fragment, local);
      current = true;
    },
    o(local) {
      transition_out(shepherdcancelicon.$$.fragment, local);
      current = false;
    },
    d(detaching) {
      destroy_component(shepherdcancelicon, detaching);
    }
  };
}
function create_fragment$4(ctx) {
  let header;
  let t;
  let current;
  let if_block0 = /*title*/ctx[2] && create_if_block_1$1(ctx);
  let if_block1 = /*cancelIcon*/ctx[3] && /*cancelIcon*/ctx[3].enabled && create_if_block$2(ctx);
  return {
    c() {
      header = element("header");
      if (if_block0) if_block0.c();
      t = space();
      if (if_block1) if_block1.c();
      attr(header, "class", "shepherd-header");
    },
    m(target, anchor) {
      insert(target, header, anchor);
      if (if_block0) if_block0.m(header, null);
      append(header, t);
      if (if_block1) if_block1.m(header, null);
      current = true;
    },
    p(ctx, [dirty]) {
      if (/*title*/ctx[2]) {
        if (if_block0) {
          if_block0.p(ctx, dirty);
          if (dirty & /*title*/4) {
            transition_in(if_block0, 1);
          }
        } else {
          if_block0 = create_if_block_1$1(ctx);
          if_block0.c();
          transition_in(if_block0, 1);
          if_block0.m(header, t);
        }
      } else if (if_block0) {
        group_outros();
        transition_out(if_block0, 1, 1, () => {
          if_block0 = null;
        });
        check_outros();
      }
      if (/*cancelIcon*/ctx[3] && /*cancelIcon*/ctx[3].enabled) {
        if (if_block1) {
          if_block1.p(ctx, dirty);
          if (dirty & /*cancelIcon*/8) {
            transition_in(if_block1, 1);
          }
        } else {
          if_block1 = create_if_block$2(ctx);
          if_block1.c();
          transition_in(if_block1, 1);
          if_block1.m(header, null);
        }
      } else if (if_block1) {
        group_outros();
        transition_out(if_block1, 1, 1, () => {
          if_block1 = null;
        });
        check_outros();
      }
    },
    i(local) {
      if (current) return;
      transition_in(if_block0);
      transition_in(if_block1);
      current = true;
    },
    o(local) {
      transition_out(if_block0);
      transition_out(if_block1);
      current = false;
    },
    d(detaching) {
      if (detaching) {
        detach(header);
      }
      if (if_block0) if_block0.d();
      if (if_block1) if_block1.d();
    }
  };
}
function instance$4($$self, $$props, $$invalidate) {
  let {
    labelId,
    step
  } = $$props;
  let title, cancelIcon;
  $$self.$$set = $$props => {
    if ('labelId' in $$props) $$invalidate(0, labelId = $$props.labelId);
    if ('step' in $$props) $$invalidate(1, step = $$props.step);
  };
  $$self.$$.update = () => {
    if ($$self.$$.dirty & /*step*/2) {
      {
        $$invalidate(2, title = step.options.title);
        $$invalidate(3, cancelIcon = step.options.cancelIcon);
      }
    }
  };
  return [labelId, step, title, cancelIcon];
}
class Shepherd_header extends SvelteComponent {
  constructor(options) {
    super();
    init(this, options, instance$4, create_fragment$4, safe_not_equal, {
      labelId: 0,
      step: 1
    });
  }
}

/* src/components/shepherd-text.svelte generated by Svelte v4.2.19 */
function create_fragment$3(ctx) {
  let div;
  return {
    c() {
      div = element("div");
      attr(div, "class", "shepherd-text");
      attr(div, "id", /*descriptionId*/ctx[1]);
    },
    m(target, anchor) {
      insert(target, div, anchor);
      /*div_binding*/
      ctx[3](div);
    },
    p(ctx, [dirty]) {
      if (dirty & /*descriptionId*/2) {
        attr(div, "id", /*descriptionId*/ctx[1]);
      }
    },
    i: noop,
    o: noop,
    d(detaching) {
      if (detaching) {
        detach(div);
      }

      /*div_binding*/
      ctx[3](null);
    }
  };
}
function instance$3($$self, $$props, $$invalidate) {
  let {
    descriptionId,
    element,
    step
  } = $$props;
  afterUpdate(() => {
    let {
      text
    } = step.options;
    if (isFunction(text)) {
      text = text.call(step);
    }
    if (isHTMLElement$1(text)) {
      element.appendChild(text);
    } else {
      $$invalidate(0, element.innerHTML = text, element);
    }
  });
  function div_binding($$value) {
    binding_callbacks[$$value ? 'unshift' : 'push'](() => {
      element = $$value;
      $$invalidate(0, element);
    });
  }
  $$self.$$set = $$props => {
    if ('descriptionId' in $$props) $$invalidate(1, descriptionId = $$props.descriptionId);
    if ('element' in $$props) $$invalidate(0, element = $$props.element);
    if ('step' in $$props) $$invalidate(2, step = $$props.step);
  };
  return [element, descriptionId, step, div_binding];
}
class Shepherd_text extends SvelteComponent {
  constructor(options) {
    super();
    init(this, options, instance$3, create_fragment$3, safe_not_equal, {
      descriptionId: 1,
      element: 0,
      step: 2
    });
  }
}

/* src/components/shepherd-content.svelte generated by Svelte v4.2.19 */
function create_if_block_2(ctx) {
  let shepherdheader;
  let current;
  shepherdheader = new Shepherd_header({
    props: {
      labelId: /*labelId*/ctx[1],
      step: /*step*/ctx[2]
    }
  });
  return {
    c() {
      create_component(shepherdheader.$$.fragment);
    },
    m(target, anchor) {
      mount_component(shepherdheader, target, anchor);
      current = true;
    },
    p(ctx, dirty) {
      const shepherdheader_changes = {};
      if (dirty & /*labelId*/2) shepherdheader_changes.labelId = /*labelId*/ctx[1];
      if (dirty & /*step*/4) shepherdheader_changes.step = /*step*/ctx[2];
      shepherdheader.$set(shepherdheader_changes);
    },
    i(local) {
      if (current) return;
      transition_in(shepherdheader.$$.fragment, local);
      current = true;
    },
    o(local) {
      transition_out(shepherdheader.$$.fragment, local);
      current = false;
    },
    d(detaching) {
      destroy_component(shepherdheader, detaching);
    }
  };
}

// (15:2) {#if !isUndefined(step.options.text)}
function create_if_block_1(ctx) {
  let shepherdtext;
  let current;
  shepherdtext = new Shepherd_text({
    props: {
      descriptionId: /*descriptionId*/ctx[0],
      step: /*step*/ctx[2]
    }
  });
  return {
    c() {
      create_component(shepherdtext.$$.fragment);
    },
    m(target, anchor) {
      mount_component(shepherdtext, target, anchor);
      current = true;
    },
    p(ctx, dirty) {
      const shepherdtext_changes = {};
      if (dirty & /*descriptionId*/1) shepherdtext_changes.descriptionId = /*descriptionId*/ctx[0];
      if (dirty & /*step*/4) shepherdtext_changes.step = /*step*/ctx[2];
      shepherdtext.$set(shepherdtext_changes);
    },
    i(local) {
      if (current) return;
      transition_in(shepherdtext.$$.fragment, local);
      current = true;
    },
    o(local) {
      transition_out(shepherdtext.$$.fragment, local);
      current = false;
    },
    d(detaching) {
      destroy_component(shepherdtext, detaching);
    }
  };
}

// (19:2) {#if Array.isArray(step.options.buttons) && step.options.buttons.length}
function create_if_block$1(ctx) {
  let shepherdfooter;
  let current;
  shepherdfooter = new Shepherd_footer({
    props: {
      step: /*step*/ctx[2]
    }
  });
  return {
    c() {
      create_component(shepherdfooter.$$.fragment);
    },
    m(target, anchor) {
      mount_component(shepherdfooter, target, anchor);
      current = true;
    },
    p(ctx, dirty) {
      const shepherdfooter_changes = {};
      if (dirty & /*step*/4) shepherdfooter_changes.step = /*step*/ctx[2];
      shepherdfooter.$set(shepherdfooter_changes);
    },
    i(local) {
      if (current) return;
      transition_in(shepherdfooter.$$.fragment, local);
      current = true;
    },
    o(local) {
      transition_out(shepherdfooter.$$.fragment, local);
      current = false;
    },
    d(detaching) {
      destroy_component(shepherdfooter, detaching);
    }
  };
}
function create_fragment$2(ctx) {
  let div;
  let show_if_2 = !isUndefined(/*step*/ctx[2].options.title) || /*step*/ctx[2].options.cancelIcon && /*step*/ctx[2].options.cancelIcon.enabled;
  let t0;
  let show_if_1 = !isUndefined(/*step*/ctx[2].options.text);
  let t1;
  let show_if = Array.isArray(/*step*/ctx[2].options.buttons) && /*step*/ctx[2].options.buttons.length;
  let current;
  let if_block0 = show_if_2 && create_if_block_2(ctx);
  let if_block1 = show_if_1 && create_if_block_1(ctx);
  let if_block2 = show_if && create_if_block$1(ctx);
  return {
    c() {
      div = element("div");
      if (if_block0) if_block0.c();
      t0 = space();
      if (if_block1) if_block1.c();
      t1 = space();
      if (if_block2) if_block2.c();
      attr(div, "class", "shepherd-content");
    },
    m(target, anchor) {
      insert(target, div, anchor);
      if (if_block0) if_block0.m(div, null);
      append(div, t0);
      if (if_block1) if_block1.m(div, null);
      append(div, t1);
      if (if_block2) if_block2.m(div, null);
      current = true;
    },
    p(ctx, [dirty]) {
      if (dirty & /*step*/4) show_if_2 = !isUndefined(/*step*/ctx[2].options.title) || /*step*/ctx[2].options.cancelIcon && /*step*/ctx[2].options.cancelIcon.enabled;
      if (show_if_2) {
        if (if_block0) {
          if_block0.p(ctx, dirty);
          if (dirty & /*step*/4) {
            transition_in(if_block0, 1);
          }
        } else {
          if_block0 = create_if_block_2(ctx);
          if_block0.c();
          transition_in(if_block0, 1);
          if_block0.m(div, t0);
        }
      } else if (if_block0) {
        group_outros();
        transition_out(if_block0, 1, 1, () => {
          if_block0 = null;
        });
        check_outros();
      }
      if (dirty & /*step*/4) show_if_1 = !isUndefined(/*step*/ctx[2].options.text);
      if (show_if_1) {
        if (if_block1) {
          if_block1.p(ctx, dirty);
          if (dirty & /*step*/4) {
            transition_in(if_block1, 1);
          }
        } else {
          if_block1 = create_if_block_1(ctx);
          if_block1.c();
          transition_in(if_block1, 1);
          if_block1.m(div, t1);
        }
      } else if (if_block1) {
        group_outros();
        transition_out(if_block1, 1, 1, () => {
          if_block1 = null;
        });
        check_outros();
      }
      if (dirty & /*step*/4) show_if = Array.isArray(/*step*/ctx[2].options.buttons) && /*step*/ctx[2].options.buttons.length;
      if (show_if) {
        if (if_block2) {
          if_block2.p(ctx, dirty);
          if (dirty & /*step*/4) {
            transition_in(if_block2, 1);
          }
        } else {
          if_block2 = create_if_block$1(ctx);
          if_block2.c();
          transition_in(if_block2, 1);
          if_block2.m(div, null);
        }
      } else if (if_block2) {
        group_outros();
        transition_out(if_block2, 1, 1, () => {
          if_block2 = null;
        });
        check_outros();
      }
    },
    i(local) {
      if (current) return;
      transition_in(if_block0);
      transition_in(if_block1);
      transition_in(if_block2);
      current = true;
    },
    o(local) {
      transition_out(if_block0);
      transition_out(if_block1);
      transition_out(if_block2);
      current = false;
    },
    d(detaching) {
      if (detaching) {
        detach(div);
      }
      if (if_block0) if_block0.d();
      if (if_block1) if_block1.d();
      if (if_block2) if_block2.d();
    }
  };
}
function instance$2($$self, $$props, $$invalidate) {
  let {
    descriptionId,
    labelId,
    step
  } = $$props;
  $$self.$$set = $$props => {
    if ('descriptionId' in $$props) $$invalidate(0, descriptionId = $$props.descriptionId);
    if ('labelId' in $$props) $$invalidate(1, labelId = $$props.labelId);
    if ('step' in $$props) $$invalidate(2, step = $$props.step);
  };
  return [descriptionId, labelId, step];
}
class Shepherd_content extends SvelteComponent {
  constructor(options) {
    super();
    init(this, options, instance$2, create_fragment$2, safe_not_equal, {
      descriptionId: 0,
      labelId: 1,
      step: 2
    });
  }
}

/* src/components/shepherd-element.svelte generated by Svelte v4.2.19 */
function create_if_block(ctx) {
  let div;
  return {
    c() {
      div = element("div");
      attr(div, "class", "shepherd-arrow");
      attr(div, "data-popper-arrow", "");
    },
    m(target, anchor) {
      insert(target, div, anchor);
    },
    d(detaching) {
      if (detaching) {
        detach(div);
      }
    }
  };
}
function create_fragment$1(ctx) {
  let dialog;
  let t;
  let shepherdcontent;
  let dialog_aria_describedby_value;
  let dialog_aria_labelledby_value;
  let current;
  let mounted;
  let dispose;
  let if_block = /*step*/ctx[4].options.arrow && /*step*/ctx[4].options.attachTo && /*step*/ctx[4].options.attachTo.element && /*step*/ctx[4].options.attachTo.on && create_if_block();
  shepherdcontent = new Shepherd_content({
    props: {
      descriptionId: /*descriptionId*/ctx[2],
      labelId: /*labelId*/ctx[3],
      step: /*step*/ctx[4]
    }
  });
  let dialog_levels = [{
    "aria-describedby": dialog_aria_describedby_value = !isUndefined(/*step*/ctx[4].options.text) ? /*descriptionId*/ctx[2] : null
  }, {
    "aria-labelledby": dialog_aria_labelledby_value = /*step*/ctx[4].options.title ? /*labelId*/ctx[3] : null
  }, /*dataStepId*/ctx[1], {
    open: "true"
  }];
  let dialog_data = {};
  for (let i = 0; i < dialog_levels.length; i += 1) {
    dialog_data = assign(dialog_data, dialog_levels[i]);
  }
  return {
    c() {
      dialog = element("dialog");
      if (if_block) if_block.c();
      t = space();
      create_component(shepherdcontent.$$.fragment);
      set_attributes(dialog, dialog_data);
      toggle_class(dialog, "shepherd-has-cancel-icon", /*hasCancelIcon*/ctx[5]);
      toggle_class(dialog, "shepherd-has-title", /*hasTitle*/ctx[6]);
      toggle_class(dialog, "shepherd-element", true);
    },
    m(target, anchor) {
      insert(target, dialog, anchor);
      if (if_block) if_block.m(dialog, null);
      append(dialog, t);
      mount_component(shepherdcontent, dialog, null);
      /*dialog_binding*/
      ctx[18](dialog);
      current = true;
      if (!mounted) {
        dispose = listen(dialog, "keydown", /*handleKeyDown*/ctx[7]);
        mounted = true;
      }
    },
    p(ctx, [dirty]) {
      if (/*step*/ctx[4].options.arrow && /*step*/ctx[4].options.attachTo && /*step*/ctx[4].options.attachTo.element && /*step*/ctx[4].options.attachTo.on) {
        if (if_block) ; else {
          if_block = create_if_block();
          if_block.c();
          if_block.m(dialog, t);
        }
      } else if (if_block) {
        if_block.d(1);
        if_block = null;
      }
      const shepherdcontent_changes = {};
      if (dirty & /*descriptionId*/4) shepherdcontent_changes.descriptionId = /*descriptionId*/ctx[2];
      if (dirty & /*labelId*/8) shepherdcontent_changes.labelId = /*labelId*/ctx[3];
      if (dirty & /*step*/16) shepherdcontent_changes.step = /*step*/ctx[4];
      shepherdcontent.$set(shepherdcontent_changes);
      set_attributes(dialog, dialog_data = get_spread_update(dialog_levels, [(!current || dirty & /*step, descriptionId*/20 && dialog_aria_describedby_value !== (dialog_aria_describedby_value = !isUndefined(/*step*/ctx[4].options.text) ? /*descriptionId*/ctx[2] : null)) && {
        "aria-describedby": dialog_aria_describedby_value
      }, (!current || dirty & /*step, labelId*/24 && dialog_aria_labelledby_value !== (dialog_aria_labelledby_value = /*step*/ctx[4].options.title ? /*labelId*/ctx[3] : null)) && {
        "aria-labelledby": dialog_aria_labelledby_value
      }, dirty & /*dataStepId*/2 && /*dataStepId*/ctx[1], {
        open: "true"
      }]));
      toggle_class(dialog, "shepherd-has-cancel-icon", /*hasCancelIcon*/ctx[5]);
      toggle_class(dialog, "shepherd-has-title", /*hasTitle*/ctx[6]);
      toggle_class(dialog, "shepherd-element", true);
    },
    i(local) {
      if (current) return;
      transition_in(shepherdcontent.$$.fragment, local);
      current = true;
    },
    o(local) {
      transition_out(shepherdcontent.$$.fragment, local);
      current = false;
    },
    d(detaching) {
      if (detaching) {
        detach(dialog);
      }
      if (if_block) if_block.d();
      destroy_component(shepherdcontent);
      /*dialog_binding*/
      ctx[18](null);
      mounted = false;
      dispose();
    }
  };
}
const KEY_TAB = 9;
const KEY_ESC = 27;
const LEFT_ARROW = 37;
const RIGHT_ARROW = 39;
function getClassesArray(classes) {
  return classes.split(' ').filter(className => !!className.length);
}
function instance$1($$self, $$props, $$invalidate) {
  let {
    attachToElement,
    attachTofocusableDialogElements,
    classPrefix,
    element,
    descriptionId,
    focusableAttachToElements,
    firstFocusableAttachToElement,
    lastFocusableAttachToElement,
    firstFocusableDialogElement,
    focusableDialogElements,
    lastFocusableDialogElement,
    labelId,
    step,
    dataStepId
  } = $$props;
  let hasCancelIcon, hasTitle, classes;
  const getElement = () => element;
  onMount(() => {
    // Get all elements that are focusable
    $$invalidate(1, dataStepId = {
      [`data-${classPrefix}shepherd-step-id`]: step.id
    });
    $$invalidate(13, focusableDialogElements = [...element.querySelectorAll('a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]')]);
    $$invalidate(12, firstFocusableDialogElement = focusableDialogElements[0]);
    $$invalidate(14, lastFocusableDialogElement = focusableDialogElements[focusableDialogElements.length - 1]);
    const attachTo = step._getResolvedAttachToOptions();
    if (attachTo != null && attachTo.element) {
      $$invalidate(8, attachToElement = attachTo.element);
      $$invalidate(8, attachToElement.tabIndex = 0, attachToElement);
      $$invalidate(9, focusableAttachToElements = [attachToElement, ...attachToElement.querySelectorAll('a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]')]);
      $$invalidate(10, firstFocusableAttachToElement = focusableAttachToElements[0]);
      $$invalidate(11, lastFocusableAttachToElement = focusableAttachToElements[focusableAttachToElements.length - 1]);

      // Add keydown listener to attachTo element
      attachToElement.addEventListener('keydown', handleKeyDown);
    }
  });
  onDestroy(() => {
    var _attachToElement;
    (_attachToElement = attachToElement) == null || _attachToElement.removeEventListener('keydown', handleKeyDown);
  });
  afterUpdate(() => {
    if (classes !== step.options.classes) {
      updateDynamicClasses();
    }
  });
  function updateDynamicClasses() {
    removeClasses(classes);
    classes = step.options.classes;
    addClasses(classes);
  }
  function removeClasses(classes) {
    if (isString(classes)) {
      const oldClasses = getClassesArray(classes);
      if (oldClasses.length) {
        element.classList.remove(...oldClasses);
      }
    }
  }
  function addClasses(classes) {
    if (isString(classes)) {
      const newClasses = getClassesArray(classes);
      if (newClasses.length) {
        element.classList.add(...newClasses);
      }
    }
  }

  /**
  * Setup keydown events to allow closing the modal with ESC
  *
  * Borrowed from this great post! https://bitsofco.de/accessible-modal-dialog/
  *
  * @private
  */
  const handleKeyDown = e => {
    const {
      tour
    } = step;
    switch (e.keyCode) {
      case KEY_TAB:
        if ((!focusableAttachToElements || focusableAttachToElements.length === 0) && focusableDialogElements.length === 0) {
          e.preventDefault();
          break;
        }
        // Backward tab
        if (e.shiftKey) {
          // If at the beginning of elements in the dialog, go to last element in attachTo
          // If attachToElement is undefined, circle around to the last element in the dialog.
          if (document.activeElement === firstFocusableDialogElement || document.activeElement.classList.contains('shepherd-element')) {
            var _lastFocusableAttachT;
            e.preventDefault();
            ((_lastFocusableAttachT = lastFocusableAttachToElement) != null ? _lastFocusableAttachT : lastFocusableDialogElement).focus();
          } else
            // If at the beginning of elements in attachTo
            if (document.activeElement === firstFocusableAttachToElement) {
              e.preventDefault();
              lastFocusableDialogElement.focus();
            }
        } else {
          if (document.activeElement === lastFocusableDialogElement) {
            var _firstFocusableAttach;
            e.preventDefault();
            ((_firstFocusableAttach = firstFocusableAttachToElement) != null ? _firstFocusableAttach : firstFocusableDialogElement).focus();
          } else
            // If at the end of elements in attachTo
            if (document.activeElement === lastFocusableAttachToElement) {
              e.preventDefault();
              firstFocusableDialogElement.focus();
            }
        }
        break;
      case KEY_ESC:
        if (tour.options.exitOnEsc) {
          e.preventDefault();
          e.stopPropagation();
          step.cancel();
        }
        break;
      case LEFT_ARROW:
        if (tour.options.keyboardNavigation) {
          e.preventDefault();
          e.stopPropagation();
          tour.back();
        }
        break;
      case RIGHT_ARROW:
        if (tour.options.keyboardNavigation) {
          e.preventDefault();
          e.stopPropagation();
          tour.next();
        }
        break;
    }
  };
  function dialog_binding($$value) {
    binding_callbacks[$$value ? 'unshift' : 'push'](() => {
      element = $$value;
      $$invalidate(0, element);
    });
  }
  $$self.$$set = $$props => {
    if ('attachToElement' in $$props) $$invalidate(8, attachToElement = $$props.attachToElement);
    if ('attachTofocusableDialogElements' in $$props) $$invalidate(15, attachTofocusableDialogElements = $$props.attachTofocusableDialogElements);
    if ('classPrefix' in $$props) $$invalidate(16, classPrefix = $$props.classPrefix);
    if ('element' in $$props) $$invalidate(0, element = $$props.element);
    if ('descriptionId' in $$props) $$invalidate(2, descriptionId = $$props.descriptionId);
    if ('focusableAttachToElements' in $$props) $$invalidate(9, focusableAttachToElements = $$props.focusableAttachToElements);
    if ('firstFocusableAttachToElement' in $$props) $$invalidate(10, firstFocusableAttachToElement = $$props.firstFocusableAttachToElement);
    if ('lastFocusableAttachToElement' in $$props) $$invalidate(11, lastFocusableAttachToElement = $$props.lastFocusableAttachToElement);
    if ('firstFocusableDialogElement' in $$props) $$invalidate(12, firstFocusableDialogElement = $$props.firstFocusableDialogElement);
    if ('focusableDialogElements' in $$props) $$invalidate(13, focusableDialogElements = $$props.focusableDialogElements);
    if ('lastFocusableDialogElement' in $$props) $$invalidate(14, lastFocusableDialogElement = $$props.lastFocusableDialogElement);
    if ('labelId' in $$props) $$invalidate(3, labelId = $$props.labelId);
    if ('step' in $$props) $$invalidate(4, step = $$props.step);
    if ('dataStepId' in $$props) $$invalidate(1, dataStepId = $$props.dataStepId);
  };
  $$self.$$.update = () => {
    if ($$self.$$.dirty & /*step*/16) {
      {
        $$invalidate(5, hasCancelIcon = step.options && step.options.cancelIcon && step.options.cancelIcon.enabled);
        $$invalidate(6, hasTitle = step.options && step.options.title);
      }
    }
  };
  return [element, dataStepId, descriptionId, labelId, step, hasCancelIcon, hasTitle, handleKeyDown, attachToElement, focusableAttachToElements, firstFocusableAttachToElement, lastFocusableAttachToElement, firstFocusableDialogElement, focusableDialogElements, lastFocusableDialogElement, attachTofocusableDialogElements, classPrefix, getElement, dialog_binding];
}
class Shepherd_element extends SvelteComponent {
  constructor(options) {
    super();
    init(this, options, instance$1, create_fragment$1, safe_not_equal, {
      attachToElement: 8,
      attachTofocusableDialogElements: 15,
      classPrefix: 16,
      element: 0,
      descriptionId: 2,
      focusableAttachToElements: 9,
      firstFocusableAttachToElement: 10,
      lastFocusableAttachToElement: 11,
      firstFocusableDialogElement: 12,
      focusableDialogElements: 13,
      lastFocusableDialogElement: 14,
      labelId: 3,
      step: 4,
      dataStepId: 1,
      getElement: 17
    });
  }
  get getElement() {
    return this.$$.ctx[17];
  }
}

/**
 * The options for the step
 */

/**
 * A class representing steps to be added to a tour.
 * @extends {Evented}
 */
class Step extends Evented {
  constructor(tour, options = {}) {
    super();
    this._resolvedAttachTo = void 0;
    this._resolvedExtraHighlightElements = void 0;
    this.classPrefix = void 0;
    this.el = void 0;
    this.target = void 0;
    this.tour = void 0;
    this.tour = tour;
    this.classPrefix = this.tour.options ? normalizePrefix(this.tour.options.classPrefix) : '';
    // @ts-expect-error TODO: investigate where styles comes from
    this.styles = tour.styles;

    /**
     * Resolved attachTo options. Due to lazy evaluation, we only resolve the options during `before-show` phase.
     * Do not use this directly, use the _getResolvedAttachToOptions method instead.
     * @type {StepOptionsAttachTo | null}
     * @private
     */
    this._resolvedAttachTo = null;
    autoBind(this);
    this._setOptions(options);
    return this;
  }

  /**
   * Cancel the tour
   * Triggers the `cancel` event
   */
  cancel() {
    this.tour.cancel();
    this.trigger('cancel');
  }

  /**
   * Complete the tour
   * Triggers the `complete` event
   */
  complete() {
    this.tour.complete();
    this.trigger('complete');
  }

  /**
   * Remove the step, delete the step's element, and destroy the FloatingUI instance for the step.
   * Triggers `destroy` event
   */
  destroy() {
    destroyTooltip(this);
    if (isHTMLElement$1(this.el)) {
      this.el.remove();
      this.el = null;
    }
    this._updateStepTargetOnHide();
    this.trigger('destroy');
  }

  /**
   * Returns the tour for the step
   * @return The tour instance
   */
  getTour() {
    return this.tour;
  }

  /**
   * Hide the step
   */
  hide() {
    var _this$tour$modal;
    (_this$tour$modal = this.tour.modal) == null || _this$tour$modal.hide();
    this.trigger('before-hide');
    if (this.el) {
      this.el.hidden = true;
    }
    this._updateStepTargetOnHide();
    this.trigger('hide');
  }

  /**
   * Resolves attachTo options.
   * @returns {{}|{element, on}}
   */
  _resolveExtraHiglightElements() {
    this._resolvedExtraHighlightElements = parseExtraHighlights(this);
    return this._resolvedExtraHighlightElements;
  }

  /**
   * Resolves attachTo options.
   * @returns {{}|{element, on}}
   */
  _resolveAttachToOptions() {
    this._resolvedAttachTo = parseAttachTo(this);
    return this._resolvedAttachTo;
  }

  /**
   * A selector for resolved attachTo options.
   * @returns {{}|{element, on}}
   * @private
   */
  _getResolvedAttachToOptions() {
    if (this._resolvedAttachTo === null) {
      return this._resolveAttachToOptions();
    }
    return this._resolvedAttachTo;
  }

  /**
   * Check if the step is open and visible
   * @return True if the step is open and visible
   */
  isOpen() {
    return Boolean(this.el && !this.el.hidden);
  }

  /**
   * Wraps `_show` and ensures `beforeShowPromise` resolves before calling show
   */
  show() {
    if (isFunction(this.options.beforeShowPromise)) {
      return Promise.resolve(this.options.beforeShowPromise()).then(() => this._show());
    }
    return Promise.resolve(this._show());
  }

  /**
   * Updates the options of the step.
   *
   * @param {StepOptions} options The options for the step
   */
  updateStepOptions(options) {
    Object.assign(this.options, options);

    // @ts-expect-error TODO: get types for Svelte components
    if (this.shepherdElementComponent) {
      // @ts-expect-error TODO: get types for Svelte components
      this.shepherdElementComponent.$set({
        step: this
      });
    }
  }

  /**
   * Returns the element for the step
   * @return {HTMLElement|null|undefined} The element instance. undefined if it has never been shown, null if it has been destroyed
   */
  getElement() {
    return this.el;
  }

  /**
   * Returns the target for the step
   * @return {HTMLElement|null|undefined} The element instance. undefined if it has never been shown, null if query string has not been found
   */
  getTarget() {
    return this.target;
  }

  /**
   * Creates Shepherd element for step based on options
   *
   * @return {HTMLElement} The DOM element for the step tooltip
   * @private
   */
  _createTooltipContent() {
    const descriptionId = `${this.id}-description`;
    const labelId = `${this.id}-label`;

    // @ts-expect-error TODO: get types for Svelte components
    this.shepherdElementComponent = new Shepherd_element({
      target: this.tour.options.stepsContainer || document.body,
      props: {
        classPrefix: this.classPrefix,
        descriptionId,
        labelId,
        step: this,
        // @ts-expect-error TODO: investigate where styles comes from
        styles: this.styles
      }
    });

    // @ts-expect-error TODO: get types for Svelte components
    return this.shepherdElementComponent.getElement();
  }

  /**
   * If a custom scrollToHandler is defined, call that, otherwise do the generic
   * scrollIntoView call.
   *
   * @param {boolean | ScrollIntoViewOptions} scrollToOptions - If true, uses the default `scrollIntoView`,
   * if an object, passes that object as the params to `scrollIntoView` i.e. `{ behavior: 'smooth', block: 'center' }`
   * @private
   */
  _scrollTo(scrollToOptions) {
    const {
      element
    } = this._getResolvedAttachToOptions();
    if (isFunction(this.options.scrollToHandler)) {
      this.options.scrollToHandler(element);
    } else if (isElement$1(element) && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView(scrollToOptions);
    }
  }

  /**
   * _getClassOptions gets all possible classes for the step
   * @param {StepOptions} stepOptions The step specific options
   * @returns {string} unique string from array of classes
   */
  _getClassOptions(stepOptions) {
    const defaultStepOptions = this.tour && this.tour.options && this.tour.options.defaultStepOptions;
    const stepClasses = stepOptions.classes ? stepOptions.classes : '';
    const defaultStepOptionsClasses = defaultStepOptions && defaultStepOptions.classes ? defaultStepOptions.classes : '';
    const allClasses = [...stepClasses.split(' '), ...defaultStepOptionsClasses.split(' ')];
    const uniqClasses = new Set(allClasses);
    return Array.from(uniqClasses).join(' ').trim();
  }

  /**
   * Sets the options for the step, maps `when` to events, sets up buttons
   * @param options - The options for the step
   */
  _setOptions(options = {}) {
    let tourOptions = this.tour && this.tour.options && this.tour.options.defaultStepOptions;
    tourOptions = deepmerge({}, tourOptions || {});
    this.options = Object.assign({
      arrow: true
    }, tourOptions, options, mergeTooltipConfig(tourOptions, options));
    const {
      when
    } = this.options;
    this.options.classes = this._getClassOptions(options);
    this.destroy();
    this.id = this.options.id || `step-${uuid()}`;
    if (when) {
      Object.keys(when).forEach(event => {
        // @ts-expect-error TODO: fix this type error
        this.on(event, when[event], this);
      });
    }
  }

  /**
   * Create the element and set up the FloatingUI instance
   * @private
   */
  _setupElements() {
    if (!isUndefined(this.el)) {
      this.destroy();
    }
    this.el = this._createTooltipContent();
    if (this.options.advanceOn) {
      bindAdvance(this);
    }

    // The tooltip implementation details are handled outside of the Step
    // object.
    setupTooltip(this);
  }

  /**
   * Triggers `before-show`, generates the tooltip DOM content,
   * sets up a FloatingUI instance for the tooltip, then triggers `show`.
   * @private
   */
  _show() {
    var _this$tour$modal2;
    this.trigger('before-show');

    // Force resolve to make sure the options are updated on subsequent shows.
    this._resolveAttachToOptions();
    this._resolveExtraHiglightElements();
    this._setupElements();
    if (!this.tour.modal) {
      this.tour.setupModal();
    }
    (_this$tour$modal2 = this.tour.modal) == null || _this$tour$modal2.setupForStep(this);
    this._styleTargetElementForStep(this);
    if (this.el) {
      this.el.hidden = false;
    }

    // start scrolling to target before showing the step
    if (this.options.scrollTo) {
      setTimeout(() => {
        this._scrollTo(this.options.scrollTo);
      });
    }
    if (this.el) {
      this.el.hidden = false;
    }

    // @ts-expect-error TODO: get types for Svelte components
    const content = this.shepherdElementComponent.getElement();
    const target = this.target || document.body;
    const extraHighlightElements = this._resolvedExtraHighlightElements;
    target.classList.add(`${this.classPrefix}shepherd-enabled`);
    target.classList.add(`${this.classPrefix}shepherd-target`);
    content.classList.add('shepherd-enabled');
    extraHighlightElements == null || extraHighlightElements.forEach(el => {
      el.classList.add(`${this.classPrefix}shepherd-enabled`);
      el.classList.add(`${this.classPrefix}shepherd-target`);
    });
    this.trigger('show');
  }

  /**
   * Modulates the styles of the passed step's target element, based on the step's options and
   * the tour's `modal` option, to visually emphasize the element
   *
   * @param {Step} step The step object that attaches to the element
   * @private
   */
  _styleTargetElementForStep(step) {
    const targetElement = step.target;
    const extraHighlightElements = step._resolvedExtraHighlightElements;
    if (!targetElement) {
      return;
    }
    const highlightClass = step.options.highlightClass;
    if (highlightClass) {
      targetElement.classList.add(highlightClass);
      extraHighlightElements == null || extraHighlightElements.forEach(el => el.classList.add(highlightClass));
    }
    targetElement.classList.remove('shepherd-target-click-disabled');
    extraHighlightElements == null || extraHighlightElements.forEach(el => el.classList.remove('shepherd-target-click-disabled'));
    if (step.options.canClickTarget === false) {
      targetElement.classList.add('shepherd-target-click-disabled');
      extraHighlightElements == null || extraHighlightElements.forEach(el => el.classList.add('shepherd-target-click-disabled'));
    }
  }

  /**
   * When a step is hidden, remove the highlightClass and 'shepherd-enabled'
   * and 'shepherd-target' classes
   * @private
   */
  _updateStepTargetOnHide() {
    const target = this.target || document.body;
    const extraHighlightElements = this._resolvedExtraHighlightElements;
    const highlightClass = this.options.highlightClass;
    if (highlightClass) {
      target.classList.remove(highlightClass);
      extraHighlightElements == null || extraHighlightElements.forEach(el => el.classList.remove(highlightClass));
    }
    target.classList.remove('shepherd-target-click-disabled', `${this.classPrefix}shepherd-enabled`, `${this.classPrefix}shepherd-target`);
    extraHighlightElements == null || extraHighlightElements.forEach(el => {
      el.classList.remove('shepherd-target-click-disabled', `${this.classPrefix}shepherd-enabled`, `${this.classPrefix}shepherd-target`);
    });
  }
}

/**
 * Cleanup the steps and set pointerEvents back to 'auto'
 * @param tour The tour object
 */
function cleanupSteps(tour) {
  if (tour) {
    const {
      steps
    } = tour;
    steps.forEach(step => {
      if (step.options && step.options.canClickTarget === false && step.options.attachTo) {
        if (isHTMLElement$1(step.target)) {
          step.target.classList.remove('shepherd-target-click-disabled');
        }
        if (step._resolvedExtraHighlightElements) {
          step._resolvedExtraHighlightElements.forEach(element => {
            if (isHTMLElement$1(element)) {
              element.classList.remove('shepherd-target-click-disabled');
            }
          });
        }
      }
    });
  }
}

/**
 * Generates the svg path data for a rounded rectangle overlay
 * @param dimension - Dimensions of rectangle.
 * @param dimension.width - Width.
 * @param dimension.height - Height.
 * @param dimension.x - Offset from top left corner in x axis. default 0.
 * @param dimension.y - Offset from top left corner in y axis. default 0.
 * @param dimension.r - Corner Radius. Keep this smaller than half of width or height.
 * @returns Rounded rectangle overlay path data.
 */
function makeOverlayPath(overlayPaths) {
  let openings = '';
  const {
    innerWidth: w,
    innerHeight: h
  } = window;
  overlayPaths.forEach(overlayPath => {
    const {
      width,
      height,
      x = 0,
      y = 0,
      r = 0
    } = overlayPath;
    const {
      topLeft = 0,
      topRight = 0,
      bottomRight = 0,
      bottomLeft = 0
    } = typeof r === 'number' ? {
      topLeft: r,
      topRight: r,
      bottomRight: r,
      bottomLeft: r
    } : r;
    openings += `M${x + topLeft},${y}\
      a${topLeft},${topLeft},0,0,0-${topLeft},${topLeft}\
      V${height + y - bottomLeft}\
      a${bottomLeft},${bottomLeft},0,0,0,${bottomLeft},${bottomLeft}\
      H${width + x - bottomRight}\
      a${bottomRight},${bottomRight},0,0,0,${bottomRight}-${bottomRight}\
      V${y + topRight}\
      a${topRight},${topRight},0,0,0-${topRight}-${topRight}\
      Z`;
  });
  return `M${w},${h}\
          H0\
          V0\
          H${w}\
          V${h}\
          Z\
          ${openings}`.replace(/\s/g, '');
}

/* src/components/shepherd-modal.svelte generated by Svelte v4.2.19 */
function create_fragment(ctx) {
  let svg;
  let path;
  let svg_class_value;
  let mounted;
  let dispose;
  return {
    c() {
      svg = svg_element("svg");
      path = svg_element("path");
      attr(path, "d", /*pathDefinition*/ctx[2]);
      attr(svg, "class", svg_class_value = `${/*modalIsVisible*/ctx[1] ? 'shepherd-modal-is-visible' : ''} shepherd-modal-overlay-container`);
    },
    m(target, anchor) {
      insert(target, svg, anchor);
      append(svg, path);
      /*svg_binding*/
      ctx[11](svg);
      if (!mounted) {
        dispose = listen(svg, "touchmove", /*_preventModalOverlayTouch*/ctx[3]);
        mounted = true;
      }
    },
    p(ctx, [dirty]) {
      if (dirty & /*pathDefinition*/4) {
        attr(path, "d", /*pathDefinition*/ctx[2]);
      }
      if (dirty & /*modalIsVisible*/2 && svg_class_value !== (svg_class_value = `${/*modalIsVisible*/ctx[1] ? 'shepherd-modal-is-visible' : ''} shepherd-modal-overlay-container`)) {
        attr(svg, "class", svg_class_value);
      }
    },
    i: noop,
    o: noop,
    d(detaching) {
      if (detaching) {
        detach(svg);
      }

      /*svg_binding*/
      ctx[11](null);
      mounted = false;
      dispose();
    }
  };
}
function _getScrollParent(element) {
  if (!element) {
    return null;
  }
  const isHtmlElement = element instanceof HTMLElement;
  const overflowY = isHtmlElement && window.getComputedStyle(element).overflowY;
  const isScrollable = overflowY !== 'hidden' && overflowY !== 'visible';
  if (isScrollable && element.scrollHeight >= element.clientHeight) {
    return element;
  }
  return _getScrollParent(element.parentElement);
}

/**
 * Get the top and left offset required to position the modal overlay cutout
 * when the target element is within an iframe
 * @param {HTMLElement} element The target element
 * @private
 */
function _getIframeOffset(element) {
  let offset = {
    top: 0,
    left: 0
  };
  if (!element) {
    return offset;
  }
  let targetWindow = element.ownerDocument.defaultView;
  while (targetWindow !== window.top) {
    var _targetWindow;
    const targetIframe = (_targetWindow = targetWindow) == null ? void 0 : _targetWindow.frameElement;
    if (targetIframe) {
      var _targetIframeRect$scr, _targetIframeRect$scr2;
      const targetIframeRect = targetIframe.getBoundingClientRect();
      offset.top += targetIframeRect.top + ((_targetIframeRect$scr = targetIframeRect.scrollTop) != null ? _targetIframeRect$scr : 0);
      offset.left += targetIframeRect.left + ((_targetIframeRect$scr2 = targetIframeRect.scrollLeft) != null ? _targetIframeRect$scr2 : 0);
    }
    targetWindow = targetWindow.parent;
  }
  return offset;
}

/**
 * Get the visible height of the target element relative to its scrollParent.
 * If there is no scroll parent, the height of the element is returned.
 *
 * @param {HTMLElement} element The target element
 * @param {HTMLElement} [scrollParent] The scrollable parent element
 * @returns {{y: number, height: number}}
 * @private
 */
function _getVisibleHeight(element, scrollParent) {
  const elementRect = element.getBoundingClientRect();
  let top = elementRect.y || elementRect.top;
  let bottom = elementRect.bottom || top + elementRect.height;
  if (scrollParent) {
    const scrollRect = scrollParent.getBoundingClientRect();
    const scrollTop = scrollRect.y || scrollRect.top;
    const scrollBottom = scrollRect.bottom || scrollTop + scrollRect.height;
    top = Math.max(top, scrollTop);
    bottom = Math.min(bottom, scrollBottom);
  }
  const height = Math.max(bottom - top, 0); // Default to 0 if height is negative
  return {
    y: top,
    height
  };
}
function instance($$self, $$props, $$invalidate) {
  let {
    element,
    openingProperties
  } = $$props;
  let modalIsVisible = false;
  let rafId = undefined;
  let pathDefinition;
  closeModalOpening();
  const getElement = () => element;
  function closeModalOpening() {
    $$invalidate(4, openingProperties = [{
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      r: 0
    }]);
  }
  function hide() {
    $$invalidate(1, modalIsVisible = false);

    // Ensure we cleanup all event listeners when we hide the modal
    _cleanupStepEventListeners();
  }
  function positionModal(modalOverlayOpeningPadding = 0, modalOverlayOpeningRadius = 0, modalOverlayOpeningXOffset = 0, modalOverlayOpeningYOffset = 0, scrollParent, targetElement, extraHighlights) {
    if (targetElement) {
      const elementsToHighlight = [targetElement, ...(extraHighlights || [])];
      $$invalidate(4, openingProperties = []);
      for (const element of elementsToHighlight) {
        if (!element) continue;

        // Skip duplicate elements
        if (elementsToHighlight.indexOf(element) !== elementsToHighlight.lastIndexOf(element)) {
          continue;
        }
        const {
          y,
          height
        } = _getVisibleHeight(element, scrollParent);
        const {
          x,
          width,
          left
        } = element.getBoundingClientRect();

        // Check if the element is contained by another element
        const isContained = elementsToHighlight.some(otherElement => {
          if (otherElement === element) return false;
          const otherRect = otherElement.getBoundingClientRect();
          return x >= otherRect.left && x + width <= otherRect.right && y >= otherRect.top && y + height <= otherRect.bottom;
        });
        if (isContained) continue;

        // getBoundingClientRect is not consistent. Some browsers use x and y, while others use left and top
        openingProperties.push({
          width: width + modalOverlayOpeningPadding * 2,
          height: height + modalOverlayOpeningPadding * 2,
          x: (x || left) + modalOverlayOpeningXOffset - modalOverlayOpeningPadding,
          y: y + modalOverlayOpeningYOffset - modalOverlayOpeningPadding,
          r: modalOverlayOpeningRadius
        });
      }
    } else {
      closeModalOpening();
    }
  }
  function setupForStep(step) {
    // Ensure we move listeners from the previous step, before we setup new ones
    _cleanupStepEventListeners();
    if (step.tour.options.useModalOverlay) {
      _styleForStep(step);
      show();
    } else {
      hide();
    }
  }
  function show() {
    $$invalidate(1, modalIsVisible = true);
  }
  const _preventModalBodyTouch = e => {
    e.preventDefault();
  };
  const _preventModalOverlayTouch = e => {
    e.stopPropagation();
  };

  /**
  * Add touchmove event listener
  * @private
  */
  function _addStepEventListeners() {
    // Prevents window from moving on touch.
    window.addEventListener('touchmove', _preventModalBodyTouch, {
      passive: false
    });
  }

  /**
  * Cancel the requestAnimationFrame loop and remove touchmove event listeners
  * @private
  */
  function _cleanupStepEventListeners() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = undefined;
    }
    window.removeEventListener('touchmove', _preventModalBodyTouch, {
      passive: false
    });
  }

  /**
  * Style the modal for the step
  * @param {Step} step The step to style the opening for
  * @private
  */
  function _styleForStep(step) {
    const {
      modalOverlayOpeningPadding,
      modalOverlayOpeningRadius,
      modalOverlayOpeningXOffset = 0,
      modalOverlayOpeningYOffset = 0
    } = step.options;
    const iframeOffset = _getIframeOffset(step.target);
    const scrollParent = _getScrollParent(step.target);

    // Setup recursive function to call requestAnimationFrame to update the modal opening position
    const rafLoop = () => {
      rafId = undefined;
      positionModal(modalOverlayOpeningPadding, modalOverlayOpeningRadius, modalOverlayOpeningXOffset + iframeOffset.left, modalOverlayOpeningYOffset + iframeOffset.top, scrollParent, step.target, step._resolvedExtraHighlightElements);
      rafId = requestAnimationFrame(rafLoop);
    };
    rafLoop();
    _addStepEventListeners();
  }
  function svg_binding($$value) {
    binding_callbacks[$$value ? 'unshift' : 'push'](() => {
      element = $$value;
      $$invalidate(0, element);
    });
  }
  $$self.$$set = $$props => {
    if ('element' in $$props) $$invalidate(0, element = $$props.element);
    if ('openingProperties' in $$props) $$invalidate(4, openingProperties = $$props.openingProperties);
  };
  $$self.$$.update = () => {
    if ($$self.$$.dirty & /*openingProperties*/16) {
      $$invalidate(2, pathDefinition = makeOverlayPath(openingProperties));
    }
  };
  return [element, modalIsVisible, pathDefinition, _preventModalOverlayTouch, openingProperties, getElement, closeModalOpening, hide, positionModal, setupForStep, show, svg_binding];
}
class Shepherd_modal extends SvelteComponent {
  constructor(options) {
    super();
    init(this, options, instance, create_fragment, safe_not_equal, {
      element: 0,
      openingProperties: 4,
      getElement: 5,
      closeModalOpening: 6,
      hide: 7,
      positionModal: 8,
      setupForStep: 9,
      show: 10
    });
  }
  get getElement() {
    return this.$$.ctx[5];
  }
  get closeModalOpening() {
    return this.$$.ctx[6];
  }
  get hide() {
    return this.$$.ctx[7];
  }
  get positionModal() {
    return this.$$.ctx[8];
  }
  get setupForStep() {
    return this.$$.ctx[9];
  }
  get show() {
    return this.$$.ctx[10];
  }
}

/**
 * The options for the tour
 */

class ShepherdBase extends Evented {
  constructor() {
    super();
    this.activeTour = void 0;
    autoBind(this);
  }
}

/**
 * Class representing the site tour
 * @extends {Evented}
 */
class Tour extends Evented {
  constructor(options = {}) {
    super();
    this.trackedEvents = ['active', 'cancel', 'complete', 'show'];
    this.classPrefix = void 0;
    this.currentStep = void 0;
    this.focusedElBeforeOpen = void 0;
    this.id = void 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.modal = void 0;
    this.options = void 0;
    this.steps = void 0;
    autoBind(this);
    const defaultTourOptions = {
      exitOnEsc: true,
      keyboardNavigation: true
    };
    this.options = Object.assign({}, defaultTourOptions, options);
    this.classPrefix = normalizePrefix(this.options.classPrefix);
    this.steps = [];
    this.addSteps(this.options.steps);

    // Pass these events onto the global Shepherd object
    const events = ['active', 'cancel', 'complete', 'inactive', 'show', 'start'];
    events.map(event => {
      (e => {
        this.on(e, opts => {
          opts = opts || {};
          opts['tour'] = this;
          Shepherd.trigger(e, opts);
        });
      })(event);
    });
    this._setTourID(options.id);
    return this;
  }

  /**
   * Adds a new step to the tour
   * @param {StepOptions} options - An object containing step options or a Step instance
   * @param {number | undefined} index - The optional index to insert the step at. If undefined, the step
   * is added to the end of the array.
   * @return The newly added step
   */
  addStep(options, index) {
    let step = options;
    if (!(step instanceof Step)) {
      step = new Step(this, step);
    } else {
      step.tour = this;
    }
    if (!isUndefined(index)) {
      this.steps.splice(index, 0, step);
    } else {
      this.steps.push(step);
    }
    return step;
  }

  /**
   * Add multiple steps to the tour
   * @param {Array<StepOptions> | Array<Step> | undefined} steps - The steps to add to the tour
   */
  addSteps(steps) {
    if (Array.isArray(steps)) {
      steps.forEach(step => {
        this.addStep(step);
      });
    }
    return this;
  }

  /**
   * Go to the previous step in the tour
   */
  back() {
    const index = this.steps.indexOf(this.currentStep);
    this.show(index - 1, false);
  }

  /**
   * Calls _done() triggering the 'cancel' event
   * If `confirmCancel` is true, will show a window.confirm before cancelling
   * If `confirmCancel` is a function, will call it and wait for the return value,
   * and only cancel when the value returned is true
   */
  async cancel() {
    if (this.options.confirmCancel) {
      const cancelMessage = this.options.confirmCancelMessage || 'Are you sure you want to stop the tour?';
      let stopTour;
      if (isFunction(this.options.confirmCancel)) {
        stopTour = await this.options.confirmCancel();
      } else {
        stopTour = window.confirm(cancelMessage);
      }
      if (stopTour) {
        this._done('cancel');
      }
    } else {
      this._done('cancel');
    }
  }

  /**
   * Calls _done() triggering the `complete` event
   */
  complete() {
    this._done('complete');
  }

  /**
   * Gets the step from a given id
   * @param {number | string} id - The id of the step to retrieve
   * @return The step corresponding to the `id`
   */
  getById(id) {
    return this.steps.find(step => {
      return step.id === id;
    });
  }

  /**
   * Gets the current step
   */
  getCurrentStep() {
    return this.currentStep;
  }

  /**
   * Hide the current step
   */
  hide() {
    const currentStep = this.getCurrentStep();
    if (currentStep) {
      return currentStep.hide();
    }
  }

  /**
   * Check if the tour is active
   */
  isActive() {
    return Shepherd.activeTour === this;
  }

  /**
   * Go to the next step in the tour
   * If we are at the end, call `complete`
   */
  next() {
    const index = this.steps.indexOf(this.currentStep);
    if (index === this.steps.length - 1) {
      this.complete();
    } else {
      this.show(index + 1, true);
    }
  }

  /**
   * Removes the step from the tour
   * @param {string} name - The id for the step to remove
   */
  removeStep(name) {
    const current = this.getCurrentStep();

    // Find the step, destroy it and remove it from this.steps
    this.steps.some((step, i) => {
      if (step.id === name) {
        if (step.isOpen()) {
          step.hide();
        }
        step.destroy();
        this.steps.splice(i, 1);
        return true;
      }
    });
    if (current && current.id === name) {
      this.currentStep = undefined;

      // If we have steps left, show the first one, otherwise just cancel the tour
      this.steps.length ? this.show(0) : this.cancel();
    }
  }

  /**
   * Show a specific step in the tour
   * @param {number | string} key - The key to look up the step by
   * @param {boolean} forward - True if we are going forward, false if backward
   */
  show(key = 0, forward = true) {
    const step = isString(key) ? this.getById(key) : this.steps[key];
    if (step) {
      this._updateStateBeforeShow();
      const shouldSkipStep = isFunction(step.options.showOn) && !step.options.showOn();

      // If `showOn` returns false, we want to skip the step, otherwise, show the step like normal
      if (shouldSkipStep) {
        this._skipStep(step, forward);
      } else {
        this.currentStep = step;
        this.trigger('show', {
          step,
          previous: this.currentStep
        });
        step.show();
      }
    }
  }

  /**
   * Start the tour
   */
  async start() {
    this.trigger('start');

    // Save the focused element before the tour opens
    this.focusedElBeforeOpen = document.activeElement;
    this.currentStep = null;
    this.setupModal();
    this._setupActiveTour();
    this.next();
  }

  /**
   * Called whenever the tour is cancelled or completed, basically anytime we exit the tour
   * @param {string} event - The event name to trigger
   * @private
   */
  _done(event) {
    const index = this.steps.indexOf(this.currentStep);
    if (Array.isArray(this.steps)) {
      this.steps.forEach(step => step.destroy());
    }
    cleanupSteps(this);
    this.trigger(event, {
      index
    });
    Shepherd.activeTour = null;
    this.trigger('inactive', {
      tour: this
    });
    if (this.modal) {
      this.modal.hide();
    }
    if (event === 'cancel' || event === 'complete') {
      if (this.modal) {
        const modalContainer = document.querySelector('.shepherd-modal-overlay-container');
        if (modalContainer) {
          modalContainer.remove();
          this.modal = null;
        }
      }
    }

    // Focus the element that was focused before the tour started
    if (isHTMLElement$1(this.focusedElBeforeOpen)) {
      this.focusedElBeforeOpen.focus();
    }
  }

  /**
   * Make this tour "active"
   */
  _setupActiveTour() {
    this.trigger('active', {
      tour: this
    });
    Shepherd.activeTour = this;
  }

  /**
   * setupModal create the modal container and instance
   */
  setupModal() {
    this.modal = new Shepherd_modal({
      target: this.options.modalContainer || document.body,
      props: {
        // @ts-expect-error TODO: investigate where styles comes from
        styles: this.styles
      }
    });
  }

  /**
   * Called when `showOn` evaluates to false, to skip the step or complete the tour if it's the last step
   * @param {Step} step - The step to skip
   * @param {boolean} forward - True if we are going forward, false if backward
   * @private
   */
  _skipStep(step, forward) {
    const index = this.steps.indexOf(step);
    if (index === this.steps.length - 1) {
      this.complete();
    } else {
      const nextIndex = forward ? index + 1 : index - 1;
      this.show(nextIndex, forward);
    }
  }

  /**
   * Before showing, hide the current step and if the tour is not
   * already active, call `this._setupActiveTour`.
   * @private
   */
  _updateStateBeforeShow() {
    if (this.currentStep) {
      this.currentStep.hide();
    }
    if (!this.isActive()) {
      this._setupActiveTour();
    }
  }

  /**
   * Sets this.id to a provided tourName and id or `${tourName}--${uuid}`
   * @param {string} optionsId - True if we are going forward, false if backward
   * @private
   */
  _setTourID(optionsId) {
    const tourName = this.options.tourName || 'tour';
    const tourId = optionsId || uuid();
    this.id = `${tourName}--${tourId}`;
  }
}

/**
 * @public
 */
const Shepherd = new ShepherdBase();

const isServerSide = typeof window === 'undefined';
Shepherd.Step = isServerSide ? StepNoOp : Step;
Shepherd.Tour = isServerSide ? TourNoOp : Tour;
// Reexport types so they can be more easily used.

export { ShepherdBase, Shepherd as default };
//# sourceMappingURL=shepherd.mjs.map
