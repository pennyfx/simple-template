
(function(){
  
  var win = window,
    doc = document,
    tags = {},
    tokens = [],
    domready = false,
    mutation = win.MutationObserver || win.WebKitMutationObserver ||  win.MozMutationObserver,
    _createElement = doc.createElement,
    register = function(name, options){
      name = name.toLowerCase();
      var base,
          token = name,
          options = options || {};
          
      if (!options.prototype) {
        throw new Error('Missing required prototype property for registration of the ' + name + ' element');
      }
      
      if (options.prototype && !('setAttribute' in options.prototype)) {
        throw new TypeError("Unexpected prototype for " + name + " element - custom element prototypes must inherit from the Element interface");
      }
      
      if (options.extends){
        var ancestor = (tags[options.extends] || _createElement.call(doc, options.extends)).constructor;
        if (ancestor != (win.HTMLUnknownElement || win.HTMLElement)) {
          base = options.extends;
          token = '[is="' + name + '"]';
        }
      }
      
      if (tokens.indexOf(token) == -1) tokens.push(token);
      
      var tag = tags[name] = {
        base: base,
        'constructor': function(){
          return doc.createElement(name);
        },
        _prototype: doc.__proto__ ? null : unwrapPrototype(options.prototype),
        'prototype': options.prototype
      };
      
      tag.constructor.prototype = tag.prototype;
      
      if (domready) query(doc, name).forEach(function(element){
        upgrade(element, true);
      });
      
      return tag.constructor;
    };
  
  function unwrapPrototype(proto){
    var definition = {},
        names = Object.getOwnPropertyNames(proto),
        index = names.length;
    if (index) while (index--) {
      definition[names[index]] = Object.getOwnPropertyDescriptor(proto, names[index]);
    }
    return definition;
  }
  
  var typeObj = {};
  function typeOf(obj) {
    return typeObj.toString.call(obj).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
  }
  
  function clone(item, type){
    var fn = clone[type || typeOf(item)];
    return fn ? fn(item) : item;
  }
    clone.object = function(src){
      var obj = {};
      for (var key in src) obj[key] = clone(src[key]);
      return obj;
    };
    clone.array = function(src){
      var i = src.length, array = new Array(i);
      while (i--) array[i] = clone(src[i]);
      return array;
    };
  
  var unsliceable = ['number', 'boolean', 'string', 'function'];
  function toArray(obj){
    return unsliceable.indexOf(typeOf(obj)) == -1 ? 
    Array.prototype.slice.call(obj, 0) :
    [obj];
  }
  
  function query(element, selector){
    return element && selector && selector.length ? toArray(element.querySelectorAll(selector)) : [];
  }
  
  function getTag(element){
    return element.getAttribute ? tags[element.getAttribute('is') || element.nodeName.toLowerCase()] : false;
  }
  
  function manipulate(element, fn){
    var next = element.nextSibling,
      parent = element.parentNode,
      frag = doc.createDocumentFragment(),
      returned = fn.call(frag.appendChild(element), frag) || element;
    if (next){
      parent.insertBefore(returned, next);
    }
    else{
      parent.appendChild(returned);
    }
  }
  
  function upgrade(element){
    if (!element._elementupgraded) {
      var tag = getTag(element);
      if (tag) {
        if (doc.__proto__) element.__proto__ = tag.prototype;
        else Object.defineProperties(element, tag._prototype);
        element.constructor = tag.constructor;
        element._elementupgraded = true;
        if (element.readyCallback) element.readyCallback.call(element, tag.prototype);
      }
    }
  }
  
  function inserted(element, event){
    var tag = getTag(element);
    if (tag){
      if (!element._elementupgraded) upgrade(element);
      else {
        if (doc.documentElement.contains(element) && element.insertedCallback) {
          element.insertedCallback.call(element);
        }
        insertChildren(element);
      }
    }
    else insertChildren(element);
  }

  function insertChildren(element){
    if (element.childNodes.length) query(element, tokens).forEach(function(el){
      if (!el._elementupgraded) upgrade(el);
      if (el.insertedCallback) el.insertedCallback.call(el);
    });
  }
  
  function removed(element){
    if (element._elementupgraded) {
      if (element.removedCallback) element.removedCallback.call(element);
      if (element.childNodes.length) query(element, tokens).forEach(function(el){
        removed(el);
      });
    }
  }
  
  function addObserver(element, type, fn){
    if (!element._records) {
      element._records = { inserted: [], removed: [] };
      if (mutation){
        element._observer = new mutation(function(mutations) {
          parseMutations(element, mutations);
        });
        element._observer.observe(element, {
          subtree: true,
          childList: true,
          attributes: !true,
          characterData: false
        });
      }
      else ['Inserted', 'Removed'].forEach(function(type){
        element.addEventListener('DOMNode' + type, function(event){
          event._mutation = true;
          element._records[type.toLowerCase()].forEach(function(fn){
            fn(event.target, event);
          });
        }, false);
      });
    }
    if (element._records[type].indexOf(fn) == -1) element._records[type].push(fn);
  }
  
  function removeObserver(element, type, fn){
    var obj = element._records;
    if (obj && fn){
      obj[type].splice(obj[type].indexOf(fn), 1);
    }
    else{
      obj[type] = [];
    }
  }
    
  function parseMutations(element, mutations) {
    var diff = { added: [], removed: [] };
    mutations.forEach(function(record){
      record._mutation = true;
      for (var z in diff) {
        var type = element._records[(z == 'added') ? 'inserted' : 'removed'],
          nodes = record[z + 'Nodes'], length = nodes.length;
        for (var i = 0; i < length && diff[z].indexOf(nodes[i]) == -1; i++){
          diff[z].push(nodes[i]);
          type.forEach(function(fn){
            fn(nodes[i], record);
          });
        }
      }
    });
  }
    
  function fireEvent(element, type, data, options){
    options = options || {};
    var event = doc.createEvent('Event');
    event.initEvent(type, 'bubbles' in options ? options.bubbles : true, 'cancelable' in options ? options.cancelable : true);
    for (var z in data) event[z] = data[z];
    element.dispatchEvent(event);
  }

  var polyfill = !doc.register;
  if (polyfill) {
    doc.register = register;
    
    doc.createElement = function createElement(tag){
      var base = tags[tag] ? tags[tag].base : null;
          element = _createElement.call(doc, base || tag);
      if (base) element.setAttribute('is', tag);
      upgrade(element);
      return element;
    };
    
    function changeAttribute(attr, value, method){
      var tag = getTag(this),
          last = this.getAttribute(attr);
      method.call(this, attr, value);
      if (tag && last != this.getAttribute(attr)) {
        if (this.attributeChangedCallback) this.attributeChangedCallback.call(this, attr, last);
      } 
    };
    
    var setAttr = Element.prototype.setAttribute;   
    Element.prototype.setAttribute = function(attr, value){
      changeAttribute.call(this, attr, value, setAttr);
    };
    
    removeAttr = Element.prototype.removeAttribute;   
    Element.prototype.removeAttribute = function(attr, value){
      changeAttribute.call(this, attr, value, removeAttr);
    };
    
    var initialize = function (){
      addObserver(doc.documentElement, 'inserted', inserted);
      addObserver(doc.documentElement, 'removed', removed);
      
      if (tokens.length) query(doc, tokens).forEach(function(element){
        upgrade(element);
      });
      
      domready = true;
      fireEvent(doc.body, 'WebComponentsReady');
      fireEvent(doc.body, 'DOMComponentsLoaded');
      fireEvent(doc.body, '__DOMComponentsLoaded__');
    };
    
    if (doc.readyState == 'complete') initialize();
    else doc.addEventListener(doc.readyState == 'interactive' ? 'readystatechange' : 'DOMContentLoaded', initialize); 
  }
  
  doc.register.__polyfill__ = {
    query: query,
    clone: clone,
    typeOf: typeOf,
    toArray: toArray,
    fireEvent: fireEvent,
    manipulate: manipulate,
    addObserver: addObserver,
    removeObserver: removeObserver,
    observerElement: doc.documentElement,
    _parseMutations: parseMutations,
    _insertChildren: window.CustomElements ? window.CustomElements.upgradeAll : insertChildren,
    _inserted: inserted,
    _createElement: _createElement,
    _polyfilled: polyfill || (window.CustomElements && !window.CustomElements.hasNative)
  };

})();

