/**
 * UTF-7 decoding via <https://github.com/kkaefer/utf7>
 *
 * Copyright (c) 2010-2011 Konstantin Käfer
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

define(['exports'], function(exports) {

// We don't currently use the encode method, but we're keeping it
// around because IMAP uses it for folder names. If we ever let users
// create/edit folder names, we'll need this.
function encode(str) {
  var b = new Buffer(str.length * 2, 'ascii');
  for (var i = 0, bi = 0; i < str.length; i++) {
    // Note that we can't simply convert a UTF-8 string to Base64 because
    // UTF-8 uses a different encoding. In modified UTF-7, all characters
    // are represented by their two byte Unicode ID.
    var c = str.charCodeAt(i);
    // Upper 8 bits shifted into lower 8 bits so that they fit into 1 byte.
    b[bi++] = c >> 8;
    // Lower 8 bits. Cut off the upper 8 bits so that they fit into 1 byte.
    b[bi++] = c & 0xFF;
  }
  // Modified Base64 uses , instead of / and omits trailing =.
  return b.toString('base64').replace(/=+$/, '');
}

function decode(str) {
  // The base-64 encoded utf-16 gets converted into a buffer holding
  // the utf-16 encoded bits; then we decode the utf-16 into a JS string.
  return new Buffer(str, 'base64').toString('utf-16be');;
}

// Escape RegEx from http://simonwillison.net/2006/Jan/20/escape/
function escape(chars) {
  return chars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

// Character classes defined by RFC 2152.
var setD = "A-Za-z0-9" + escape("'(),-./:?");
var setO = escape("!\"#$%&*;<=>@[]^_'{|}");
var setW = escape(" \r\n\t");

// Stores compiled regexes for various replacement pattern.
var regexes = {};
var regexAll = new RegExp("[^" + setW + setD + setO + "]+", 'g');

exports.imap = {};

// RFC 2152 UTF-7 encoding.
exports.encode = function(str, mask) {
  // Generate a RegExp object from the string of mask characters.
  if (!mask) {
    mask = '';
  }
  if (!regexes[mask]) {
    regexes[mask] = new RegExp("[^" + setD + escape(mask) + "]+", 'g');
  }

  // We replace subsequent disallowed chars with their escape sequence.
  return str.replace(regexes[mask], function(chunk) {
    // + is represented by an empty sequence +-, otherwise call encode().
    return '+' + (chunk === '+' ? '' : encode(chunk)) + '-';
  });
};

// RFC 2152 UTF-7 encoding with all optionals.
exports.encodeAll = function(str) {
  // We replace subsequent disallowed chars with their escape sequence.
  return str.replace(regexAll, function(chunk) {
    // + is represented by an empty sequence +-, otherwise call encode().
    return '+' + (chunk === '+' ? '' : encode(chunk)) + '-';
  });
};

// RFC 3501, section 5.1.3 UTF-7 encoding.
exports.imap.encode = function(str) {
  // All printable ASCII chars except for & must be represented by themselves.
  // We replace subsequent non-representable chars with their escape sequence.
  return str.replace(/&/g, '&-').replace(/[^\x20-\x7e]+/g, function(chunk) {
    // & is represented by an empty sequence &-, otherwise call encode().
    chunk = (chunk === '&' ? '' : encode(chunk)).replace(/\//g, ',');
    return '&' + chunk + '-';
  });
};

// RFC 2152 UTF-7 decoding.
exports.decode = function(str) {
  return str.replace(/\+([A-Za-z0-9\/]*)-?/gi, function(_, chunk) {
    // &- represents &.
    if (chunk === '') return '+';
    return decode(chunk);
  });
};

// RFC 3501, section 5.1.3 UTF-7 decoding.
exports.imap.decode = function(str) {
  return str.replace(/&([^-]*)-/g, function(_, chunk) {
    // &- represents &.
    if (chunk === '') return '&';
    return decode(chunk.replace(/,/g, '/'));
  });
};


});