(function () {

/*** Internal Variables ***/

  var win = window,
    doc = document,
    noop = function(){},
    regexPseudoSplit = /(\w+(?:\([^\)]+\))?)/g,
    regexPseudoReplace = /(\w*)(?:\(([^\)]*)\))?/,
    regexDigits = /(\d+)/g,
    keypseudo = {
      action: function (pseudo, event) {
        return pseudo.value.match(regexDigits).indexOf(String(event.keyCode)) > -1 == (pseudo.name == 'keypass');
      }
    },
    touchFilter = function (custom, event) {
      if (custom.listener.touched) return custom.listener.touched = false;
      else {
        if (event.type.match('touch')) custom.listener.touched = true;
      }
    },
    createFlowEvent = function (type) {
      var flow = type == 'over';
      return {
        base: 'OverflowEvent' in win ? 'overflowchanged' : type + 'flow',
        condition: function (custom, event) {
          event.flow = type;
          return event.type == (type + 'flow') ||
          ((event.orient === 0 && event.horizontalOverflow == flow) ||
          (event.orient == 1 && event.verticalOverflow == flow) ||
          (event.orient == 2 && event.horizontalOverflow == flow && event.verticalOverflow == flow));
        }
      };
    },
    prefix = (function () {
      var styles = win.getComputedStyle(doc.documentElement, ''),
          pre = (Array.prototype.slice
            .call(styles)
            .join('')
            .match(/-(moz|webkit|ms)-/) || (styles.OLink === '' && ['', 'o'])
          )[1];
      return {
        dom: pre == 'ms' ? pre.toUpperCase() : pre,
        lowercase: pre,
        css: '-' + pre + '-',
        js: pre[0].toUpperCase() + pre.substr(1)
      };

    })(),
    matchSelector = Element.prototype.matchesSelector || Element.prototype[prefix.lowercase + 'MatchesSelector'];

/*** Internal Functions ***/

  // Mixins

  function mergeOne(source, key, current){
    var type = xtag.typeOf(current);
    if (type == 'object' && xtag.typeOf(source[key]) == 'object') xtag.merge(source[key], current);
    else source[key] = xtag.clone(current, type);
    return source;
  }

  function mergeMixin(type, mixin, option) {
    var original = {};
    for (var o in option) original[o.split(':')[0]] = true;
    for (var x in mixin) if (!original[x.split(':')[0]]) option[x] = mixin[x];
  }

  function applyMixins(tag) {
    tag.mixins.forEach(function (name) {
      var mixin = xtag.mixins[name];
      for (var type in mixin) {
        switch (type) {
          case 'lifecycle': case 'methods':
            mergeMixin(type, mixin[type], tag[type]);
            break;
          case 'accessors': case 'prototype':
            for (var z in mixin[type]) mergeMixin(z, mixin[type], tag.accessors);
            break;
          case 'events':
            break;
        }
      }
    });
    return tag;
  }

  function attachProperties(tag, prop, z, accessor, attr, setter){
    var key = z.split(':'), type = key[0];
    if (type == 'get') {
      key[0] = prop;
      tag.prototype[prop].get = xtag.applyPseudos(key.join(':'), accessor[z], tag.pseudos);
    }
    else if (type == 'set') {
      key[0] = prop;
      tag.prototype[prop].set = xtag.applyPseudos(key.join(':'), attr ? function(value){
        setter.call(this, value);
        accessor[z].call(this, value);
      } : accessor[z], tag.pseudos);
    }
    else tag.prototype[prop][z] = accessor[z];
  }

  function parseAccessor(tag, prop){
    tag.prototype[prop] = {};
    var accessor = tag.accessors[prop],
        attr = accessor.attribute,
        name = attr && attr.name ? attr.name.toLowerCase() : prop,
        setter = null;

    if (attr) {
      tag.attributes[name] = attr;
      tag.attributes[name].setter = prop;
      setter = function(value){
        var node = this.xtag.attributeNodes[name];
        if (!node || (node != this && !node.parentNode)) {
          node = this.xtag.attributeNodes[name] = attr.property ? this.xtag[attr.property] : attr.selector ? this.querySelector(attr.selector) : this;
        }
        var val = attr.boolean ? '' : value,
            method = (attr.boolean && (value === false || value === null)) ? 'removeAttribute' : value === null ? 'removeAttribute' : 'setAttribute';
        if (value != (attr.boolean ? this.hasAttribute(name) : this.getAttribute(name))) this[method](name, val);
        if (node && node != this && (value != (attr.boolean ? node.hasAttribute(name) : node.getAttribute(name)))) node[method](name, val);
      };
    }

    for (var z in accessor) attachProperties(tag, prop, z, accessor, attr, setter);

    if (attr) {
      if (!tag.prototype[prop].get) {
        var method = (attr.boolean ? 'has' : 'get') + 'Attribute';
        tag.prototype[prop].get = function(){
          return this[method](name);
        };
      }
      if (!tag.prototype[prop].set) tag.prototype[prop].set = setter;
    }

  }

/*** X-Tag Object Definition ***/

  var xtag = {
    tags: {},
    defaultOptions: {
      pseudos: [],
      mixins: [],
      events: {},
      methods: {},
      accessors: {},
      lifecycle: {},
      attributes: {},
      'prototype': {
        xtag: {
          get: function(){
            return this.__xtag__ ? this.__xtag__ : (this.__xtag__ = { data: {}, attributeNodes: {} });
          }
        }
      }
    },
    register: function (name, options) {
      var _name = name.toLowerCase();
      var tag = xtag.tags[_name] = applyMixins(xtag.merge({}, xtag.defaultOptions, options));

      for (var z in tag.events) tag.events[z] = xtag.parseEvent(z, tag.events[z]);
      for (z in tag.lifecycle) tag.lifecycle[z.split(':')[0]] = xtag.applyPseudos(z, tag.lifecycle[z], tag.pseudos);
      for (z in tag.methods) tag.prototype[z.split(':')[0]] = { value: xtag.applyPseudos(z, tag.methods[z], tag.pseudos) };
      for (var prop in tag.accessors) parseAccessor(tag, prop);

      var attributeChanged = tag.lifecycle.attributeChanged;
      tag.prototype.attributeChangedCallback = {
        value: function(name, last){
          var attr = tag.attributes[name.toLowerCase()] || {};
          if (attr.setter) this[attr.setter] = attr.boolean ? this.hasAttribute(name) : this.getAttribute(name);
          return attributeChanged ? attributeChanged.call(this, name, last) : null;
        }
      };

      var ready = tag.lifecycle.created || tag.lifecycle.ready;
      tag.prototype.readyCallback = {
        value: function(){
          var element = this;
          xtag.addEvents(this, tag.events);
          tag.mixins.forEach(function(mixin){
            if (xtag.mixins[mixin].events) xtag.addEvents(element, xtag.mixins[mixin].events);
          });
          var output = ready ? ready.apply(this, xtag.toArray(arguments)) : null;
          for (var attr in tag.attributes) if (this.hasAttribute(attr)) {
            this[tag.attributes[attr].setter] = tag.attributes[attr].boolean ? this.hasAttribute(attr) : this.getAttribute(attr);
          }
          tag.pseudos.forEach(function(obj){
            obj.onAdd.call(element, obj);
          });
          return output;
        }
      };

      if (tag.lifecycle.inserted) tag.prototype.insertedCallback = { value: tag.lifecycle.inserted };
      if (tag.lifecycle.removed) tag.prototype.removedCallback = { value: tag.lifecycle.removed };

      var constructor = doc.register(_name, {
        'extends': options['extends'],
        'prototype': Object.create((options['extends'] ? document.createElement(options['extends']).constructor : win.HTMLElement).prototype, tag.prototype)
      });

      return constructor;
    },

  /*** Exposed Variables ***/
    mixins: {},
    prefix: prefix,
    captureEvents: ['focus', 'blur'],
    customEvents: {
      overflow: createFlowEvent('over'),
      underflow: createFlowEvent('under'),
      animationstart: {
        base: [
          'animationstart',
          'oAnimationStart',
          'MSAnimationStart',
          'webkitAnimationStart'
        ]
      },
      transitionend: {
        base: [
          'transitionend',
          'oTransitionEnd',
          'MSTransitionEnd',
          'webkitTransitionEnd'
        ]
      },
      tap: {
        base: ['click', 'touchend'],
        condition: touchFilter
      },
      tapstart: {
        base: ['mousedown', 'touchstart'],
        condition: touchFilter
      },
      tapend: {
        base: ['mouseup', 'touchend'],
        condition: touchFilter
      },
      tapenter: {
        base: ['mouseover', 'touchenter'],
        condition: touchFilter
      },
      tapleave: {
        base: ['mouseout', 'touchleave'],
        condition: touchFilter
      },
      tapmove: {
        base: ['mousemove', 'touchmove'],
        condition: touchFilter
      }
    },
    pseudos: {
      keypass: keypseudo,
      keyfail: keypseudo,
      delegate: {
        action: function (pseudo, event) {
          var target = xtag.query(this, pseudo.value).filter(function (node) {
            return node == event.target || node.contains ? node.contains(event.target) : false;
          })[0];
          return target ? pseudo.listener = pseudo.listener.bind(target) : false;
        }
      },
      preventable: {
        action: function (pseudo, event) {
          return !event.defaultPrevented;
        }
      }
    },

  /*** Utilities ***/

    // JS Types

    wrap: function (original, fn) {
      return function () {
        var args = xtag.toArray(arguments),
          returned = original.apply(this, args);
        return returned === false ? false : fn.apply(this, typeof returned != 'undefined' ? xtag.toArray(returned) : args);
      };
    },

    merge: function(source, k, v){
      if (xtag.typeOf(k) == 'string') return mergeOne(source, k, v);
      for (var i = 1, l = arguments.length; i < l; i++){
        var object = arguments[i];
        for (var key in object) mergeOne(source, key, object[key]);
      }
      return source;
    },

    skipTransition: function(element, fn, bind){
      var duration = prefix.js + 'TransitionDuration';
      element.style[duration] = '0.001s';
      element.style.transitionDuration = '0.001s';
      xtag.requestFrame(function(){
        if (fn) fn.call(bind);
        xtag.requestFrame(function(){
          element.style[duration] = '';
          element.style.transitionDuration = '';
        });
      });
    },

    requestFrame: (function(){
      var raf = win.requestAnimationFrame ||
        win[prefix.lowercase + 'RequestAnimationFrame'] ||
        function(fn){ return win.setTimeout(fn, 20); };
      return function(fn){
        return raf.call(win, fn);
      };
    })(),

    matchSelector: function (element, selector) {
      return matchSelector.call(element, selector);
    },

    set: function (element, method, value) {
      element[method] = value;
      if (xtag._polyfilled) {
        if (xtag.observerElement._observer) {
          xtag._parseMutations(xtag.observerElement, xtag.observerElement._observer.takeRecords());
        }
        else xtag._insertChildren(element);
      }
    },

    innerHTML: function(el, html){
      xtag.set(el, 'innerHTML', html);
    },

    hasClass: function (element, klass) {
      return element.className.split(' ').indexOf(klass.trim())>-1;
    },

    addClass: function (element, klass) {
      var list = element.className.trim().split(' ');
      klass.trim().split(' ').forEach(function (name) {
        if (!~list.indexOf(name)) list.push(name);
      });
      element.className = list.join(' ').trim();
      return element;
    },

    removeClass: function (element, klass) {
      var classes = klass.trim().split(' ');
      element.className = element.className.trim().split(' ').filter(function (name) {
        return name && !~classes.indexOf(name);
      }).join(' ');
      return element;
    },

    toggleClass: function (element, klass) {
      return xtag[xtag.hasClass(element, klass) ? 'removeClass' : 'addClass'].call(null, element, klass);

    },

    query: function (element, selector) {
      return xtag.toArray(element.querySelectorAll(selector));
    },

    queryChildren: function (element, selector) {
      var id = element.id,
        guid = element.id = id || 'x_' + new Date().getTime(),
        attr = '#' + guid + ' > ';
      selector = attr + (selector + '').replace(',', ',' + attr, 'g');
      var result = element.parentNode.querySelectorAll(selector);
      if (!id) element.removeAttribute('id');
      return xtag.toArray(result);
    },

    createFragment: function (content) {
      var frag = doc.createDocumentFragment();
      if (content) {
        var div = frag.appendChild(doc.createElement('div')),
          nodes = xtag.toArray(content.nodeName ? arguments : !(div.innerHTML = content) || div.children),
          index = nodes.length;
        while (index--) frag.insertBefore(nodes[index], div);
        frag.removeChild(div);
      }
      return frag;
    },

  /*** Pseudos ***/

    applyPseudos: function(key, fn, element) {
      var listener = fn,
          pseudos = {};
      if (key.match(':')) {
        var split = key.match(regexPseudoSplit),
            i = split.length;
        while (--i) {
          split[i].replace(regexPseudoReplace, function (match, name, value) {
            var pseudo = pseudos[i] = Object.create(xtag.pseudos[name]);
                pseudo.key = key;
                pseudo.name = name;
                pseudo.value = value;
            if (!pseudo) throw "pseudo not found: " + name;
            var last = listener;
            listener = function(){
              var args = xtag.toArray(arguments),
                  obj = {
                    key: key,
                    name: name,
                    value: value,
                    listener: last
                  };
              if (pseudo.action && pseudo.action.apply(this, [obj].concat(args)) === false) return false;
              return obj.listener.apply(this, args);
            };
            if (element && pseudo.onAdd) {
              if (element.getAttribute) {
                pseudo.onAdd.call(element, pseudo);
              } else {
                element.push(pseudo);
              }
            }
          });
        }
      }
      for (var z in pseudos) {
        if (pseudos[z].onCompiled) listener = pseudos[z].onCompiled(listener, pseudos[z]);
      }
      return listener;
    },

    removePseudos: function(element, event){
      event._pseudos.forEach(function(obj){
        obj.onRemove.call(element, obj);
      });
    },

  /*** Events ***/

    parseEvent: function(type, fn) {
      var pseudos = type.split(':'),
        key = pseudos.shift(),
        event = xtag.merge({
          base: key,
          pseudos: '',
          _pseudos: [],
          onAdd: noop,
          onRemove: noop,
          condition: noop
        }, xtag.customEvents[key] || {});
      event.type = key + (event.pseudos.length ? ':' + event.pseudos : '') + (pseudos.length ? ':' + pseudos.join(':') : '');
      if (fn) {
        var chained = xtag.applyPseudos(event.type, fn, event._pseudos);
        event.listener = function(){
          var args = xtag.toArray(arguments);
          if (event.condition.apply(this, [event].concat(args)) === false) return false;
          return chained.apply(this, args);
        };
      }
      return event;
    },

    addEvent: function (element, type, fn) {
      var event = (typeof fn == 'function') ? xtag.parseEvent(type, fn) : fn;
      event.listener.event = event;
      event._pseudos.forEach(function(obj){
        obj.onAdd.call(element, obj);
      });
      event.onAdd.call(element, event, event.listener);
      xtag.toArray(event.base).forEach(function (name) {
        element.addEventListener(name, event.listener, xtag.captureEvents.indexOf(name) > -1);
      });
      return event.listener;
    },

    addEvents: function (element, events) {
      var listeners = {};
      for (var z in events) {
        listeners[z] = xtag.addEvent(element, z, events[z]);
      }
      return listeners;
    },

    removeEvent: function (element, type, fn) {
      var event = fn.event;
      event.onRemove.call(element, event, fn);
      xtag.removePseudos(element, event);
      xtag.toArray(event.base).forEach(function (name) {
        element.removeEventListener(name, fn);
      });
    },

    removeEvents: function(element, listeners){
      for (var z in listeners) xtag.removeEvent(element, z, listeners[z]);
    }

  };

  xtag.typeOf = doc.register.__polyfill__.typeOf;
  xtag.clone = doc.register.__polyfill__.clone;
  xtag.merge(xtag, doc.register.__polyfill__);

  if (typeof define == 'function' && define.amd) define(xtag);
  else win.xtag = xtag;

})();

(function(){

  xtag.register('x-appbar', {
    lifecycle: {
      created: function(){
        var header = xtag.queryChildren(this, 'header')[0];
        if (!header){
          header = document.createElement('header');
          this.appendChild(growbox);
        }
        this.xtag.data.header = header;
        this.subheading = this.subheading;
      }
    },
    accessors: {
      heading: {
        get: function(){
          return this.xtag.data.header.innerHTML;
        },
        set: function(value){
          this.xtag.data.header.innerHTML = value;
        }
      },
      subheading: {
        attribute: {},
        get: function(){
          return this.getAttribute('subheading') || "";
        },
        set: function(value){
          this.xtag.data.header.setAttribute('subheading', value);
        }
      }
    }
  });

})();


(function(){

  var delayedEvents = [],
    fireMatches = function(element, mql, attr, skipFire){
      var state = (mql.matches) ? ['active', 'set', 'add'] : ['inactive', 'remove', 'remove'],
        eventType = 'mediaquery' + state[0],
        eventData = { 'query': mql };
      element[state[1] + 'Attribute']('matches', null);
      if (!skipFire) xtag.fireEvent(element, eventType, eventData);
      (attr || (element.getAttribute('for') || '').split(' ')).forEach(function(id){
        var node = document.getElementById(id);
        if (node) {
          xtag[state[2] + 'Class'](node, element.id);
          if (!skipFire) xtag.fireEvent(node, eventType, eventData, { bubbles: false });
        }
      });
    },
    attachQuery = function(element, query, attr, skipFire){
      if (!xtag.domready){
        skipFire = true;
        delayedEvents.push(element);
      }
      query = query || element.getAttribute('media');
      if (query){
        if (element.xtag.query) element.xtag.query.removeListener(element.xtag.listener);
        query = element.xtag.query = window.matchMedia(query);
        var listener = element.xtag.listener = function(mql){
          fireMatches(element, mql);
        };
        fireMatches(element, query, attr, skipFire);
        query.addListener(listener);
      }
    },
    delayedListener = function(){
      delayedEvents = delayedEvents.map(function(element){
        return attachQuery(element);
      });
      document.removeEventListener(delayedListener);
    };

  document.addEventListener('__DOMComponentsLoaded__', delayedListener);

  xtag.register('x-mediaquery', {
    lifecycle:{
      created: function(){
        attachQuery(this);
      }
    },
    accessors:{
      'for': {
        get: function(){
          return this.getAttribute('for');
        },
        set: function(value){
          var next = (value || '').split(' ');
          (this.getAttribute('for') || '').split(' ').map(function(id){
            var index = next.indexOf(id);
            if (index == -1){
              var element = document.getElementById(id);
              if (element){
                xtag.removeClass(element, this.id);
                xtag.fireEvent(element, 'mediaqueryremoved');
              }
            }
            else next.splice(index, 1);
          }, this);
          attachQuery(this, null, next);
        }
      },
      'media': {
        attribute: {},
        get: function(){
          return this.getAttribute('media');
        },
        set: function(value){
          attachQuery(this, query);
        }
      },
      'id': {
        attribute: {},
        get: function(){
          return this.getAttribute('id');
        },
        set: function(value){
          var current = this.getAttribute('id');
          xtag.query(document, '.' + current).forEach(function(node){
            xtag.removeClass(node, current);
            xtag.addClass(node, id);
          });
        }
      }
    }
  });

})();
(function(){

var head = document.querySelector('head');
var anchor = document.createElement('a');
anchor.href = '';
xtag.callbacks = {};

  function request(element, options){
    clearRequest(element);
    var last = element.xtag.request || {};
    element.xtag.request = options;
    var request = element.xtag.request,
      callbackKey = (element.getAttribute('data-callback-key') ||
        'callback') + '=xtag.callbacks.';
    if (xtag.fireEvent(element, 'beforerequest') === false) return false;
    if (last.url && !options.update &&
      last.url.replace(new RegExp('\&?\(' + callbackKey + 'x[0-9]+)'), '') ==
        element.xtag.request.url){
      element.xtag.request = last;
      return false;
    }
    element.setAttribute('src', element.xtag.request.url);
    anchor.href = options.url;
    if (anchor.hostname == window.location.hostname) {
      request = xtag.merge(new XMLHttpRequest(), request);
      request.onreadystatechange = function(){
        element.setAttribute('data-readystate', request.readyState);
        if (request.readyState == 4 && request.status < 400){
          requestCallback(element, request);
        }
      };
      ['error', 'abort', 'load'].forEach(function(type){
        request['on' + type] = function(event){
          event.request = request;
          xtag.fireEvent(element, type, event);
        }
      });
      request.open(request.method , request.url, true);
      request.setRequestHeader('Content-Type',
        'application/x-www-form-urlencoded');
      request.send();
    }
    else {
      var callbackID = request.callbackID = 'x' + new Date().getTime();
      element.setAttribute('data-readystate', request.readyState = 0);
      xtag.callbacks[callbackID] = function(data){
        request.status = 200;
        request.readyState = 4;
        request.responseText = data;
        requestCallback(element, request);
        delete xtag.callbacks[callbackID];
        clearRequest(element);
      }
      request.script = document.createElement('script');
      request.script.type = 'text/javascript';
      request.script.src = options.url = options.url +
        (~options.url.indexOf('?') ? '&' : '?') + callbackKey + callbackID;
      request.script.onerror = function(error){
        element.setAttribute('data-readystate', request.readyState = 4);
        element.setAttribute('data-requeststatus', request.status = 400);
        xtag.fireEvent(element, 'error', error);
      }
      head.appendChild(request.script);
    }
    element.xtag.request = request;
  }

  function requestCallback(element, request){
    if (request != element.xtag.request) return xtag;
    element.setAttribute('data-readystate', request.readyState);
    element.setAttribute('data-requeststatus', request.status);
    xtag.fireEvent(element, 'dataready', { request: request });
    if (element.dataready) element.dataready.call(element, request);
  }

  function clearRequest(element){
    var req = element.xtag.request;
    if (!req) return xtag;
    if (req.script && ~xtag.toArray(head.children).indexOf(req.script)) {
      head.removeChild(req.script);
    }
    else if (req.abort) req.abort();
  }


  xtag.mixins['request'] = {
    lifecycle:{
      created:  function(){
        this.src = this.getAttribute('src');
      }
    },
    accessors:{
      dataready:{
        get: function(){
          return this.xtag.dataready;
        },
        set: function(fn){
          this.xtag.dataready = fn;
        }
      },
      src:{
        set: function(src){
          if (src){
            this.setAttribute('src', src);
            request(this, { url: src, method: 'GET' });
          }
        },
        get: function(){
          return this.getAttribute('src');
        }
      }
    }
  };

})();

(function(){

  var oldiOS = /OS [1-4]_\d like Mac OS X/i.test(navigator.userAgent),
    oldDroid = /Android 2.\d.+AppleWebKit/.test(navigator.userAgent),
    gingerbread = /Android 2\.3.+AppleWebKit/.test(navigator.userAgent);

  if(oldDroid){
    //<meta name="viewport" content="width=device-width; initial-scale=1.0; maximum-scale=1.0; minimum-scale=1.0; user-scalable=0;" />
    var meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width; initial-scale=1.0; maximum-scale=1.0; minimum-scale=1.0; user-scalable=0;';
    document.head.appendChild(meta);
  }

  window.addEventListener('keyup', function(event){
    if(event.keyCode == 27) xtag.query(document, 'x-modal[esc-hide]').forEach(function(modal){
      if (modal.getAttribute('hidden') === null) xtag.fireEvent(modal, 'modalhide');
    });
  });

  if (oldiOS || oldDroid) {
    window.addEventListener('scroll', function(event){
      var modals = xtag.query(document, 'body > x-modal');
      modals.forEach(function(m){
        m.style.top = (window.pageYOffset + window.innerHeight * 0.5) + 'px';
      });
    });
  }

  xtag.register('x-modal', {
    mixins: ['request'],
    lifecycle: {
      created: function() {
        this.setAttribute('tabindex',0);
      },
      inserted: function() {
        if (oldiOS || oldDroid) {
          this.style.top = (window.pageYOffset + window.innerHeight * 0.5) + 'px';
        }
      }
    },
    events: {
      'modalhide': function() {
        this.setAttribute('hidden', '');
      }
    },
    methods: {
      toggle: function() {
        if (this.hasAttribute('hidden')) {
          this.removeAttribute('hidden');
        } else {
          this.setAttribute('hidden','');
        }
      }
    }
  });

})();


(function(){

	xtag.register('x-shiftbox', {
		events:{
			'transitionend': function(e){
				if (e.target == xtag.queryChildren(this, 'x-content')[0]){
					if (this.shift.length){
						xtag.fireEvent(this, 'closed');
					}
					else {
						xtag.fireEvent(this, 'opened');
					}
				}
			}
		},
		accessors: {
			'shift': {
				attribute: {},
				get: function(){
					return this.getAttribute('shift') || '';
				}
			}
		},
		methods: {
			'toggle': function(){
				if (this.hasAttribute('open')){
					this.removeAttribute('open');
				} else {
					this.setAttribute('open','');
				}
			}
		}
	});

})();

(function(){

  var transform = xtag.prefix.js + 'Transform';
  function getState(el){
    var selected = xtag.query(el, 'x-slides > x-slide[selected]')[0] || 0;
    return [selected ? xtag.query(el, 'x-slides > x-slide').indexOf(selected) : selected, el.firstElementChild.children.length - 1];
  }

  function slide(el, index){
    var slides = xtag.toArray(el.firstElementChild.children);
    slides.forEach(function(slide){ slide.removeAttribute('selected'); });
    slides[index || 0].setAttribute('selected', null);
    el.firstElementChild.style[transform] = 'translate'+ (el.getAttribute('orientation') || 'x') + '(' + (index || 0) * (-100 / slides.length) + '%)';
  }

  function init(toSelected){
    var slides = this.firstElementChild;
    if (!slides || !slides.children.length || slides.tagName.toLowerCase() != 'x-slides') return;

    var children = xtag.toArray(slides.children),
      size = 100 / (children.length || 1),
      orient = this.getAttribute('orientation') || 'x',
      style = orient == 'x' ? ['width', 'height'] : ['height', 'width'];

    slides.style[style[1]] =  '100%';
    slides.style[style[0]] = children.length * 100 + '%';
    slides.style[transform] = 'translate' + orient + '(0%)';
    children.forEach(function(slide){
      slide.style[style[0]] = size + '%';
      slide.style[style[1]] = '100%';
    });

    if (toSelected) {
      var selected = slides.querySelector('[selected]');
      if (selected) slide(this, children.indexOf(selected) || 0);
    }
  }

  xtag.register('x-slidebox', {
    lifecycle: {
      created: function(){
        init();
      }
    },
    events:{
      'transitionend': function(e){
        if (e.target == this.firstElementChild){
          xtag.fireEvent(this, 'slideend');
        }
      }
    },
    accessors:{
      orientation:{
        get: function(){
          return this.getAttribute('orientation');
        },
        set: function(value){
          this.setAttribute('orientation', value.toLowerCase());
          init.call(this, true);
        }
      }
    },
    methods: {
      slideTo: function(index){
        slide(this, index);
      },
      slideNext: function(){
        var shift = getState(this);
          shift[0]++;
        slide(this, shift[0] > shift[1] ? 0 : shift[0]);
      },
      slidePrevious: function(){
        var shift = getState(this);
          shift[0]--;
        slide(this, shift[0] < 0 ? shift[1] : shift[0]);
      }
    }
  });

  xtag.register('x-slide', {
    lifecycle:{
      inserted: function(){
        var ancestor = this.parentNode.parentNode;
        if (ancestor.tagName.toLowerCase() == 'x-slidebox') init.call(ancestor, true);
      },
      created: function(e){
        if (this.parentNode){
          var ancestor = this.parentNode.parentNode;
          if (ancestor.tagName.toLowerCase() == 'x-slidebox') init.call(ancestor, true);
        }
      }
    }
  });

})();

(function(){

  function createScript(element, type){
    var script = document.createElement('script');
    script.type = 'template/' + type;
    element.appendChild(script);
    return script;
  }

  function getPath(object, path){
    if (typeof path == 'string') path = path.split('.');
    var len = path.length, i = 0;
    while (len--){
      object = (object || {})[path[i++]];
      if (!len) return object;
    }
  }

  function substitute(str, object, regexp) {
    return String(str).replace(regexp || (/\\?\{([^{}]+)\}|%7B([^%7B,%7D]+)\%7D/g), function(match, name1, name2) {
      var name = name1 || name2;
      if (match.charAt(0) == '\\') return match.slice(1);
      if (object[name] !== undefined) return object[name];
      var value = getPath(object, name);
      return (value === null || value === undefined) ? '' : value;
    });
  }

  function renderTemplate(element, html, data){
    return substitute(html, data||{});
  }

  xtag.pseudos.templateTarget = {
    action: function(pseudo, e, args){
      e.templateTarget = this;
    }
  };

  xtag.mixins.template = {
    lifecycle:{
      created: function(){
        var template = this.getAttribute('template');
        if (template){
          xtag.fireEvent(this, 'templatechange', { template: template });
        }
      }
    },
    accessors: {
      template:{
        attribute: {},
        get: function(){
          return this.getAttribute('template');
        },
        set: function(value){
          var attr = this.getAttribute('template');
          this.xtag.__previousTemplate__ = attr;
          xtag.fireEvent(this, 'templatechange', { template: value });
        }
      }
    }
  };

  document.addEventListener('templatechange', function(event){
    var template = xtag.query(document, 'x-template[name="' + event.template + '"]')[0];
    if (template) xtag.fireEvent(template, 'templatechange', { templateTarget: event.target }, { bubbles: false });
  }, false);

  xtag.register('x-template', {
    lifecycle: {
      created: function(){
        this.xtag.templateListeners = {};
        this.script = this.script;
      }
    },
    accessors: {
      renderer: {
        get: function(){
          return this.xtag.renderer || renderTemplate;
        },
        set: function(fn){
          this.xtag.renderer = fn;
        }
      },
      beforeRender: {
        get: function(){
          return this.xtag.beforeRender;
        },
        set: function(fn){
          this.xtag.beforeRender = fn;
        }
      },
      name: {
        get: function(){
          return this.getAttribute('name');
        },
        set: function(name){
          this.setAttribute('name', name);
          this.render();
        }
      },
      scriptElement: {
        get: function(){
          return this.querySelector('script[type="template/script"]') || createScript(this, 'script');
        }
      },
      contentElement: {
        get: function(){
          return this.querySelector('script[type="template/content"]') || createScript(this, 'content');
        }
      },
      script: {
        get: function(){
          return this.scriptElement.textContent;
        },
        set: function(script){
          this._dumpTemplateEvents();
          this.scriptElement.textContent = String(script);
          this.xtag.templateScript = (typeof script == 'function' ? script : new Function(script)).bind(this);
          this.xtag.templateScript();
        }
      },
      content: {
        get: function(){
          return this.contentElement.innerHTML;
        },
        set: function(content){
          this.contentElement.innerHTML = content;
          this.render();
        }
      }
    },
    methods: {
      attachTemplate: function(element){
        var attached = this.xtag.attached = (this.xtag.attached || []);
        if (attached.indexOf(element) == -1) attached.push(element);
        this.render(element);
      },
      detachTemplate: function(element){
        var attached = this.xtag.attached = (this.xtag.attached || []),
          index = attached.indexOf(element);
        if (index != -1) attached.splice(index, 1);
      },
      render: function(elements){
        var name = this.name;
        if (name) {
          var content = this.content;
          xtag.toArray(elements ? (elements.xtag ? [elements] : elements) : document.querySelectorAll('[template="' + name + '"]')).forEach(function(element){
            if (element.xtag) {
              for (var setter in this.xtag.templateSetters){
                var fn = this.xtag.templateSetters[setter],
                  prop = Object.getOwnPropertyDescriptor(element,setter);
                if (prop && prop.set){
                  var templateSetter = fn;
                  var oldSetter = prop.set;
                  fn = function(value){
                    oldSetter.call(element, value);
                    templateSetter.call(element, value);
                  };
                }
                xtag.applyAccessor(element, setter, "set", fn);
              }
              element.innerHTML = this.renderer.call(this, element, content, element.templateData);
            }
          }, this);
        }
      },
      addTemplateListener: function(type, fn){
        var split = type.split(':');
          split.splice(1, 0, 'delegate([template="'+ this.name +'"]):templateTarget');
        type = split.join(':');
        this.xtag.templateListeners[type] = this.xtag.templateListeners[type] || [];
        this.xtag.templateListeners[type].push(xtag.addEvent(document, type, fn));
      },
      addTemplateListeners: function(events){
         for (var z in events) this.addTemplateListener(z, events[z]);
      },
      removeTemplateListener: function(type, fn){
        xtag.removeEvent(document, type, fn);
      },
      _dumpTemplateEvents: function(){
        for (var z in this.xtag.templateListeners) this.xtag.templateListeners[z].forEach(function(fn){
          xtag.removeEvent(document, z, fn);
        });
      }
    },
    events: {
      'templatechange': function(event){
        var previous = xtag.query(document, 'x-template[name="' + event.templateTarget.xtag.__previousTemplate__ + '"]')[0];
        if (previous) previous.detachTemplate(event.templateTarget);
        this.attachTemplate(event.templateTarget);
      }
    }
  });

})();