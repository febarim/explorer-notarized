// Source: public/src/js/ios-imagefile-megapixel/megapix-image.js
/**
 * Mega pixel image rendering library for iOS6 Safari
 *
 * Fixes iOS6 Safari's image file rendering issue for large size image (over mega-pixel),
 * which causes unexpected subsampling when drawing it in canvas.
 * By using this library, you can safely render the image with proper stretching.
 *
 * Copyright (c) 2012 Shinichi Tomita <shinichi.tomita@gmail.com>
 * Released under the MIT license
 */
(function() {

  /**
   * Detect subsampling in loaded image.
   * In iOS, larger images than 2M pixels may be subsampled in rendering.
   */
  function detectSubsampling(img) {
    var iw = img.naturalWidth, ih = img.naturalHeight;
    if (iw * ih > 1024 * 1024) { // subsampling may happen over megapixel image
      var canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, -iw + 1, 0);
      // subsampled image becomes half smaller in rendering size.
      // check alpha channel value to confirm image is covering edge pixel or not.
      // if alpha value is 0 image is not covering, hence subsampled.
      return ctx.getImageData(0, 0, 1, 1).data[3] === 0;
    } else {
      return false;
    }
  }

  /**
   * Detecting vertical squash in loaded image.
   * Fixes a bug which squash image vertically while drawing into canvas for some images.
   */
  function detectVerticalSquash(img, iw, ih) {
    var canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = ih;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    var data = ctx.getImageData(0, 0, 1, ih).data;
    // search image edge pixel position in case it is squashed vertically.
    var sy = 0;
    var ey = ih;
    var py = ih;
    while (py > sy) {
      var alpha = data[(py - 1) * 4 + 3];
      if (alpha === 0) {
        ey = py;
      } else {
        sy = py;
      }
      py = (ey + sy) >> 1;
    }
    var ratio = (py / ih);
    return (ratio===0)?1:ratio;
  }

  /**
   * Rendering image element (with resizing) and get its data URL
   */
  function renderImageToDataURL(img, options, doSquash) {
    var canvas = document.createElement('canvas');
    renderImageToCanvas(img, canvas, options, doSquash);
    return canvas.toDataURL("image/jpeg", options.quality || 0.8);
  }

  /**
   * Rendering image element (with resizing) into the canvas element
   */
  function renderImageToCanvas(img, canvas, options, doSquash) {
    var iw = img.naturalWidth, ih = img.naturalHeight;
    var width = options.width, height = options.height;
    var ctx = canvas.getContext('2d');
    ctx.save();
    transformCoordinate(canvas, width, height, options.orientation);
    var subsampled = detectSubsampling(img);
    if (subsampled) {
      iw /= 2;
      ih /= 2;
    }
    var d = 1024; // size of tiling canvas
    var tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = tmpCanvas.height = d;
    var tmpCtx = tmpCanvas.getContext('2d');
    var vertSquashRatio = doSquash ? detectVerticalSquash(img, iw, ih) : 1;
    var dw = Math.ceil(d * width / iw);
    var dh = Math.ceil(d * height / ih / vertSquashRatio);
    var sy = 0;
    var dy = 0;
    while (sy < ih) {
      var sx = 0;
      var dx = 0;
      while (sx < iw) {
        tmpCtx.clearRect(0, 0, d, d);
        tmpCtx.drawImage(img, -sx, -sy);
        ctx.drawImage(tmpCanvas, 0, 0, d, d, dx, dy, dw, dh);
        sx += d;
        dx += dw;
      }
      sy += d;
      dy += dh;
    }
    ctx.restore();
    tmpCanvas = tmpCtx = null;
  }

  /**
   * Transform canvas coordination according to specified frame size and orientation
   * Orientation value is from EXIF tag
   */
  function transformCoordinate(canvas, width, height, orientation) {
    switch (orientation) {
      case 5:
      case 6:
      case 7:
      case 8:
        canvas.width = height;
        canvas.height = width;
        break;
      default:
        canvas.width = width;
        canvas.height = height;
    }
    var ctx = canvas.getContext('2d');
    switch (orientation) {
      case 2:
        // horizontal flip
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
        break;
      case 3:
        // 180 rotate left
        ctx.translate(width, height);
        ctx.rotate(Math.PI);
        break;
      case 4:
        // vertical flip
        ctx.translate(0, height);
        ctx.scale(1, -1);
        break;
      case 5:
        // vertical flip + 90 rotate right
        ctx.rotate(0.5 * Math.PI);
        ctx.scale(1, -1);
        break;
      case 6:
        // 90 rotate right
        ctx.rotate(0.5 * Math.PI);
        ctx.translate(0, -height);
        break;
      case 7:
        // horizontal flip + 90 rotate right
        ctx.rotate(0.5 * Math.PI);
        ctx.translate(width, -height);
        ctx.scale(-1, 1);
        break;
      case 8:
        // 90 rotate left
        ctx.rotate(-0.5 * Math.PI);
        ctx.translate(-width, 0);
        break;
      default:
        break;
    }
  }


  /**
   * MegaPixImage class
   */
  function MegaPixImage(srcImage) {
    if (window.Blob && srcImage instanceof Blob) {
      var img = new Image();
      var URL = window.URL && window.URL.createObjectURL ? window.URL :
                window.webkitURL && window.webkitURL.createObjectURL ? window.webkitURL :
                null;
      if (!URL) { throw Error("No createObjectURL function found to create blob url"); }
      img.src = URL.createObjectURL(srcImage);
      this.blob = srcImage;
      srcImage = img;
    }
    if (!srcImage.naturalWidth && !srcImage.naturalHeight) {
      var _this = this;
      srcImage.onload = function() {
        var listeners = _this.imageLoadListeners;
        if (listeners) {
          _this.imageLoadListeners = null;
          for (var i=0, len=listeners.length; i<len; i++) {
            listeners[i]();
          }
        }
      };
      this.imageLoadListeners = [];
    }
    this.srcImage = srcImage;
  }

  /**
   * Rendering megapix image into specified target element
   */
  MegaPixImage.prototype.render = function(target, options) {
    if (this.imageLoadListeners) {
      var _this = this;
      this.imageLoadListeners.push(function() { _this.render(target, options) });
      return;
    }
    options = options || {};
    var imgWidth = this.srcImage.naturalWidth, imgHeight = this.srcImage.naturalHeight,
        width = options.width, height = options.height,
        maxWidth = options.maxWidth, maxHeight = options.maxHeight,
        doSquash = !this.blob || this.blob.type === 'image/jpeg';
    if (width && !height) {
      height = (imgHeight * width / imgWidth) << 0;
    } else if (height && !width) {
      width = (imgWidth * height / imgHeight) << 0;
    } else {
      width = imgWidth;
      height = imgHeight;
    }
    if (maxWidth && width > maxWidth) {
      width = maxWidth;
      height = (imgHeight * width / imgWidth) << 0;
    }
    if (maxHeight && height > maxHeight) {
      height = maxHeight;
      width = (imgWidth * height / imgHeight) << 0;
    }
    var opt = { width : width, height : height };
    for (var k in options) opt[k] = options[k];

    var tagName = target.tagName.toLowerCase();
    if (tagName === 'img') {
      target.src = renderImageToDataURL(this.srcImage, opt, doSquash);
    } else if (tagName === 'canvas') {
      renderImageToCanvas(this.srcImage, target, opt, doSquash);
    }
    if (typeof this.onrender === 'function') {
      this.onrender(target);
    }
  };

  /**
   * Export class to global
   */
  if (typeof define === 'function' && define.amd) {
    define([], function() { return MegaPixImage; }); // for AMD loader
  } else {
    this.MegaPixImage = MegaPixImage;
  }

})();

// Source: public/lib/qrcode-generator/js/qrcode.js
//---------------------------------------------------------------------
//
// QR Code Generator for JavaScript
//
// Copyright (c) 2009 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//	http://www.opensource.org/licenses/mit-license.php
//
// The word 'QR Code' is registered trademark of
// DENSO WAVE INCORPORATED
//	http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------

var qrcode = function() {

	//---------------------------------------------------------------------
	// qrcode
	//---------------------------------------------------------------------

	/**
	 * qrcode
	 * @param typeNumber 1 to 10
	 * @param errorCorrectLevel 'L','M','Q','H'
	 */
	var qrcode = function(typeNumber, errorCorrectLevel) {

		var PAD0 = 0xEC;
		var PAD1 = 0x11;

		var _typeNumber = typeNumber;
		var _errorCorrectLevel = QRErrorCorrectLevel[errorCorrectLevel];
		var _modules = null;
		var _moduleCount = 0;
		var _dataCache = null;
		var _dataList = new Array();

		var _this = {};

		var makeImpl = function(test, maskPattern) {

			_moduleCount = _typeNumber * 4 + 17;
			_modules = function(moduleCount) {
				var modules = new Array(moduleCount);
				for (var row = 0; row < moduleCount; row += 1) {
					modules[row] = new Array(moduleCount);
					for (var col = 0; col < moduleCount; col += 1) {
						modules[row][col] = null;
					}
				}
				return modules;
			}(_moduleCount);

			setupPositionProbePattern(0, 0);
			setupPositionProbePattern(_moduleCount - 7, 0);
			setupPositionProbePattern(0, _moduleCount - 7);
			setupPositionAdjustPattern();
			setupTimingPattern();
			setupTypeInfo(test, maskPattern);

			if (_typeNumber >= 7) {
				setupTypeNumber(test);
			}

			if (_dataCache == null) {
				_dataCache = createData(_typeNumber, _errorCorrectLevel, _dataList);
			}

			mapData(_dataCache, maskPattern);
		};

		var setupPositionProbePattern = function(row, col) {

			for (var r = -1; r <= 7; r += 1) {

				if (row + r <= -1 || _moduleCount <= row + r) continue;

				for (var c = -1; c <= 7; c += 1) {

					if (col + c <= -1 || _moduleCount <= col + c) continue;

					if ( (0 <= r && r <= 6 && (c == 0 || c == 6) )
							|| (0 <= c && c <= 6 && (r == 0 || r == 6) )
							|| (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
						_modules[row + r][col + c] = true;
					} else {
						_modules[row + r][col + c] = false;
					}
				}
			}
		};

		var getBestMaskPattern = function() {

			var minLostPoint = 0;
			var pattern = 0;

			for (var i = 0; i < 8; i += 1) {

				makeImpl(true, i);

				var lostPoint = QRUtil.getLostPoint(_this);

				if (i == 0 || minLostPoint > lostPoint) {
					minLostPoint = lostPoint;
					pattern = i;
				}
			}

			return pattern;
		};

		var setupTimingPattern = function() {

			for (var r = 8; r < _moduleCount - 8; r += 1) {
				if (_modules[r][6] != null) {
					continue;
				}
				_modules[r][6] = (r % 2 == 0);
			}

			for (var c = 8; c < _moduleCount - 8; c += 1) {
				if (_modules[6][c] != null) {
					continue;
				}
				_modules[6][c] = (c % 2 == 0);
			}
		};

		var setupPositionAdjustPattern = function() {

			var pos = QRUtil.getPatternPosition(_typeNumber);

			for (var i = 0; i < pos.length; i += 1) {

				for (var j = 0; j < pos.length; j += 1) {

					var row = pos[i];
					var col = pos[j];

					if (_modules[row][col] != null) {
						continue;
					}

					for (var r = -2; r <= 2; r += 1) {

						for (var c = -2; c <= 2; c += 1) {

							if (r == -2 || r == 2 || c == -2 || c == 2
									|| (r == 0 && c == 0) ) {
								_modules[row + r][col + c] = true;
							} else {
								_modules[row + r][col + c] = false;
							}
						}
					}
				}
			}
		};

		var setupTypeNumber = function(test) {

			var bits = QRUtil.getBCHTypeNumber(_typeNumber);

			for (var i = 0; i < 18; i += 1) {
				var mod = (!test && ( (bits >> i) & 1) == 1);
				_modules[Math.floor(i / 3)][i % 3 + _moduleCount - 8 - 3] = mod;
			}

			for (var i = 0; i < 18; i += 1) {
				var mod = (!test && ( (bits >> i) & 1) == 1);
				_modules[i % 3 + _moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
			}
		};

		var setupTypeInfo = function(test, maskPattern) {

			var data = (_errorCorrectLevel << 3) | maskPattern;
			var bits = QRUtil.getBCHTypeInfo(data);

			// vertical
			for (var i = 0; i < 15; i += 1) {

				var mod = (!test && ( (bits >> i) & 1) == 1);

				if (i < 6) {
					_modules[i][8] = mod;
				} else if (i < 8) {
					_modules[i + 1][8] = mod;
				} else {
					_modules[_moduleCount - 15 + i][8] = mod;
				}
			}

			// horizontal
			for (var i = 0; i < 15; i += 1) {

				var mod = (!test && ( (bits >> i) & 1) == 1);

				if (i < 8) {
					_modules[8][_moduleCount - i - 1] = mod;
				} else if (i < 9) {
					_modules[8][15 - i - 1 + 1] = mod;
				} else {
					_modules[8][15 - i - 1] = mod;
				}
			}

			// fixed module
			_modules[_moduleCount - 8][8] = (!test);
		};

		var mapData = function(data, maskPattern) {

			var inc = -1;
			var row = _moduleCount - 1;
			var bitIndex = 7;
			var byteIndex = 0;
			var maskFunc = QRUtil.getMaskFunction(maskPattern);

			for (var col = _moduleCount - 1; col > 0; col -= 2) {

				if (col == 6) col -= 1;

				while (true) {

					for (var c = 0; c < 2; c += 1) {

						if (_modules[row][col - c] == null) {

							var dark = false;

							if (byteIndex < data.length) {
								dark = ( ( (data[byteIndex] >>> bitIndex) & 1) == 1);
							}

							var mask = maskFunc(row, col - c);

							if (mask) {
								dark = !dark;
							}

							_modules[row][col - c] = dark;
							bitIndex -= 1;

							if (bitIndex == -1) {
								byteIndex += 1;
								bitIndex = 7;
							}
						}
					}

					row += inc;

					if (row < 0 || _moduleCount <= row) {
						row -= inc;
						inc = -inc;
						break;
					}
				}
			}
		};

		var createBytes = function(buffer, rsBlocks) {

			var offset = 0;

			var maxDcCount = 0;
			var maxEcCount = 0;

			var dcdata = new Array(rsBlocks.length);
			var ecdata = new Array(rsBlocks.length);

			for (var r = 0; r < rsBlocks.length; r += 1) {

				var dcCount = rsBlocks[r].dataCount;
				var ecCount = rsBlocks[r].totalCount - dcCount;

				maxDcCount = Math.max(maxDcCount, dcCount);
				maxEcCount = Math.max(maxEcCount, ecCount);

				dcdata[r] = new Array(dcCount);

				for (var i = 0; i < dcdata[r].length; i += 1) {
					dcdata[r][i] = 0xff & buffer.getBuffer()[i + offset];
				}
				offset += dcCount;

				var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
				var rawPoly = qrPolynomial(dcdata[r], rsPoly.getLength() - 1);

				var modPoly = rawPoly.mod(rsPoly);
				ecdata[r] = new Array(rsPoly.getLength() - 1);
				for (var i = 0; i < ecdata[r].length; i += 1) {
					var modIndex = i + modPoly.getLength() - ecdata[r].length;
					ecdata[r][i] = (modIndex >= 0)? modPoly.getAt(modIndex) : 0;
				}
			}

			var totalCodeCount = 0;
			for (var i = 0; i < rsBlocks.length; i += 1) {
				totalCodeCount += rsBlocks[i].totalCount;
			}

			var data = new Array(totalCodeCount);
			var index = 0;

			for (var i = 0; i < maxDcCount; i += 1) {
				for (var r = 0; r < rsBlocks.length; r += 1) {
					if (i < dcdata[r].length) {
						data[index] = dcdata[r][i];
						index += 1;
					}
				}
			}

			for (var i = 0; i < maxEcCount; i += 1) {
				for (var r = 0; r < rsBlocks.length; r += 1) {
					if (i < ecdata[r].length) {
						data[index] = ecdata[r][i];
						index += 1;
					}
				}
			}

			return data;
		};

		var createData = function(typeNumber, errorCorrectLevel, dataList) {

			var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);

			var buffer = qrBitBuffer();

			for (var i = 0; i < dataList.length; i += 1) {
				var data = dataList[i];
				buffer.put(data.getMode(), 4);
				buffer.put(data.getLength(), QRUtil.getLengthInBits(data.getMode(), typeNumber) );
				data.write(buffer);
			}

			// calc num max data.
			var totalDataCount = 0;
			for (var i = 0; i < rsBlocks.length; i += 1) {
				totalDataCount += rsBlocks[i].dataCount;
			}

			if (buffer.getLengthInBits() > totalDataCount * 8) {
				throw new Error('code length overflow. ('
					+ buffer.getLengthInBits()
					+ '>'
					+ totalDataCount * 8
					+ ')');
			}

			// end code
			if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
				buffer.put(0, 4);
			}

			// padding
			while (buffer.getLengthInBits() % 8 != 0) {
				buffer.putBit(false);
			}

			// padding
			while (true) {

				if (buffer.getLengthInBits() >= totalDataCount * 8) {
					break;
				}
				buffer.put(PAD0, 8);

				if (buffer.getLengthInBits() >= totalDataCount * 8) {
					break;
				}
				buffer.put(PAD1, 8);
			}

			return createBytes(buffer, rsBlocks);
		};

		_this.addData = function(data) {
			var newData = qr8BitByte(data);
			_dataList.push(newData);
			_dataCache = null;
		};

		_this.isDark = function(row, col) {
			if (row < 0 || _moduleCount <= row || col < 0 || _moduleCount <= col) {
				throw new Error(row + ',' + col);
			}
			return _modules[row][col];
		};

		_this.getModuleCount = function() {
			return _moduleCount;
		};

		_this.make = function() {
			makeImpl(false, getBestMaskPattern() );
		};

		_this.createTableTag = function(cellSize, margin) {

			cellSize = cellSize || 2;
			margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

			var qrHtml = '';

			qrHtml += '<table style="';
			qrHtml += ' border-width: 0px; border-style: none;';
			qrHtml += ' border-collapse: collapse;';
			qrHtml += ' padding: 0px; margin: ' + margin + 'px;';
			qrHtml += '">';
			qrHtml += '<tbody>';

			for (var r = 0; r < _this.getModuleCount(); r += 1) {

				qrHtml += '<tr>';

				for (var c = 0; c < _this.getModuleCount(); c += 1) {
					qrHtml += '<td style="';
					qrHtml += ' border-width: 0px; border-style: none;';
					qrHtml += ' border-collapse: collapse;';
					qrHtml += ' padding: 0px; margin: 0px;';
					qrHtml += ' width: ' + cellSize + 'px;';
					qrHtml += ' height: ' + cellSize + 'px;';
					qrHtml += ' background-color: ';
					qrHtml += _this.isDark(r, c)? '#000000' : '#ffffff';
					qrHtml += ';';
					qrHtml += '"/>';
				}

				qrHtml += '</tr>';
			}

			qrHtml += '</tbody>';
			qrHtml += '</table>';

			return qrHtml;
		};

		_this.createImgTag = function(cellSize, margin) {

			cellSize = cellSize || 2;
			margin = (typeof margin == 'undefined')? cellSize * 4 : margin;

			var size = _this.getModuleCount() * cellSize + margin * 2;
			var min = margin;
			var max = size - margin;

			return createImgTag(size, size, function(x, y) {
				if (min <= x && x < max && min <= y && y < max) {
					var c = Math.floor( (x - min) / cellSize);
					var r = Math.floor( (y - min) / cellSize);
					return _this.isDark(r, c)? 0 : 1;
				} else {
					return 1;
				}
			} );
		};

		return _this;
	};

	//---------------------------------------------------------------------
	// qrcode.stringToBytes
	//---------------------------------------------------------------------

	qrcode.stringToBytes = function(s) {
		var bytes = new Array();
		for (var i = 0; i < s.length; i += 1) {
			var c = s.charCodeAt(i);
			bytes.push(c & 0xff);
		}
		return bytes;
	};

	//---------------------------------------------------------------------
	// qrcode.createStringToBytes
	//---------------------------------------------------------------------

	/**
	 * @param unicodeData base64 string of byte array.
	 * [16bit Unicode],[16bit Bytes], ...
	 * @param numChars
	 */
	qrcode.createStringToBytes = function(unicodeData, numChars) {

		// create conversion map.

		var unicodeMap = function() {

			var bin = base64DecodeInputStream(unicodeData);
			var read = function() {
				var b = bin.read();
				if (b == -1) throw new Error();
				return b;
			};

			var count = 0;
			var unicodeMap = {};
			while (true) {
				var b0 = bin.read();
				if (b0 == -1) break;
				var b1 = read();
				var b2 = read();
				var b3 = read();
				var k = String.fromCharCode( (b0 << 8) | b1);
				var v = (b2 << 8) | b3;
				unicodeMap[k] = v;
				count += 1;
			}
			if (count != numChars) {
				throw new Error(count + ' != ' + numChars);
			}

			return unicodeMap;
		}();

		var unknownChar = '?'.charCodeAt(0);

		return function(s) {
			var bytes = new Array();
			for (var i = 0; i < s.length; i += 1) {
				var c = s.charCodeAt(i);
				if (c < 128) {
					bytes.push(c);
				} else {
					var b = unicodeMap[s.charAt(i)];
					if (typeof b == 'number') {
						if ( (b & 0xff) == b) {
							// 1byte
							bytes.push(b);
						} else {
							// 2bytes
							bytes.push(b >>> 8);
							bytes.push(b & 0xff);
						}
					} else {
						bytes.push(unknownChar);
					}
				}
			}
			return bytes;
		};
	};

	//---------------------------------------------------------------------
	// QRMode
	//---------------------------------------------------------------------

	var QRMode = {
		MODE_NUMBER :		1 << 0,
		MODE_ALPHA_NUM : 	1 << 1,
		MODE_8BIT_BYTE : 	1 << 2,
		MODE_KANJI :		1 << 3
	};

	//---------------------------------------------------------------------
	// QRErrorCorrectLevel
	//---------------------------------------------------------------------

	var QRErrorCorrectLevel = {
		L : 1,
		M : 0,
		Q : 3,
		H : 2
	};

	//---------------------------------------------------------------------
	// QRMaskPattern
	//---------------------------------------------------------------------

	var QRMaskPattern = {
		PATTERN000 : 0,
		PATTERN001 : 1,
		PATTERN010 : 2,
		PATTERN011 : 3,
		PATTERN100 : 4,
		PATTERN101 : 5,
		PATTERN110 : 6,
		PATTERN111 : 7
	};

	//---------------------------------------------------------------------
	// QRUtil
	//---------------------------------------------------------------------

	var QRUtil = function() {

		var PATTERN_POSITION_TABLE = [
			[],
			[6, 18],
			[6, 22],
			[6, 26],
			[6, 30],
			[6, 34],
			[6, 22, 38],
			[6, 24, 42],
			[6, 26, 46],
			[6, 28, 50],
			[6, 30, 54],
			[6, 32, 58],
			[6, 34, 62],
			[6, 26, 46, 66],
			[6, 26, 48, 70],
			[6, 26, 50, 74],
			[6, 30, 54, 78],
			[6, 30, 56, 82],
			[6, 30, 58, 86],
			[6, 34, 62, 90],
			[6, 28, 50, 72, 94],
			[6, 26, 50, 74, 98],
			[6, 30, 54, 78, 102],
			[6, 28, 54, 80, 106],
			[6, 32, 58, 84, 110],
			[6, 30, 58, 86, 114],
			[6, 34, 62, 90, 118],
			[6, 26, 50, 74, 98, 122],
			[6, 30, 54, 78, 102, 126],
			[6, 26, 52, 78, 104, 130],
			[6, 30, 56, 82, 108, 134],
			[6, 34, 60, 86, 112, 138],
			[6, 30, 58, 86, 114, 142],
			[6, 34, 62, 90, 118, 146],
			[6, 30, 54, 78, 102, 126, 150],
			[6, 24, 50, 76, 102, 128, 154],
			[6, 28, 54, 80, 106, 132, 158],
			[6, 32, 58, 84, 110, 136, 162],
			[6, 26, 54, 82, 110, 138, 166],
			[6, 30, 58, 86, 114, 142, 170]
		];
		var G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
		var G18 = (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0);
		var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

		var _this = {};

		var getBCHDigit = function(data) {
			var digit = 0;
			while (data != 0) {
				digit += 1;
				data >>>= 1;
			}
			return digit;
		};

		_this.getBCHTypeInfo = function(data) {
			var d = data << 10;
			while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
				d ^= (G15 << (getBCHDigit(d) - getBCHDigit(G15) ) );
			}
			return ( (data << 10) | d) ^ G15_MASK;
		};

		_this.getBCHTypeNumber = function(data) {
			var d = data << 12;
			while (getBCHDigit(d) - getBCHDigit(G18) >= 0) {
				d ^= (G18 << (getBCHDigit(d) - getBCHDigit(G18) ) );
			}
			return (data << 12) | d;
		};

		_this.getPatternPosition = function(typeNumber) {
			return PATTERN_POSITION_TABLE[typeNumber - 1];
		};

		_this.getMaskFunction = function(maskPattern) {

			switch (maskPattern) {

			case QRMaskPattern.PATTERN000 :
				return function(i, j) { return (i + j) % 2 == 0; };
			case QRMaskPattern.PATTERN001 :
				return function(i, j) { return i % 2 == 0; };
			case QRMaskPattern.PATTERN010 :
				return function(i, j) { return j % 3 == 0; };
			case QRMaskPattern.PATTERN011 :
				return function(i, j) { return (i + j) % 3 == 0; };
			case QRMaskPattern.PATTERN100 :
				return function(i, j) { return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 == 0; };
			case QRMaskPattern.PATTERN101 :
				return function(i, j) { return (i * j) % 2 + (i * j) % 3 == 0; };
			case QRMaskPattern.PATTERN110 :
				return function(i, j) { return ( (i * j) % 2 + (i * j) % 3) % 2 == 0; };
			case QRMaskPattern.PATTERN111 :
				return function(i, j) { return ( (i * j) % 3 + (i + j) % 2) % 2 == 0; };

			default :
				throw new Error('bad maskPattern:' + maskPattern);
			}
		};

		_this.getErrorCorrectPolynomial = function(errorCorrectLength) {
			var a = qrPolynomial([1], 0);
			for (var i = 0; i < errorCorrectLength; i += 1) {
				a = a.multiply(qrPolynomial([1, QRMath.gexp(i)], 0) );
			}
			return a;
		};

		_this.getLengthInBits = function(mode, type) {

			if (1 <= type && type < 10) {

				// 1 - 9

				switch(mode) {
				case QRMode.MODE_NUMBER 	: return 10;
				case QRMode.MODE_ALPHA_NUM 	: return 9;
				case QRMode.MODE_8BIT_BYTE	: return 8;
				case QRMode.MODE_KANJI		: return 8;
				default :
					throw new Error('mode:' + mode);
				}

			} else if (type < 27) {

				// 10 - 26

				switch(mode) {
				case QRMode.MODE_NUMBER 	: return 12;
				case QRMode.MODE_ALPHA_NUM 	: return 11;
				case QRMode.MODE_8BIT_BYTE	: return 16;
				case QRMode.MODE_KANJI		: return 10;
				default :
					throw new Error('mode:' + mode);
				}

			} else if (type < 41) {

				// 27 - 40

				switch(mode) {
				case QRMode.MODE_NUMBER 	: return 14;
				case QRMode.MODE_ALPHA_NUM	: return 13;
				case QRMode.MODE_8BIT_BYTE	: return 16;
				case QRMode.MODE_KANJI		: return 12;
				default :
					throw new Error('mode:' + mode);
				}

			} else {
				throw new Error('type:' + type);
			}
		};

		_this.getLostPoint = function(qrcode) {

			var moduleCount = qrcode.getModuleCount();

			var lostPoint = 0;

			// LEVEL1

			for (var row = 0; row < moduleCount; row += 1) {
				for (var col = 0; col < moduleCount; col += 1) {

					var sameCount = 0;
					var dark = qrcode.isDark(row, col);

					for (var r = -1; r <= 1; r += 1) {

						if (row + r < 0 || moduleCount <= row + r) {
							continue;
						}

						for (var c = -1; c <= 1; c += 1) {

							if (col + c < 0 || moduleCount <= col + c) {
								continue;
							}

							if (r == 0 && c == 0) {
								continue;
							}

							if (dark == qrcode.isDark(row + r, col + c) ) {
								sameCount += 1;
							}
						}
					}

					if (sameCount > 5) {
						lostPoint += (3 + sameCount - 5);
					}
				}
			};

			// LEVEL2

			for (var row = 0; row < moduleCount - 1; row += 1) {
				for (var col = 0; col < moduleCount - 1; col += 1) {
					var count = 0;
					if (qrcode.isDark(row, col) ) count += 1;
					if (qrcode.isDark(row + 1, col) ) count += 1;
					if (qrcode.isDark(row, col + 1) ) count += 1;
					if (qrcode.isDark(row + 1, col + 1) ) count += 1;
					if (count == 0 || count == 4) {
						lostPoint += 3;
					}
				}
			}

			// LEVEL3

			for (var row = 0; row < moduleCount; row += 1) {
				for (var col = 0; col < moduleCount - 6; col += 1) {
					if (qrcode.isDark(row, col)
							&& !qrcode.isDark(row, col + 1)
							&&  qrcode.isDark(row, col + 2)
							&&  qrcode.isDark(row, col + 3)
							&&  qrcode.isDark(row, col + 4)
							&& !qrcode.isDark(row, col + 5)
							&&  qrcode.isDark(row, col + 6) ) {
						lostPoint += 40;
					}
				}
			}

			for (var col = 0; col < moduleCount; col += 1) {
				for (var row = 0; row < moduleCount - 6; row += 1) {
					if (qrcode.isDark(row, col)
							&& !qrcode.isDark(row + 1, col)
							&&  qrcode.isDark(row + 2, col)
							&&  qrcode.isDark(row + 3, col)
							&&  qrcode.isDark(row + 4, col)
							&& !qrcode.isDark(row + 5, col)
							&&  qrcode.isDark(row + 6, col) ) {
						lostPoint += 40;
					}
				}
			}

			// LEVEL4

			var darkCount = 0;

			for (var col = 0; col < moduleCount; col += 1) {
				for (var row = 0; row < moduleCount; row += 1) {
					if (qrcode.isDark(row, col) ) {
						darkCount += 1;
					}
				}
			}

			var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
			lostPoint += ratio * 10;

			return lostPoint;
		};

		return _this;
	}();

	//---------------------------------------------------------------------
	// QRMath
	//---------------------------------------------------------------------

	var QRMath = function() {

		var EXP_TABLE = new Array(256);
		var LOG_TABLE = new Array(256);

		// initialize tables
		for (var i = 0; i < 8; i += 1) {
			EXP_TABLE[i] = 1 << i;
		}
		for (var i = 8; i < 256; i += 1) {
			EXP_TABLE[i] = EXP_TABLE[i - 4]
				^ EXP_TABLE[i - 5]
				^ EXP_TABLE[i - 6]
				^ EXP_TABLE[i - 8];
		}
		for (var i = 0; i < 255; i += 1) {
			LOG_TABLE[EXP_TABLE[i] ] = i;
		}

		var _this = {};

		_this.glog = function(n) {

			if (n < 1) {
				throw new Error('glog(' + n + ')');
			}

			return LOG_TABLE[n];
		};

		_this.gexp = function(n) {

			while (n < 0) {
				n += 255;
			}

			while (n >= 256) {
				n -= 255;
			}

			return EXP_TABLE[n];
		};

		return _this;
	}();

	//---------------------------------------------------------------------
	// qrPolynomial
	//---------------------------------------------------------------------

	function qrPolynomial(num, shift) {

		if (typeof num.length == 'undefined') {
			throw new Error(num.length + '/' + shift);
		}

		var _num = function() {
			var offset = 0;
			while (offset < num.length && num[offset] == 0) {
				offset += 1;
			}
			var _num = new Array(num.length - offset + shift);
			for (var i = 0; i < num.length - offset; i += 1) {
				_num[i] = num[i + offset];
			}
			return _num;
		}();

		var _this = {};

		_this.getAt = function(index) {
			return _num[index];
		};

		_this.getLength = function() {
			return _num.length;
		};

		_this.multiply = function(e) {

			var num = new Array(_this.getLength() + e.getLength() - 1);

			for (var i = 0; i < _this.getLength(); i += 1) {
				for (var j = 0; j < e.getLength(); j += 1) {
					num[i + j] ^= QRMath.gexp(QRMath.glog(_this.getAt(i) ) + QRMath.glog(e.getAt(j) ) );
				}
			}

			return qrPolynomial(num, 0);
		};

		_this.mod = function(e) {

			if (_this.getLength() - e.getLength() < 0) {
				return _this;
			}

			var ratio = QRMath.glog(_this.getAt(0) ) - QRMath.glog(e.getAt(0) );

			var num = new Array(_this.getLength() );
			for (var i = 0; i < _this.getLength(); i += 1) {
				num[i] = _this.getAt(i);
			}

			for (var i = 0; i < e.getLength(); i += 1) {
				num[i] ^= QRMath.gexp(QRMath.glog(e.getAt(i) ) + ratio);
			}

			// recursive call
			return qrPolynomial(num, 0).mod(e);
		};

		return _this;
	};

	//---------------------------------------------------------------------
	// QRRSBlock
	//---------------------------------------------------------------------

	var QRRSBlock = function() {

		var RS_BLOCK_TABLE = [

			// L
			// M
			// Q
			// H

			// 1
			[1, 26, 19],
			[1, 26, 16],
			[1, 26, 13],
			[1, 26, 9],

			// 2
			[1, 44, 34],
			[1, 44, 28],
			[1, 44, 22],
			[1, 44, 16],

			// 3
			[1, 70, 55],
			[1, 70, 44],
			[2, 35, 17],
			[2, 35, 13],

			// 4
			[1, 100, 80],
			[2, 50, 32],
			[2, 50, 24],
			[4, 25, 9],

			// 5
			[1, 134, 108],
			[2, 67, 43],
			[2, 33, 15, 2, 34, 16],
			[2, 33, 11, 2, 34, 12],

			// 6
			[2, 86, 68],
			[4, 43, 27],
			[4, 43, 19],
			[4, 43, 15],

			// 7
			[2, 98, 78],
			[4, 49, 31],
			[2, 32, 14, 4, 33, 15],
			[4, 39, 13, 1, 40, 14],

			// 8
			[2, 121, 97],
			[2, 60, 38, 2, 61, 39],
			[4, 40, 18, 2, 41, 19],
			[4, 40, 14, 2, 41, 15],

			// 9
			[2, 146, 116],
			[3, 58, 36, 2, 59, 37],
			[4, 36, 16, 4, 37, 17],
			[4, 36, 12, 4, 37, 13],

			// 10
			[2, 86, 68, 2, 87, 69],
			[4, 69, 43, 1, 70, 44],
			[6, 43, 19, 2, 44, 20],
			[6, 43, 15, 2, 44, 16]
		];

		var qrRSBlock = function(totalCount, dataCount) {
			var _this = {};
			_this.totalCount = totalCount;
			_this.dataCount = dataCount;
			return _this;
		};

		var _this = {};

		var getRsBlockTable = function(typeNumber, errorCorrectLevel) {

			switch(errorCorrectLevel) {
			case QRErrorCorrectLevel.L :
				return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
			case QRErrorCorrectLevel.M :
				return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
			case QRErrorCorrectLevel.Q :
				return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
			case QRErrorCorrectLevel.H :
				return RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
			default :
				return undefined;
			}
		};

		_this.getRSBlocks = function(typeNumber, errorCorrectLevel) {

			var rsBlock = getRsBlockTable(typeNumber, errorCorrectLevel);

			if (typeof rsBlock == 'undefined') {
				throw new Error('bad rs block @ typeNumber:' + typeNumber +
						'/errorCorrectLevel:' + errorCorrectLevel);
			}

			var length = rsBlock.length / 3;

			var list = new Array();

			for (var i = 0; i < length; i += 1) {

				var count = rsBlock[i * 3 + 0];
				var totalCount = rsBlock[i * 3 + 1];
				var dataCount = rsBlock[i * 3 + 2];

				for (var j = 0; j < count; j += 1) {
					list.push(qrRSBlock(totalCount, dataCount) );
				}
			}

			return list;
		};

		return _this;
	}();

	//---------------------------------------------------------------------
	// qrBitBuffer
	//---------------------------------------------------------------------

	var qrBitBuffer = function() {

		var _buffer = new Array();
		var _length = 0;

		var _this = {};

		_this.getBuffer = function() {
			return _buffer;
		};

		_this.getAt = function(index) {
			var bufIndex = Math.floor(index / 8);
			return ( (_buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
		};

		_this.put = function(num, length) {
			for (var i = 0; i < length; i += 1) {
				_this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
			}
		};

		_this.getLengthInBits = function() {
			return _length;
		};

		_this.putBit = function(bit) {

			var bufIndex = Math.floor(_length / 8);
			if (_buffer.length <= bufIndex) {
				_buffer.push(0);
			}

			if (bit) {
				_buffer[bufIndex] |= (0x80 >>> (_length % 8) );
			}

			_length += 1;
		};

		return _this;
	};

	//---------------------------------------------------------------------
	// qr8BitByte
	//---------------------------------------------------------------------

	var qr8BitByte = function(data) {

		var _mode = QRMode.MODE_8BIT_BYTE;
		var _data = data;
		var _bytes = qrcode.stringToBytes(data);

		var _this = {};

		_this.getMode = function() {
			return _mode;
		};

		_this.getLength = function(buffer) {
			return _bytes.length;
		};

		_this.write = function(buffer) {
			for (var i = 0; i < _bytes.length; i += 1) {
				buffer.put(_bytes[i], 8);
			}
		};

		return _this;
	};

	//=====================================================================
	// GIF Support etc.
	//

	//---------------------------------------------------------------------
	// byteArrayOutputStream
	//---------------------------------------------------------------------

	var byteArrayOutputStream = function() {

		var _bytes = new Array();

		var _this = {};

		_this.writeByte = function(b) {
			_bytes.push(b & 0xff);
		};

		_this.writeShort = function(i) {
			_this.writeByte(i);
			_this.writeByte(i >>> 8);
		};

		_this.writeBytes = function(b, off, len) {
			off = off || 0;
			len = len || b.length;
			for (var i = 0; i < len; i += 1) {
				_this.writeByte(b[i + off]);
			}
		};

		_this.writeString = function(s) {
			for (var i = 0; i < s.length; i += 1) {
				_this.writeByte(s.charCodeAt(i) );
			}
		};

		_this.toByteArray = function() {
			return _bytes;
		};

		_this.toString = function() {
			var s = '';
			s += '[';
			for (var i = 0; i < _bytes.length; i += 1) {
				if (i > 0) {
					s += ',';
				}
				s += _bytes[i];
			}
			s += ']';
			return s;
		};

		return _this;
	};

	//---------------------------------------------------------------------
	// base64EncodeOutputStream
	//---------------------------------------------------------------------

	var base64EncodeOutputStream = function() {

		var _buffer = 0;
		var _buflen = 0;
		var _length = 0;
		var _base64 = '';

		var _this = {};

		var writeEncoded = function(b) {
			_base64 += String.fromCharCode(encode(b & 0x3f) );
		};

		var encode = function(n) {
			if (n < 0) {
				// error.
			} else if (n < 26) {
				return 0x41 + n;
			} else if (n < 52) {
				return 0x61 + (n - 26);
			} else if (n < 62) {
				return 0x30 + (n - 52);
			} else if (n == 62) {
				return 0x2b;
			} else if (n == 63) {
				return 0x2f;
			}
			throw new Error('n:' + n);
		};

		_this.writeByte = function(n) {

			_buffer = (_buffer << 8) | (n & 0xff);
			_buflen += 8;
			_length += 1;

			while (_buflen >= 6) {
				writeEncoded(_buffer >>> (_buflen - 6) );
				_buflen -= 6;
			}
		};

		_this.flush = function() {

			if (_buflen > 0) {
				writeEncoded(_buffer << (6 - _buflen) );
				_buffer = 0;
				_buflen = 0;
			}

			if (_length % 3 != 0) {
				// padding
				var padlen = 3 - _length % 3;
				for (var i = 0; i < padlen; i += 1) {
					_base64 += '=';
				}
			}
		};

		_this.toString = function() {
			return _base64;
		};

		return _this;
	};

	//---------------------------------------------------------------------
	// base64DecodeInputStream
	//---------------------------------------------------------------------

	var base64DecodeInputStream = function(str) {

		var _str = str;
		var _pos = 0;
		var _buffer = 0;
		var _buflen = 0;

		var _this = {};

		_this.read = function() {

			while (_buflen < 8) {

				if (_pos >= _str.length) {
					if (_buflen == 0) {
						return -1;
					}
					throw new Error('unexpected end of file./' + _buflen);
				}

				var c = _str.charAt(_pos);
				_pos += 1;

				if (c == '=') {
					_buflen = 0;
					return -1;
				} else if (c.match(/^\s$/) ) {
					// ignore if whitespace.
					continue;
				}

				_buffer = (_buffer << 6) | decode(c.charCodeAt(0) );
				_buflen += 6;
			}

			var n = (_buffer >>> (_buflen - 8) ) & 0xff;
			_buflen -= 8;
			return n;
		};

		var decode = function(c) {
			if (0x41 <= c && c <= 0x5a) {
				return c - 0x41;
			} else if (0x61 <= c && c <= 0x7a) {
				return c - 0x61 + 26;
			} else if (0x30 <= c && c <= 0x39) {
				return c - 0x30 + 52;
			} else if (c == 0x2b) {
				return 62;
			} else if (c == 0x2f) {
				return 63;
			} else {
				throw new Error('c:' + c);
			}
		};

		return _this;
	};

	//---------------------------------------------------------------------
	// gifImage (B/W)
	//---------------------------------------------------------------------

	var gifImage = function(width, height) {

		var _width = width;
		var _height = height;
		var _data = new Array(width * height);

		var _this = {};

		_this.setPixel = function(x, y, pixel) {
			_data[y * _width + x] = pixel;
		};

		_this.write = function(out) {

			//---------------------------------
			// GIF Signature

			out.writeString('GIF87a');

			//---------------------------------
			// Screen Descriptor

			out.writeShort(_width);
			out.writeShort(_height);

			out.writeByte(0x80); // 2bit
			out.writeByte(0);
			out.writeByte(0);

			//---------------------------------
			// Global Color Map

			// black
			out.writeByte(0x00);
			out.writeByte(0x00);
			out.writeByte(0x00);

			// white
			out.writeByte(0xff);
			out.writeByte(0xff);
			out.writeByte(0xff);

			//---------------------------------
			// Image Descriptor

			out.writeString(',');
			out.writeShort(0);
			out.writeShort(0);
			out.writeShort(_width);
			out.writeShort(_height);
			out.writeByte(0);

			//---------------------------------
			// Local Color Map

			//---------------------------------
			// Raster Data

			var lzwMinCodeSize = 2;
			var raster = getLZWRaster(lzwMinCodeSize);

			out.writeByte(lzwMinCodeSize);

			var offset = 0;

			while (raster.length - offset > 255) {
				out.writeByte(255);
				out.writeBytes(raster, offset, 255);
				offset += 255;
			}

			out.writeByte(raster.length - offset);
			out.writeBytes(raster, offset, raster.length - offset);
			out.writeByte(0x00);

			//---------------------------------
			// GIF Terminator
			out.writeString(';');
		};

		var bitOutputStream = function(out) {

			var _out = out;
			var _bitLength = 0;
			var _bitBuffer = 0;

			var _this = {};

			_this.write = function(data, length) {

				if ( (data >>> length) != 0) {
					throw new Error('length over');
				}

				while (_bitLength + length >= 8) {
					_out.writeByte(0xff & ( (data << _bitLength) | _bitBuffer) );
					length -= (8 - _bitLength);
					data >>>= (8 - _bitLength);
					_bitBuffer = 0;
					_bitLength = 0;
				}

				_bitBuffer = (data << _bitLength) | _bitBuffer;
				_bitLength = _bitLength + length;
			};

			_this.flush = function() {
				if (_bitLength > 0) {
					_out.writeByte(_bitBuffer);
				}
			};

			return _this;
		};

		var getLZWRaster = function(lzwMinCodeSize) {

			var clearCode = 1 << lzwMinCodeSize;
			var endCode = (1 << lzwMinCodeSize) + 1;
			var bitLength = lzwMinCodeSize + 1;

			// Setup LZWTable
			var table = lzwTable();

			for (var i = 0; i < clearCode; i += 1) {
				table.add(String.fromCharCode(i) );
			}
			table.add(String.fromCharCode(clearCode) );
			table.add(String.fromCharCode(endCode) );

			var byteOut = byteArrayOutputStream();
			var bitOut = bitOutputStream(byteOut);

			// clear code
			bitOut.write(clearCode, bitLength);

			var dataIndex = 0;

			var s = String.fromCharCode(_data[dataIndex]);
			dataIndex += 1;

			while (dataIndex < _data.length) {

				var c = String.fromCharCode(_data[dataIndex]);
				dataIndex += 1;

				if (table.contains(s + c) ) {

					s = s + c;

				} else {

					bitOut.write(table.indexOf(s), bitLength);

					if (table.size() < 0xfff) {

						if (table.size() == (1 << bitLength) ) {
							bitLength += 1;
						}

						table.add(s + c);
					}

					s = c;
				}
			}

			bitOut.write(table.indexOf(s), bitLength);

			// end code
			bitOut.write(endCode, bitLength);

			bitOut.flush();

			return byteOut.toByteArray();
		};

		var lzwTable = function() {

			var _map = {};
			var _size = 0;

			var _this = {};

			_this.add = function(key) {
				if (_this.contains(key) ) {
					throw new Error('dup key:' + key);
				}
				_map[key] = _size;
				_size += 1;
			};

			_this.size = function() {
				return _size;
			};

			_this.indexOf = function(key) {
				return _map[key];
			};

			_this.contains = function(key) {
				return typeof _map[key] != 'undefined';
			};

			return _this;
		};

		return _this;
	};

	var createImgTag = function(width, height, getPixel, alt) {

		var gif = gifImage(width, height);
		for (var y = 0; y < height; y += 1) {
			for (var x = 0; x < width; x += 1) {
				gif.setPixel(x, y, getPixel(x, y) );
			}
		}

		var b = byteArrayOutputStream();
		gif.write(b);

		var base64 = base64EncodeOutputStream();
		var bytes = b.toByteArray();
		for (var i = 0; i < bytes.length; i += 1) {
			base64.writeByte(bytes[i]);
		}
		base64.flush();

		var img = '';
		img += '<img';
		img += '\u0020src="';
		img += 'data:image/gif;base64,';
		img += base64;
		img += '"';
		img += '\u0020width="';
		img += width;
		img += '"';
		img += '\u0020height="';
		img += height;
		img += '"';
		if (alt) {
			img += '\u0020alt="';
			img += alt;
			img += '"';
		}
		img += '/>';

		return img;
	};

	//---------------------------------------------------------------------
	// returns qrcode function.

	return qrcode;
}();

// Source: public/src/js/jsqrcode/grid.js
/*
  Ported to JavaScript by Lazar Laszlo 2011 
  
  lazarsoft@gmail.com, www.lazarsoft.info
  
*/

/*
*
* Copyright 2007 ZXing authors
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*      http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/


GridSampler = {};

GridSampler.checkAndNudgePoints=function( image,  points)
		{
			var width = qrcode.width;
			var height = qrcode.height;
			// Check and nudge points from start until we see some that are OK:
			var nudged = true;
			for (var offset = 0; offset < points.length && nudged; offset += 2)
			{
				var x = Math.floor (points[offset]);
				var y = Math.floor( points[offset + 1]);
				if (x < - 1 || x > width || y < - 1 || y > height)
				{
					throw "Error.checkAndNudgePoints ";
				}
				nudged = false;
				if (x == - 1)
				{
					points[offset] = 0.0;
					nudged = true;
				}
				else if (x == width)
				{
					points[offset] = width - 1;
					nudged = true;
				}
				if (y == - 1)
				{
					points[offset + 1] = 0.0;
					nudged = true;
				}
				else if (y == height)
				{
					points[offset + 1] = height - 1;
					nudged = true;
				}
			}
			// Check and nudge points from end:
			nudged = true;
			for (var offset = points.length - 2; offset >= 0 && nudged; offset -= 2)
			{
				var x = Math.floor( points[offset]);
				var y = Math.floor( points[offset + 1]);
				if (x < - 1 || x > width || y < - 1 || y > height)
				{
					throw "Error.checkAndNudgePoints ";
				}
				nudged = false;
				if (x == - 1)
				{
					points[offset] = 0.0;
					nudged = true;
				}
				else if (x == width)
				{
					points[offset] = width - 1;
					nudged = true;
				}
				if (y == - 1)
				{
					points[offset + 1] = 0.0;
					nudged = true;
				}
				else if (y == height)
				{
					points[offset + 1] = height - 1;
					nudged = true;
				}
			}
		}
	


GridSampler.sampleGrid3=function( image,  dimension,  transform)
		{
			var bits = new BitMatrix(dimension);
			var points = new Array(dimension << 1);
			for (var y = 0; y < dimension; y++)
			{
				var max = points.length;
				var iValue =  y + 0.5;
				for (var x = 0; x < max; x += 2)
				{
					points[x] =  (x >> 1) + 0.5;
					points[x + 1] = iValue;
				}
				transform.transformPoints1(points);
				// Quick check to see if points transformed to something inside the image;
				// sufficient to check the endpoints
				GridSampler.checkAndNudgePoints(image, points);
				try
				{
					for (var x = 0; x < max; x += 2)
					{
						var xpoint = (Math.floor( points[x]) * 4) + (Math.floor( points[x + 1]) * qrcode.width * 4);
                        var bit = image[Math.floor( points[x])+ qrcode.width* Math.floor( points[x + 1])];
						qrcode.imagedata.data[xpoint] = bit?255:0;
						qrcode.imagedata.data[xpoint+1] = bit?255:0;
						qrcode.imagedata.data[xpoint+2] = 0;
						qrcode.imagedata.data[xpoint+3] = 255;
						//bits[x >> 1][ y]=bit;
						if(bit)
							bits.set_Renamed(x >> 1, y);
					}
				}
				catch ( aioobe)
				{
					// This feels wrong, but, sometimes if the finder patterns are misidentified, the resulting
					// transform gets "twisted" such that it maps a straight line of points to a set of points
					// whose endpoints are in bounds, but others are not. There is probably some mathematical
					// way to detect this about the transformation that I don't know yet.
					// This results in an ugly runtime exception despite our clever checks above -- can't have
					// that. We could check each point's coordinates but that feels duplicative. We settle for
					// catching and wrapping ArrayIndexOutOfBoundsException.
					throw "Error.checkAndNudgePoints";
				}
			}
			return bits;
		}

GridSampler.sampleGridx=function( image,  dimension,  p1ToX,  p1ToY,  p2ToX,  p2ToY,  p3ToX,  p3ToY,  p4ToX,  p4ToY,  p1FromX,  p1FromY,  p2FromX,  p2FromY,  p3FromX,  p3FromY,  p4FromX,  p4FromY)
{
	var transform = PerspectiveTransform.quadrilateralToQuadrilateral(p1ToX, p1ToY, p2ToX, p2ToY, p3ToX, p3ToY, p4ToX, p4ToY, p1FromX, p1FromY, p2FromX, p2FromY, p3FromX, p3FromY, p4FromX, p4FromY);
			
	return GridSampler.sampleGrid3(image, dimension, transform);
}

// Source: public/src/js/jsqrcode/version.js
/*
  Ported to JavaScript by Lazar Laszlo 2011 
  
  lazarsoft@gmail.com, www.lazarsoft.info
  
*/

/*
*
* Copyright 2007 ZXing authors
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*      http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/



function ECB(count,  dataCodewords)
{
	this.count = count;
	this.dataCodewords = dataCodewords;
	
	this.__defineGetter__("Count", function()
	{
		return this.count;
	});
	this.__defineGetter__("DataCodewords", function()
	{
		return this.dataCodewords;
	});
}

function ECBlocks( ecCodewordsPerBlock,  ecBlocks1,  ecBlocks2)
{
	this.ecCodewordsPerBlock = ecCodewordsPerBlock;
	if(ecBlocks2)
		this.ecBlocks = new Array(ecBlocks1, ecBlocks2);
	else
		this.ecBlocks = new Array(ecBlocks1);
	
	this.__defineGetter__("ECCodewordsPerBlock", function()
	{
		return this.ecCodewordsPerBlock;
	});
	
	this.__defineGetter__("TotalECCodewords", function()
	{
		return  this.ecCodewordsPerBlock * this.NumBlocks;
	});
	
	this.__defineGetter__("NumBlocks", function()
	{
		var total = 0;
		for (var i = 0; i < this.ecBlocks.length; i++)
		{
			total += this.ecBlocks[i].length;
		}
		return total;
	});
	
	this.getECBlocks=function()
			{
				return this.ecBlocks;
			}
}

function Version( versionNumber,  alignmentPatternCenters,  ecBlocks1,  ecBlocks2,  ecBlocks3,  ecBlocks4)
{
	this.versionNumber = versionNumber;
	this.alignmentPatternCenters = alignmentPatternCenters;
	this.ecBlocks = new Array(ecBlocks1, ecBlocks2, ecBlocks3, ecBlocks4);
	
	var total = 0;
	var ecCodewords = ecBlocks1.ECCodewordsPerBlock;
	var ecbArray = ecBlocks1.getECBlocks();
	for (var i = 0; i < ecbArray.length; i++)
	{
		var ecBlock = ecbArray[i];
		total += ecBlock.Count * (ecBlock.DataCodewords + ecCodewords);
	}
	this.totalCodewords = total;
	
	this.__defineGetter__("VersionNumber", function()
	{
		return  this.versionNumber;
	});
	
	this.__defineGetter__("AlignmentPatternCenters", function()
	{
		return  this.alignmentPatternCenters;
	});
	this.__defineGetter__("TotalCodewords", function()
	{
		return  this.totalCodewords;
	});
	this.__defineGetter__("DimensionForVersion", function()
	{
		return  17 + 4 * this.versionNumber;
	});
	
	this.buildFunctionPattern=function()
		{
			var dimension = this.DimensionForVersion;
			var bitMatrix = new BitMatrix(dimension);
			
			// Top left finder pattern + separator + format
			bitMatrix.setRegion(0, 0, 9, 9);
			// Top right finder pattern + separator + format
			bitMatrix.setRegion(dimension - 8, 0, 8, 9);
			// Bottom left finder pattern + separator + format
			bitMatrix.setRegion(0, dimension - 8, 9, 8);
			
			// Alignment patterns
			var max = this.alignmentPatternCenters.length;
			for (var x = 0; x < max; x++)
			{
				var i = this.alignmentPatternCenters[x] - 2;
				for (var y = 0; y < max; y++)
				{
					if ((x == 0 && (y == 0 || y == max - 1)) || (x == max - 1 && y == 0))
					{
						// No alignment patterns near the three finder paterns
						continue;
					}
					bitMatrix.setRegion(this.alignmentPatternCenters[y] - 2, i, 5, 5);
				}
			}
			
			// Vertical timing pattern
			bitMatrix.setRegion(6, 9, 1, dimension - 17);
			// Horizontal timing pattern
			bitMatrix.setRegion(9, 6, dimension - 17, 1);
			
			if (this.versionNumber > 6)
			{
				// Version info, top right
				bitMatrix.setRegion(dimension - 11, 0, 3, 6);
				// Version info, bottom left
				bitMatrix.setRegion(0, dimension - 11, 6, 3);
			}
			
			return bitMatrix;
		}
	this.getECBlocksForLevel=function( ecLevel)
	{
		return this.ecBlocks[ecLevel.ordinal()];
	}
}

Version.VERSION_DECODE_INFO = new Array(0x07C94, 0x085BC, 0x09A99, 0x0A4D3, 0x0BBF6, 0x0C762, 0x0D847, 0x0E60D, 0x0F928, 0x10B78, 0x1145D, 0x12A17, 0x13532, 0x149A6, 0x15683, 0x168C9, 0x177EC, 0x18EC4, 0x191E1, 0x1AFAB, 0x1B08E, 0x1CC1A, 0x1D33F, 0x1ED75, 0x1F250, 0x209D5, 0x216F0, 0x228BA, 0x2379F, 0x24B0B, 0x2542E, 0x26A64, 0x27541, 0x28C69);

Version.VERSIONS = buildVersions();

Version.getVersionForNumber=function( versionNumber)
{
	if (versionNumber < 1 || versionNumber > 40)
	{
		throw "ArgumentException";
	}
	return Version.VERSIONS[versionNumber - 1];
}

Version.getProvisionalVersionForDimension=function(dimension)
{
	if (dimension % 4 != 1)
	{
		throw "Error getProvisionalVersionForDimension";
	}
	try
	{
		return Version.getVersionForNumber((dimension - 17) >> 2);
	}
	catch ( iae)
	{
		throw "Error getVersionForNumber";
	}
}

Version.decodeVersionInformation=function( versionBits)
{
	var bestDifference = 0xffffffff;
	var bestVersion = 0;
	for (var i = 0; i < Version.VERSION_DECODE_INFO.length; i++)
	{
		var targetVersion = Version.VERSION_DECODE_INFO[i];
		// Do the version info bits match exactly? done.
		if (targetVersion == versionBits)
		{
			return this.getVersionForNumber(i + 7);
		}
		// Otherwise see if this is the closest to a real version info bit string
		// we have seen so far
		var bitsDifference = FormatInformation.numBitsDiffering(versionBits, targetVersion);
		if (bitsDifference < bestDifference)
		{
			bestVersion = i + 7;
			bestDifference = bitsDifference;
		}
	}
	// We can tolerate up to 3 bits of error since no two version info codewords will
	// differ in less than 4 bits.
	if (bestDifference <= 3)
	{
		return this.getVersionForNumber(bestVersion);
	}
	// If we didn't find a close enough match, fail
	return null;
}

function buildVersions()
{
	return new Array(new Version(1, new Array(), new ECBlocks(7, new ECB(1, 19)), new ECBlocks(10, new ECB(1, 16)), new ECBlocks(13, new ECB(1, 13)), new ECBlocks(17, new ECB(1, 9))), 
	new Version(2, new Array(6, 18), new ECBlocks(10, new ECB(1, 34)), new ECBlocks(16, new ECB(1, 28)), new ECBlocks(22, new ECB(1, 22)), new ECBlocks(28, new ECB(1, 16))), 
	new Version(3, new Array(6, 22), new ECBlocks(15, new ECB(1, 55)), new ECBlocks(26, new ECB(1, 44)), new ECBlocks(18, new ECB(2, 17)), new ECBlocks(22, new ECB(2, 13))), 
	new Version(4, new Array(6, 26), new ECBlocks(20, new ECB(1, 80)), new ECBlocks(18, new ECB(2, 32)), new ECBlocks(26, new ECB(2, 24)), new ECBlocks(16, new ECB(4, 9))), 
	new Version(5, new Array(6, 30), new ECBlocks(26, new ECB(1, 108)), new ECBlocks(24, new ECB(2, 43)), new ECBlocks(18, new ECB(2, 15), new ECB(2, 16)), new ECBlocks(22, new ECB(2, 11), new ECB(2, 12))), 
	new Version(6, new Array(6, 34), new ECBlocks(18, new ECB(2, 68)), new ECBlocks(16, new ECB(4, 27)), new ECBlocks(24, new ECB(4, 19)), new ECBlocks(28, new ECB(4, 15))), 
	new Version(7, new Array(6, 22, 38), new ECBlocks(20, new ECB(2, 78)), new ECBlocks(18, new ECB(4, 31)), new ECBlocks(18, new ECB(2, 14), new ECB(4, 15)), new ECBlocks(26, new ECB(4, 13), new ECB(1, 14))), 
	new Version(8, new Array(6, 24, 42), new ECBlocks(24, new ECB(2, 97)), new ECBlocks(22, new ECB(2, 38), new ECB(2, 39)), new ECBlocks(22, new ECB(4, 18), new ECB(2, 19)), new ECBlocks(26, new ECB(4, 14), new ECB(2, 15))), 
	new Version(9, new Array(6, 26, 46), new ECBlocks(30, new ECB(2, 116)), new ECBlocks(22, new ECB(3, 36), new ECB(2, 37)), new ECBlocks(20, new ECB(4, 16), new ECB(4, 17)), new ECBlocks(24, new ECB(4, 12), new ECB(4, 13))), 
	new Version(10, new Array(6, 28, 50), new ECBlocks(18, new ECB(2, 68), new ECB(2, 69)), new ECBlocks(26, new ECB(4, 43), new ECB(1, 44)), new ECBlocks(24, new ECB(6, 19), new ECB(2, 20)), new ECBlocks(28, new ECB(6, 15), new ECB(2, 16))), 
	new Version(11, new Array(6, 30, 54), new ECBlocks(20, new ECB(4, 81)), new ECBlocks(30, new ECB(1, 50), new ECB(4, 51)), new ECBlocks(28, new ECB(4, 22), new ECB(4, 23)), new ECBlocks(24, new ECB(3, 12), new ECB(8, 13))), 
	new Version(12, new Array(6, 32, 58), new ECBlocks(24, new ECB(2, 92), new ECB(2, 93)), new ECBlocks(22, new ECB(6, 36), new ECB(2, 37)), new ECBlocks(26, new ECB(4, 20), new ECB(6, 21)), new ECBlocks(28, new ECB(7, 14), new ECB(4, 15))), 
	new Version(13, new Array(6, 34, 62), new ECBlocks(26, new ECB(4, 107)), new ECBlocks(22, new ECB(8, 37), new ECB(1, 38)), new ECBlocks(24, new ECB(8, 20), new ECB(4, 21)), new ECBlocks(22, new ECB(12, 11), new ECB(4, 12))), 
	new Version(14, new Array(6, 26, 46, 66), new ECBlocks(30, new ECB(3, 115), new ECB(1, 116)), new ECBlocks(24, new ECB(4, 40), new ECB(5, 41)), new ECBlocks(20, new ECB(11, 16), new ECB(5, 17)), new ECBlocks(24, new ECB(11, 12), new ECB(5, 13))), 
	new Version(15, new Array(6, 26, 48, 70), new ECBlocks(22, new ECB(5, 87), new ECB(1, 88)), new ECBlocks(24, new ECB(5, 41), new ECB(5, 42)), new ECBlocks(30, new ECB(5, 24), new ECB(7, 25)), new ECBlocks(24, new ECB(11, 12), new ECB(7, 13))), 
	new Version(16, new Array(6, 26, 50, 74), new ECBlocks(24, new ECB(5, 98), new ECB(1, 99)), new ECBlocks(28, new ECB(7, 45), new ECB(3, 46)), new ECBlocks(24, new ECB(15, 19), new ECB(2, 20)), new ECBlocks(30, new ECB(3, 15), new ECB(13, 16))), 
	new Version(17, new Array(6, 30, 54, 78), new ECBlocks(28, new ECB(1, 107), new ECB(5, 108)), new ECBlocks(28, new ECB(10, 46), new ECB(1, 47)), new ECBlocks(28, new ECB(1, 22), new ECB(15, 23)), new ECBlocks(28, new ECB(2, 14), new ECB(17, 15))), 
	new Version(18, new Array(6, 30, 56, 82), new ECBlocks(30, new ECB(5, 120), new ECB(1, 121)), new ECBlocks(26, new ECB(9, 43), new ECB(4, 44)), new ECBlocks(28, new ECB(17, 22), new ECB(1, 23)), new ECBlocks(28, new ECB(2, 14), new ECB(19, 15))), 
	new Version(19, new Array(6, 30, 58, 86), new ECBlocks(28, new ECB(3, 113), new ECB(4, 114)), new ECBlocks(26, new ECB(3, 44), new ECB(11, 45)), new ECBlocks(26, new ECB(17, 21), new ECB(4, 22)), new ECBlocks(26, new ECB(9, 13), new ECB(16, 14))), 
	new Version(20, new Array(6, 34, 62, 90), new ECBlocks(28, new ECB(3, 107), new ECB(5, 108)), new ECBlocks(26, new ECB(3, 41), new ECB(13, 42)), new ECBlocks(30, new ECB(15, 24), new ECB(5, 25)), new ECBlocks(28, new ECB(15, 15), new ECB(10, 16))), 
	new Version(21, new Array(6, 28, 50, 72, 94), new ECBlocks(28, new ECB(4, 116), new ECB(4, 117)), new ECBlocks(26, new ECB(17, 42)), new ECBlocks(28, new ECB(17, 22), new ECB(6, 23)), new ECBlocks(30, new ECB(19, 16), new ECB(6, 17))), 
	new Version(22, new Array(6, 26, 50, 74, 98), new ECBlocks(28, new ECB(2, 111), new ECB(7, 112)), new ECBlocks(28, new ECB(17, 46)), new ECBlocks(30, new ECB(7, 24), new ECB(16, 25)), new ECBlocks(24, new ECB(34, 13))), 
	new Version(23, new Array(6, 30, 54, 74, 102), new ECBlocks(30, new ECB(4, 121), new ECB(5, 122)), new ECBlocks(28, new ECB(4, 47), new ECB(14, 48)), new ECBlocks(30, new ECB(11, 24), new ECB(14, 25)), new ECBlocks(30, new ECB(16, 15), new ECB(14, 16))), 
	new Version(24, new Array(6, 28, 54, 80, 106), new ECBlocks(30, new ECB(6, 117), new ECB(4, 118)), new ECBlocks(28, new ECB(6, 45), new ECB(14, 46)), new ECBlocks(30, new ECB(11, 24), new ECB(16, 25)), new ECBlocks(30, new ECB(30, 16), new ECB(2, 17))), 
	new Version(25, new Array(6, 32, 58, 84, 110), new ECBlocks(26, new ECB(8, 106), new ECB(4, 107)), new ECBlocks(28, new ECB(8, 47), new ECB(13, 48)), new ECBlocks(30, new ECB(7, 24), new ECB(22, 25)), new ECBlocks(30, new ECB(22, 15), new ECB(13, 16))), 
	new Version(26, new Array(6, 30, 58, 86, 114), new ECBlocks(28, new ECB(10, 114), new ECB(2, 115)), new ECBlocks(28, new ECB(19, 46), new ECB(4, 47)), new ECBlocks(28, new ECB(28, 22), new ECB(6, 23)), new ECBlocks(30, new ECB(33, 16), new ECB(4, 17))), 
	new Version(27, new Array(6, 34, 62, 90, 118), new ECBlocks(30, new ECB(8, 122), new ECB(4, 123)), new ECBlocks(28, new ECB(22, 45), new ECB(3, 46)), new ECBlocks(30, new ECB(8, 23), new ECB(26, 24)), new ECBlocks(30, new ECB(12, 15), 		new ECB(28, 16))),
	new Version(28, new Array(6, 26, 50, 74, 98, 122), new ECBlocks(30, new ECB(3, 117), new ECB(10, 118)), new ECBlocks(28, new ECB(3, 45), new ECB(23, 46)), new ECBlocks(30, new ECB(4, 24), new ECB(31, 25)), new ECBlocks(30, new ECB(11, 15), new ECB(31, 16))), 
	new Version(29, new Array(6, 30, 54, 78, 102, 126), new ECBlocks(30, new ECB(7, 116), new ECB(7, 117)), new ECBlocks(28, new ECB(21, 45), new ECB(7, 46)), new ECBlocks(30, new ECB(1, 23), new ECB(37, 24)), new ECBlocks(30, new ECB(19, 15), new ECB(26, 16))), 
	new Version(30, new Array(6, 26, 52, 78, 104, 130), new ECBlocks(30, new ECB(5, 115), new ECB(10, 116)), new ECBlocks(28, new ECB(19, 47), new ECB(10, 48)), new ECBlocks(30, new ECB(15, 24), new ECB(25, 25)), new ECBlocks(30, new ECB(23, 15), new ECB(25, 16))), 
	new Version(31, new Array(6, 30, 56, 82, 108, 134), new ECBlocks(30, new ECB(13, 115), new ECB(3, 116)), new ECBlocks(28, new ECB(2, 46), new ECB(29, 47)), new ECBlocks(30, new ECB(42, 24), new ECB(1, 25)), new ECBlocks(30, new ECB(23, 15), new ECB(28, 16))), 
	new Version(32, new Array(6, 34, 60, 86, 112, 138), new ECBlocks(30, new ECB(17, 115)), new ECBlocks(28, new ECB(10, 46), new ECB(23, 47)), new ECBlocks(30, new ECB(10, 24), new ECB(35, 25)), new ECBlocks(30, new ECB(19, 15), new ECB(35, 16))), 
	new Version(33, new Array(6, 30, 58, 86, 114, 142), new ECBlocks(30, new ECB(17, 115), new ECB(1, 116)), new ECBlocks(28, new ECB(14, 46), new ECB(21, 47)), new ECBlocks(30, new ECB(29, 24), new ECB(19, 25)), new ECBlocks(30, new ECB(11, 15), new ECB(46, 16))), 
	new Version(34, new Array(6, 34, 62, 90, 118, 146), new ECBlocks(30, new ECB(13, 115), new ECB(6, 116)), new ECBlocks(28, new ECB(14, 46), new ECB(23, 47)), new ECBlocks(30, new ECB(44, 24), new ECB(7, 25)), new ECBlocks(30, new ECB(59, 16), new ECB(1, 17))), 
	new Version(35, new Array(6, 30, 54, 78, 102, 126, 150), new ECBlocks(30, new ECB(12, 121), new ECB(7, 122)), new ECBlocks(28, new ECB(12, 47), new ECB(26, 48)), new ECBlocks(30, new ECB(39, 24), new ECB(14, 25)),new ECBlocks(30, new ECB(22, 15), new ECB(41, 16))), 
	new Version(36, new Array(6, 24, 50, 76, 102, 128, 154), new ECBlocks(30, new ECB(6, 121), new ECB(14, 122)), new ECBlocks(28, new ECB(6, 47), new ECB(34, 48)), new ECBlocks(30, new ECB(46, 24), new ECB(10, 25)), new ECBlocks(30, new ECB(2, 15), new ECB(64, 16))), 
	new Version(37, new Array(6, 28, 54, 80, 106, 132, 158), new ECBlocks(30, new ECB(17, 122), new ECB(4, 123)), new ECBlocks(28, new ECB(29, 46), new ECB(14, 47)), new ECBlocks(30, new ECB(49, 24), new ECB(10, 25)), new ECBlocks(30, new ECB(24, 15), new ECB(46, 16))), 
	new Version(38, new Array(6, 32, 58, 84, 110, 136, 162), new ECBlocks(30, new ECB(4, 122), new ECB(18, 123)), new ECBlocks(28, new ECB(13, 46), new ECB(32, 47)), new ECBlocks(30, new ECB(48, 24), new ECB(14, 25)), new ECBlocks(30, new ECB(42, 15), new ECB(32, 16))), 
	new Version(39, new Array(6, 26, 54, 82, 110, 138, 166), new ECBlocks(30, new ECB(20, 117), new ECB(4, 118)), new ECBlocks(28, new ECB(40, 47), new ECB(7, 48)), new ECBlocks(30, new ECB(43, 24), new ECB(22, 25)), new ECBlocks(30, new ECB(10, 15), new ECB(67, 16))), 
	new Version(40, new Array(6, 30, 58, 86, 114, 142, 170), new ECBlocks(30, new ECB(19, 118), new ECB(6, 119)), new ECBlocks(28, new ECB(18, 47), new ECB(31, 48)), new ECBlocks(30, new ECB(34, 24), new ECB(34, 25)), new ECBlocks(30, new ECB(20, 15), new ECB(61, 16))));
}
// Source: public/src/js/jsqrcode/detector.js
/*
  Ported to JavaScript by Lazar Laszlo 2011 
  
  lazarsoft@gmail.com, www.lazarsoft.info
  
*/

/*
*
* Copyright 2007 ZXing authors
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*      http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/


function PerspectiveTransform( a11,  a21,  a31,  a12,  a22,  a32,  a13,  a23,  a33)
{
	this.a11 = a11;
	this.a12 = a12;
	this.a13 = a13;
	this.a21 = a21;
	this.a22 = a22;
	this.a23 = a23;
	this.a31 = a31;
	this.a32 = a32;
	this.a33 = a33;
	this.transformPoints1=function( points)
		{
			var max = points.length;
			var a11 = this.a11;
			var a12 = this.a12;
			var a13 = this.a13;
			var a21 = this.a21;
			var a22 = this.a22;
			var a23 = this.a23;
			var a31 = this.a31;
			var a32 = this.a32;
			var a33 = this.a33;
			for (var i = 0; i < max; i += 2)
			{
				var x = points[i];
				var y = points[i + 1];
				var denominator = a13 * x + a23 * y + a33;
				points[i] = (a11 * x + a21 * y + a31) / denominator;
				points[i + 1] = (a12 * x + a22 * y + a32) / denominator;
			}
		}
	this. transformPoints2=function(xValues, yValues)
		{
			var n = xValues.length;
			for (var i = 0; i < n; i++)
			{
				var x = xValues[i];
				var y = yValues[i];
				var denominator = this.a13 * x + this.a23 * y + this.a33;
				xValues[i] = (this.a11 * x + this.a21 * y + this.a31) / denominator;
				yValues[i] = (this.a12 * x + this.a22 * y + this.a32) / denominator;
			}
		}

	this.buildAdjoint=function()
		{
			// Adjoint is the transpose of the cofactor matrix:
			return new PerspectiveTransform(this.a22 * this.a33 - this.a23 * this.a32, this.a23 * this.a31 - this.a21 * this.a33, this.a21 * this.a32 - this.a22 * this.a31, this.a13 * this.a32 - this.a12 * this.a33, this.a11 * this.a33 - this.a13 * this.a31, this.a12 * this.a31 - this.a11 * this.a32, this.a12 * this.a23 - this.a13 * this.a22, this.a13 * this.a21 - this.a11 * this.a23, this.a11 * this.a22 - this.a12 * this.a21);
		}
	this.times=function( other)
		{
			return new PerspectiveTransform(this.a11 * other.a11 + this.a21 * other.a12 + this.a31 * other.a13, this.a11 * other.a21 + this.a21 * other.a22 + this.a31 * other.a23, this.a11 * other.a31 + this.a21 * other.a32 + this.a31 * other.a33, this.a12 * other.a11 + this.a22 * other.a12 + this.a32 * other.a13, this.a12 * other.a21 + this.a22 * other.a22 + this.a32 * other.a23, this.a12 * other.a31 + this.a22 * other.a32 + this.a32 * other.a33, this.a13 * other.a11 + this.a23 * other.a12 +this.a33 * other.a13, this.a13 * other.a21 + this.a23 * other.a22 + this.a33 * other.a23, this.a13 * other.a31 + this.a23 * other.a32 + this.a33 * other.a33);
		}

}

PerspectiveTransform.quadrilateralToQuadrilateral=function( x0,  y0,  x1,  y1,  x2,  y2,  x3,  y3,  x0p,  y0p,  x1p,  y1p,  x2p,  y2p,  x3p,  y3p)
{
	
	var qToS = this.quadrilateralToSquare(x0, y0, x1, y1, x2, y2, x3, y3);
	var sToQ = this.squareToQuadrilateral(x0p, y0p, x1p, y1p, x2p, y2p, x3p, y3p);
	return sToQ.times(qToS);
}

PerspectiveTransform.squareToQuadrilateral=function( x0,  y0,  x1,  y1,  x2,  y2,  x3,  y3)
{
	 dy2 = y3 - y2;
	 dy3 = y0 - y1 + y2 - y3;
	if (dy2 == 0.0 && dy3 == 0.0)
	{
		return new PerspectiveTransform(x1 - x0, x2 - x1, x0, y1 - y0, y2 - y1, y0, 0.0, 0.0, 1.0);
	}
	else
	{
		 dx1 = x1 - x2;
		 dx2 = x3 - x2;
		 dx3 = x0 - x1 + x2 - x3;
		 dy1 = y1 - y2;
		 denominator = dx1 * dy2 - dx2 * dy1;
		 a13 = (dx3 * dy2 - dx2 * dy3) / denominator;
		 a23 = (dx1 * dy3 - dx3 * dy1) / denominator;
		return new PerspectiveTransform(x1 - x0 + a13 * x1, x3 - x0 + a23 * x3, x0, y1 - y0 + a13 * y1, y3 - y0 + a23 * y3, y0, a13, a23, 1.0);
	}
}

PerspectiveTransform.quadrilateralToSquare=function( x0,  y0,  x1,  y1,  x2,  y2,  x3,  y3)
{
	// Here, the adjoint serves as the inverse:
	return this.squareToQuadrilateral(x0, y0, x1, y1, x2, y2, x3, y3).buildAdjoint();
}

function DetectorResult(bits,  points)
{
	this.bits = bits;
	this.points = points;
}


function Detector(image)
{
	this.image=image;
	this.resultPointCallback = null;
	
	this.sizeOfBlackWhiteBlackRun=function( fromX,  fromY,  toX,  toY)
		{
			// Mild variant of Bresenham's algorithm;
			// see http://en.wikipedia.org/wiki/Bresenham's_line_algorithm
			var steep = Math.abs(toY - fromY) > Math.abs(toX - fromX);
			if (steep)
			{
				var temp = fromX;
				fromX = fromY;
				fromY = temp;
				temp = toX;
				toX = toY;
				toY = temp;
			}
			
			var dx = Math.abs(toX - fromX);
			var dy = Math.abs(toY - fromY);
			var error = - dx >> 1;
			var ystep = fromY < toY?1:- 1;
			var xstep = fromX < toX?1:- 1;
			var state = 0; // In black pixels, looking for white, first or second time
			for (var x = fromX, y = fromY; x != toX; x += xstep)
			{
				
				var realX = steep?y:x;
				var realY = steep?x:y;
				if (state == 1)
				{
					// In white pixels, looking for black
					if (this.image[realX + realY*qrcode.width])
					{
						state++;
					}
				}
				else
				{
					if (!this.image[realX + realY*qrcode.width])
					{
						state++;
					}
				}
				
				if (state == 3)
				{
					// Found black, white, black, and stumbled back onto white; done
					var diffX = x - fromX;
					var diffY = y - fromY;
					return  Math.sqrt( (diffX * diffX + diffY * diffY));
				}
				error += dy;
				if (error > 0)
				{
					if (y == toY)
					{
						break;
					}
					y += ystep;
					error -= dx;
				}
			}
			var diffX2 = toX - fromX;
			var diffY2 = toY - fromY;
			return  Math.sqrt( (diffX2 * diffX2 + diffY2 * diffY2));
		}

	
	this.sizeOfBlackWhiteBlackRunBothWays=function( fromX,  fromY,  toX,  toY)
		{
			
			var result = this.sizeOfBlackWhiteBlackRun(fromX, fromY, toX, toY);
			
			// Now count other way -- don't run off image though of course
			var scale = 1.0;
			var otherToX = fromX - (toX - fromX);
			if (otherToX < 0)
			{
				scale =  fromX /  (fromX - otherToX);
				otherToX = 0;
			}
			else if (otherToX >= qrcode.width)
			{
				scale =  (qrcode.width - 1 - fromX) /  (otherToX - fromX);
				otherToX = qrcode.width - 1;
			}
			var otherToY = Math.floor (fromY - (toY - fromY) * scale);
			
			scale = 1.0;
			if (otherToY < 0)
			{
				scale =  fromY /  (fromY - otherToY);
				otherToY = 0;
			}
			else if (otherToY >= qrcode.height)
			{
				scale =  (qrcode.height - 1 - fromY) /  (otherToY - fromY);
				otherToY = qrcode.height - 1;
			}
			otherToX = Math.floor (fromX + (otherToX - fromX) * scale);
			
			result += this.sizeOfBlackWhiteBlackRun(fromX, fromY, otherToX, otherToY);
			return result - 1.0; // -1 because we counted the middle pixel twice
		}
		

	
	this.calculateModuleSizeOneWay=function( pattern,  otherPattern)
		{
			var moduleSizeEst1 = this.sizeOfBlackWhiteBlackRunBothWays(Math.floor( pattern.X), Math.floor( pattern.Y), Math.floor( otherPattern.X), Math.floor(otherPattern.Y));
			var moduleSizeEst2 = this.sizeOfBlackWhiteBlackRunBothWays(Math.floor(otherPattern.X), Math.floor(otherPattern.Y), Math.floor( pattern.X), Math.floor(pattern.Y));
			if (isNaN(moduleSizeEst1))
			{
				return moduleSizeEst2 / 7.0;
			}
			if (isNaN(moduleSizeEst2))
			{
				return moduleSizeEst1 / 7.0;
			}
			// Average them, and divide by 7 since we've counted the width of 3 black modules,
			// and 1 white and 1 black module on either side. Ergo, divide sum by 14.
			return (moduleSizeEst1 + moduleSizeEst2) / 14.0;
		}

	
	this.calculateModuleSize=function( topLeft,  topRight,  bottomLeft)
		{
			// Take the average
			return (this.calculateModuleSizeOneWay(topLeft, topRight) + this.calculateModuleSizeOneWay(topLeft, bottomLeft)) / 2.0;
		}

	this.distance=function( pattern1,  pattern2)
	{
		xDiff = pattern1.X - pattern2.X;
		yDiff = pattern1.Y - pattern2.Y;
		return  Math.sqrt( (xDiff * xDiff + yDiff * yDiff));
	}
	this.computeDimension=function( topLeft,  topRight,  bottomLeft,  moduleSize)
		{
			
			var tltrCentersDimension = Math.round(this.distance(topLeft, topRight) / moduleSize);
			var tlblCentersDimension = Math.round(this.distance(topLeft, bottomLeft) / moduleSize);
			var dimension = ((tltrCentersDimension + tlblCentersDimension) >> 1) + 7;
			switch (dimension & 0x03)
			{
				
				// mod 4
				case 0: 
					dimension++;
					break;
					// 1? do nothing
				
				case 2: 
					dimension--;
					break;
				
				case 3: 
					throw "Error";
				}
			return dimension;
		}

	this.findAlignmentInRegion=function( overallEstModuleSize,  estAlignmentX,  estAlignmentY,  allowanceFactor)
		{
			// Look for an alignment pattern (3 modules in size) around where it
			// should be
			var allowance = Math.floor (allowanceFactor * overallEstModuleSize);
			var alignmentAreaLeftX = Math.max(0, estAlignmentX - allowance);
			var alignmentAreaRightX = Math.min(qrcode.width - 1, estAlignmentX + allowance);
			if (alignmentAreaRightX - alignmentAreaLeftX < overallEstModuleSize * 3)
			{
				throw "Error";
			}
			
			var alignmentAreaTopY = Math.max(0, estAlignmentY - allowance);
			var alignmentAreaBottomY = Math.min(qrcode.height - 1, estAlignmentY + allowance);
			
			var alignmentFinder = new AlignmentPatternFinder(this.image, alignmentAreaLeftX, alignmentAreaTopY, alignmentAreaRightX - alignmentAreaLeftX, alignmentAreaBottomY - alignmentAreaTopY, overallEstModuleSize, this.resultPointCallback);
			return alignmentFinder.find();
		}
		
	this.createTransform=function( topLeft,  topRight,  bottomLeft, alignmentPattern, dimension)
		{
			var dimMinusThree =  dimension - 3.5;
			var bottomRightX;
			var bottomRightY;
			var sourceBottomRightX;
			var sourceBottomRightY;
			if (alignmentPattern != null)
			{
				bottomRightX = alignmentPattern.X;
				bottomRightY = alignmentPattern.Y;
				sourceBottomRightX = sourceBottomRightY = dimMinusThree - 3.0;
			}
			else
			{
				// Don't have an alignment pattern, just make up the bottom-right point
				bottomRightX = (topRight.X - topLeft.X) + bottomLeft.X;
				bottomRightY = (topRight.Y - topLeft.Y) + bottomLeft.Y;
				sourceBottomRightX = sourceBottomRightY = dimMinusThree;
			}
			
			var transform = PerspectiveTransform.quadrilateralToQuadrilateral(3.5, 3.5, dimMinusThree, 3.5, sourceBottomRightX, sourceBottomRightY, 3.5, dimMinusThree, topLeft.X, topLeft.Y, topRight.X, topRight.Y, bottomRightX, bottomRightY, bottomLeft.X, bottomLeft.Y);
			
			return transform;
		}		
	
	this.sampleGrid=function( image,  transform,  dimension)
		{
			
			var sampler = GridSampler;
			return sampler.sampleGrid3(image, dimension, transform);
		}
	
	this.processFinderPatternInfo = function( info)
		{
			
			var topLeft = info.TopLeft;
			var topRight = info.TopRight;
			var bottomLeft = info.BottomLeft;
			
			var moduleSize = this.calculateModuleSize(topLeft, topRight, bottomLeft);
			if (moduleSize < 1.0)
			{
				throw "Error";
			}
			var dimension = this.computeDimension(topLeft, topRight, bottomLeft, moduleSize);
			var provisionalVersion = Version.getProvisionalVersionForDimension(dimension);
			var modulesBetweenFPCenters = provisionalVersion.DimensionForVersion - 7;
			
			var alignmentPattern = null;
			// Anything above version 1 has an alignment pattern
			if (provisionalVersion.AlignmentPatternCenters.length > 0)
			{
				
				// Guess where a "bottom right" finder pattern would have been
				var bottomRightX = topRight.X - topLeft.X + bottomLeft.X;
				var bottomRightY = topRight.Y - topLeft.Y + bottomLeft.Y;
				
				// Estimate that alignment pattern is closer by 3 modules
				// from "bottom right" to known top left location
				var correctionToTopLeft = 1.0 - 3.0 /  modulesBetweenFPCenters;
				var estAlignmentX = Math.floor (topLeft.X + correctionToTopLeft * (bottomRightX - topLeft.X));
				var estAlignmentY = Math.floor (topLeft.Y + correctionToTopLeft * (bottomRightY - topLeft.Y));
				
				// Kind of arbitrary -- expand search radius before giving up
				for (var i = 4; i <= 16; i <<= 1)
				{
					//try
					//{
						alignmentPattern = this.findAlignmentInRegion(moduleSize, estAlignmentX, estAlignmentY,  i);
						break;
					//}
					//catch (re)
					//{
						// try next round
					//}
				}
				// If we didn't find alignment pattern... well try anyway without it
			}
			
			var transform = this.createTransform(topLeft, topRight, bottomLeft, alignmentPattern, dimension);
			
			var bits = this.sampleGrid(this.image, transform, dimension);
			
			var points;
			if (alignmentPattern == null)
			{
				points = new Array(bottomLeft, topLeft, topRight);
			}
			else
			{
				points = new Array(bottomLeft, topLeft, topRight, alignmentPattern);
			}
			return new DetectorResult(bits, points);
		}
		

	
	this.detect=function()
	{
		var info =  new FinderPatternFinder().findFinderPattern(this.image);
			
		return this.processFinderPatternInfo(info); 
	}
}
// Source: public/src/js/jsqrcode/formatinf.js
/*
  Ported to JavaScript by Lazar Laszlo 2011 
  
  lazarsoft@gmail.com, www.lazarsoft.info
  
*/

/*
*
* Copyright 2007 ZXing authors
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*      http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/


var FORMAT_INFO_MASK_QR = 0x5412;
var FORMAT_INFO_DECODE_LOOKUP = new Array(new Array(0x5412, 0x00), new Array(0x5125, 0x01), new Array(0x5E7C, 0x02), new Array(0x5B4B, 0x03), new Array(0x45F9, 0x04), new Array(0x40CE, 0x05), new Array(0x4F97, 0x06), new Array(0x4AA0, 0x07), new Array(0x77C4, 0x08), new Array(0x72F3, 0x09), new Array(0x7DAA, 0x0A), new Array(0x789D, 0x0B), new Array(0x662F, 0x0C), new Array(0x6318, 0x0D), new Array(0x6C41, 0x0E), new Array(0x6976, 0x0F), new Array(0x1689, 0x10), new Array(0x13BE, 0x11), new Array(0x1CE7, 0x12), new Array(0x19D0, 0x13), new Array(0x0762, 0x14), new Array(0x0255, 0x15), new Array(0x0D0C, 0x16), new Array(0x083B, 0x17), new Array(0x355F, 0x18), new Array(0x3068, 0x19), new Array(0x3F31, 0x1A), new Array(0x3A06, 0x1B), new Array(0x24B4, 0x1C), new Array(0x2183, 0x1D), new Array(0x2EDA, 0x1E), new Array(0x2BED, 0x1F));
var BITS_SET_IN_HALF_BYTE = new Array(0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4);


function FormatInformation(formatInfo)
{
	this.errorCorrectionLevel = ErrorCorrectionLevel.forBits((formatInfo >> 3) & 0x03);
	this.dataMask =  (formatInfo & 0x07);

	this.__defineGetter__("ErrorCorrectionLevel", function()
	{
		return this.errorCorrectionLevel;
	});
	this.__defineGetter__("DataMask", function()
	{
		return this.dataMask;
	});
	this.GetHashCode=function()
	{
		return (this.errorCorrectionLevel.ordinal() << 3) |  dataMask;
	}
	this.Equals=function( o)
	{
		var other =  o;
		return this.errorCorrectionLevel == other.errorCorrectionLevel && this.dataMask == other.dataMask;
	}
}

FormatInformation.numBitsDiffering=function( a,  b)
{
	a ^= b; // a now has a 1 bit exactly where its bit differs with b's
	// Count bits set quickly with a series of lookups:
	return BITS_SET_IN_HALF_BYTE[a & 0x0F] + BITS_SET_IN_HALF_BYTE[(URShift(a, 4) & 0x0F)] + BITS_SET_IN_HALF_BYTE[(URShift(a, 8) & 0x0F)] + BITS_SET_IN_HALF_BYTE[(URShift(a, 12) & 0x0F)] + BITS_SET_IN_HALF_BYTE[(URShift(a, 16) & 0x0F)] + BITS_SET_IN_HALF_BYTE[(URShift(a, 20) & 0x0F)] + BITS_SET_IN_HALF_BYTE[(URShift(a, 24) & 0x0F)] + BITS_SET_IN_HALF_BYTE[(URShift(a, 28) & 0x0F)];
}

FormatInformation.decodeFormatInformation=function( maskedFormatInfo)
{
	var formatInfo = FormatInformation.doDecodeFormatInformation(maskedFormatInfo);
	if (formatInfo != null)
	{
		return formatInfo;
	}
	// Should return null, but, some QR codes apparently
	// do not mask this info. Try again by actually masking the pattern
	// first
	return FormatInformation.doDecodeFormatInformation(maskedFormatInfo ^ FORMAT_INFO_MASK_QR);
}
FormatInformation.doDecodeFormatInformation=function( maskedFormatInfo)
{
	// Find the int in FORMAT_INFO_DECODE_LOOKUP with fewest bits differing
	var bestDifference = 0xffffffff;
	var bestFormatInfo = 0;
	for (var i = 0; i < FORMAT_INFO_DECODE_LOOKUP.length; i++)
	{
		var decodeInfo = FORMAT_INFO_DECODE_LOOKUP[i];
		var targetInfo = decodeInfo[0];
		if (targetInfo == maskedFormatInfo)
		{
			// Found an exact match
			return new FormatInformation(decodeInfo[1]);
		}
		var bitsDifference = this.numBitsDiffering(maskedFormatInfo, targetInfo);
		if (bitsDifference < bestDifference)
		{
			bestFormatInfo = decodeInfo[1];
			bestDifference = bitsDifference;
		}
	}
	// Hamming distance of the 32 masked codes is 7, by construction, so <= 3 bits
	// differing means we found a match
	if (bestDifference <= 3)
	{
		return new FormatInformation(bestFormatInfo);
	}
	return null;
}

		
// Source: public/src/js/jsqrcode/errorlevel.js
/*
  Ported to JavaScript by Lazar Laszlo 2011 
  
  lazarsoft@gmail.com, www.lazarsoft.info
  
*/

/*
*
* Copyright 2007 ZXing authors
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*      http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/


function ErrorCorrectionLevel(ordinal,  bits, name)
{
	this.ordinal_Renamed_Field = ordinal;
	this.bits = bits;
	this.name = name;
	this.__defineGetter__("Bits", function()
	{
		return this.bits;
	});
	this.__defineGetter__("Name", function()
	{
		return this.name;
	});
	this.ordinal=function()
	{
		return this.ordinal_Renamed_Field;
	}
}

ErrorCorrectionLevel.forBits=function( bits)
{
	if (bits < 0 || bits >= FOR_BITS.length)
	{
		throw "ArgumentException";
	}
	return FOR_BITS[bits];
}

var L = new ErrorCorrectionLevel(0, 0x01, "L");
var M = new ErrorCorrectionLevel(1, 0x00, "M");
var Q = new ErrorCorrectionLevel(2, 0x03, "Q");
var H = new ErrorCorrectionLevel(3, 0x02, "H");
var FOR_BITS = new Array( M, L, H, Q);

// Source: public/src/js/jsqrcode/bitmat.js
/*
  Ported to JavaScript by Lazar Laszlo 2011 
  
  lazarsoft@gmail.com, www.lazarsoft.info
  
*/

/*
*
* Copyright 2007 ZXing authors
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*      http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/


function BitMatrix( width,  height)
{
	if(!height)
		height=width;
	if (width < 1 || height < 1)
	{
		throw "Both dimensions must be greater than 0";
	}
	this.width = width;
	this.height = height;
	var rowSize = width >> 5;
	if ((width & 0x1f) != 0)
	{
		rowSize++;
	}
	this.rowSize = rowSize;
	this.bits = new Array(rowSize * height);
	for(var i=0;i<this.bits.length;i++)
		this.bits[i]=0;
	
	this.__defineGetter__("Width", function()
	{
		return this.width;
	});
	this.__defineGetter__("Height", function()
	{
		return this.height;
	});
	this.__defineGetter__("Dimension", function()
	{
		if (this.width != this.height)
		{
			throw "Can't call getDimension() on a non-square matrix";
		}
		return this.width;
	});
	
	this.get_Renamed=function( x,  y)
		{
			var offset = y * this.rowSize + (x >> 5);
			return ((URShift(this.bits[offset], (x & 0x1f))) & 1) != 0;
		}
	this.set_Renamed=function( x,  y)
		{
			var offset = y * this.rowSize + (x >> 5);
			this.bits[offset] |= 1 << (x & 0x1f);
		}
	this.flip=function( x,  y)
		{
			var offset = y * this.rowSize + (x >> 5);
			this.bits[offset] ^= 1 << (x & 0x1f);
		}
	this.clear=function()
		{
			var max = this.bits.length;
			for (var i = 0; i < max; i++)
			{
				this.bits[i] = 0;
			}
		}
	this.setRegion=function( left,  top,  width,  height)
		{
			if (top < 0 || left < 0)
			{
				throw "Left and top must be nonnegative";
			}
			if (height < 1 || width < 1)
			{
				throw "Height and width must be at least 1";
			}
			var right = left + width;
			var bottom = top + height;
			if (bottom > this.height || right > this.width)
			{
				throw "The region must fit inside the matrix";
			}
			for (var y = top; y < bottom; y++)
			{
				var offset = y * this.rowSize;
				for (var x = left; x < right; x++)
				{
					this.bits[offset + (x >> 5)] |= 1 << (x & 0x1f);
				}
			}
		}
}
// Source: public/src/js/jsqrcode/datablock.js
/*
  Ported to JavaScript by Lazar Laszlo 2011 
  
  lazarsoft@gmail.com, www.lazarsoft.info
  
*/

/*
*
* Copyright 2007 ZXing authors
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*      http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/


function DataBlock(numDataCodewords,  codewords)
{
	this.numDataCodewords = numDataCodewords;
	this.codewords = codewords;
	
	this.__defineGetter__("NumDataCodewords", function()
	{
		return this.numDataCodewords;
	});
	this.__defineGetter__("Codewords", function()
	{
		return this.codewords;
	});
}	
	
DataBlock.getDataBlocks=function(rawCodewords,  version,  ecLevel)
{
	
	if (rawCodewords.length != version.TotalCodewords)
	{
		throw "ArgumentException";
	}
	
	// Figure out the number and size of data blocks used by this version and
	// error correction level
	var ecBlocks = version.getECBlocksForLevel(ecLevel);
	
	// First count the total number of data blocks
	var totalBlocks = 0;
	var ecBlockArray = ecBlocks.getECBlocks();
	for (var i = 0; i < ecBlockArray.length; i++)
	{
		totalBlocks += ecBlockArray[i].Count;
	}
	
	// Now establish DataBlocks of the appropriate size and number of data codewords
	var result = new Array(totalBlocks);
	var numResultBlocks = 0;
	for (var j = 0; j < ecBlockArray.length; j++)
	{
		var ecBlock = ecBlockArray[j];
		for (var i = 0; i < ecBlock.Count; i++)
		{
			var numDataCodewords = ecBlock.DataCodewords;
			var numBlockCodewords = ecBlocks.ECCodewordsPerBlock + numDataCodewords;
			result[numResultBlocks++] = new DataBlock(numDataCodewords, new Array(numBlockCodewords));
		}
	}
	
	// All blocks have the same amount of data, except that the last n
	// (where n may be 0) have 1 more byte. Figure out where these start.
	var shorterBlocksTotalCodewords = result[0].codewords.length;
	var longerBlocksStartAt = result.length - 1;
	while (longerBlocksStartAt >= 0)
	{
		var numCodewords = result[longerBlocksStartAt].codewords.length;
		if (numCodewords == shorterBlocksTotalCodewords)
		{
			break;
		}
		longerBlocksStartAt--;
	}
	longerBlocksStartAt++;
	
	var shorterBlocksNumDataCodewords = shorterBlocksTotalCodewords - ecBlocks.ECCodewordsPerBlock;
	// The last elements of result may be 1 element longer;
	// first fill out as many elements as all of them have
	var rawCodewordsOffset = 0;
	for (var i = 0; i < shorterBlocksNumDataCodewords; i++)
	{
		for (var j = 0; j < numResultBlocks; j++)
		{
			result[j].codewords[i] = rawCodewords[rawCodewordsOffset++];
		}
	}
	// Fill out the last data block in the longer ones
	for (var j = longerBlocksStartAt; j < numResultBlocks; j++)
	{
		result[j].codewords[shorterBlocksNumDataCodewords] = rawCodewords[rawCodewordsOffset++];
	}
	// Now add in error correction blocks
	var max = result[0].codewords.length;
	for (var i = shorterBlocksNumDataCodewords; i < max; i++)
	{
		for (var j = 0; j < numResultBlocks; j++)
		{
			var iOffset = j < longerBlocksStartAt?i:i + 1;
			result[j].codewords[iOffset] = rawCodewords[rawCodewordsOffset++];
		}
	}
	return result;
}

// Source: public/src/js/jsqrcode/bmparser.js
/*
  Ported to JavaScript by Lazar Laszlo 2011 
  
  lazarsoft@gmail.com, www.lazarsoft.info
  
*/

/*
*
* Copyright 2007 ZXing authors
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*      http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/


function BitMatrixParser(bitMatrix)
{
	var dimension = bitMatrix.Dimension;
	if (dimension < 21 || (dimension & 0x03) != 1)
	{
		throw "Error BitMatrixParser";
	}
	this.bitMatrix = bitMatrix;
	this.parsedVersion = null;
	this.parsedFormatInfo = null;
	
	this.copyBit=function( i,  j,  versionBits)
	{
		return this.bitMatrix.get_Renamed(i, j)?(versionBits << 1) | 0x1:versionBits << 1;
	}
	
	this.readFormatInformation=function()
	{
			if (this.parsedFormatInfo != null)
			{
				return this.parsedFormatInfo;
			}
			
			// Read top-left format info bits
			var formatInfoBits = 0;
			for (var i = 0; i < 6; i++)
			{
				formatInfoBits = this.copyBit(i, 8, formatInfoBits);
			}
			// .. and skip a bit in the timing pattern ...
			formatInfoBits = this.copyBit(7, 8, formatInfoBits);
			formatInfoBits = this.copyBit(8, 8, formatInfoBits);
			formatInfoBits = this.copyBit(8, 7, formatInfoBits);
			// .. and skip a bit in the timing pattern ...
			for (var j = 5; j >= 0; j--)
			{
				formatInfoBits = this.copyBit(8, j, formatInfoBits);
			}
			
			this.parsedFormatInfo = FormatInformation.decodeFormatInformation(formatInfoBits);
			if (this.parsedFormatInfo != null)
			{
				return this.parsedFormatInfo;
			}
			
			// Hmm, failed. Try the top-right/bottom-left pattern
			var dimension = this.bitMatrix.Dimension;
			formatInfoBits = 0;
			var iMin = dimension - 8;
			for (var i = dimension - 1; i >= iMin; i--)
			{
				formatInfoBits = this.copyBit(i, 8, formatInfoBits);
			}
			for (var j = dimension - 7; j < dimension; j++)
			{
				formatInfoBits = this.copyBit(8, j, formatInfoBits);
			}
			
			this.parsedFormatInfo = FormatInformation.decodeFormatInformation(formatInfoBits);
			if (this.parsedFormatInfo != null)
			{
				return this.parsedFormatInfo;
			}
			throw "Error readFormatInformation";	
	}
	this.readVersion=function()
		{
			
			if (this.parsedVersion != null)
			{
				return this.parsedVersion;
			}
			
			var dimension = this.bitMatrix.Dimension;
			
			var provisionalVersion = (dimension - 17) >> 2;
			if (provisionalVersion <= 6)
			{
				return Version.getVersionForNumber(provisionalVersion);
			}
			
			// Read top-right version info: 3 wide by 6 tall
			var versionBits = 0;
			var ijMin = dimension - 11;
			for (var j = 5; j >= 0; j--)
			{
				for (var i = dimension - 9; i >= ijMin; i--)
				{
					versionBits = this.copyBit(i, j, versionBits);
				}
			}
			
			this.parsedVersion = Version.decodeVersionInformation(versionBits);
			if (this.parsedVersion != null && this.parsedVersion.DimensionForVersion == dimension)
			{
				return this.parsedVersion;
			}
			
			// Hmm, failed. Try bottom left: 6 wide by 3 tall
			versionBits = 0;
			for (var i = 5; i >= 0; i--)
			{
				for (var j = dimension - 9; j >= ijMin; j--)
				{
					versionBits = this.copyBit(i, j, versionBits);
				}
			}
			
			this.parsedVersion = Version.decodeVersionInformation(versionBits);
			if (this.parsedVersion != null && this.parsedVersion.DimensionForVersion == dimension)
			{
				return this.parsedVersion;
			}
			throw "Error readVersion";
		}
	this.readCodewords=function()
		{
			
			var formatInfo = this.readFormatInformation();
			var version = this.readVersion();
			
			// Get the data mask for the format used in this QR Code. This will exclude
			// some bits from reading as we wind through the bit matrix.
			var dataMask = DataMask.forReference( formatInfo.DataMask);
			var dimension = this.bitMatrix.Dimension;
			dataMask.unmaskBitMatrix(this.bitMatrix, dimension);
			
			var functionPattern = version.buildFunctionPattern();
			
			var readingUp = true;
			var result = new Array(version.TotalCodewords);
			var resultOffset = 0;
			var currentByte = 0;
			var bitsRead = 0;
			// Read columns in pairs, from right to left
			for (var j = dimension - 1; j > 0; j -= 2)
			{
				if (j == 6)
				{
					// Skip whole column with vertical alignment pattern;
					// saves time and makes the other code proceed more cleanly
					j--;
				}
				// Read alternatingly from bottom to top then top to bottom
				for (var count = 0; count < dimension; count++)
				{
					var i = readingUp?dimension - 1 - count:count;
					for (var col = 0; col < 2; col++)
					{
						// Ignore bits covered by the function pattern
						if (!functionPattern.get_Renamed(j - col, i))
						{
							// Read a bit
							bitsRead++;
							currentByte <<= 1;
							if (this.bitMatrix.get_Renamed(j - col, i))
							{
								currentByte |= 1;
							}
							// If we've made a whole byte, save it off
							if (bitsRead == 8)
							{
								result[resultOffset++] =  currentByte;
								bitsRead = 0;
								currentByte = 0;
							}
						}
					}
				}
				readingUp ^= true; // readingUp = !readingUp; // switch directions
			}
			if (resultOffset != version.TotalCodewords)
			{
				throw "Error readCodewords";
			}
			return result;
		}
}
// Source: public/src/js/jsqrcode/datamask.js
/*
  Ported to JavaScript by Lazar Laszlo 2011 
  
  lazarsoft@gmail.com, www.lazarsoft.info
  
*/

/*
*
* Copyright 2007 ZXing authors
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*      http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/


DataMask = {};

DataMask.forReference = function(reference)
{
	if (reference < 0 || reference > 7)
	{
		throw "System.ArgumentException";
	}
	return DataMask.DATA_MASKS[reference];
}

function DataMask000()
{
	this.unmaskBitMatrix=function(bits,  dimension)
	{
		for (var i = 0; i < dimension; i++)
		{
			for (var j = 0; j < dimension; j++)
			{
				if (this.isMasked(i, j))
				{
					bits.flip(j, i);
				}
			}
		}
	}
	this.isMasked=function( i,  j)
	{
		return ((i + j) & 0x01) == 0;
	}
}

function DataMask001()
{
	this.unmaskBitMatrix=function(bits,  dimension)
	{
		for (var i = 0; i < dimension; i++)
		{
			for (var j = 0; j < dimension; j++)
			{
				if (this.isMasked(i, j))
				{
					bits.flip(j, i);
				}
			}
		}
	}
	this.isMasked=function( i,  j)
	{
		return (i & 0x01) == 0;
	}
}

function DataMask010()
{
	this.unmaskBitMatrix=function(bits,  dimension)
	{
		for (var i = 0; i < dimension; i++)
		{
			for (var j = 0; j < dimension; j++)
			{
				if (this.isMasked(i, j))
				{
					bits.flip(j, i);
				}
			}
		}
	}
	this.isMasked=function( i,  j)
	{
		return j % 3 == 0;
	}
}

function DataMask011()
{
	this.unmaskBitMatrix=function(bits,  dimension)
	{
		for (var i = 0; i < dimension; i++)
		{
			for (var j = 0; j < dimension; j++)
			{
				if (this.isMasked(i, j))
				{
					bits.flip(j, i);
				}
			}
		}
	}
	this.isMasked=function( i,  j)
	{
		return (i + j) % 3 == 0;
	}
}

function DataMask100()
{
	this.unmaskBitMatrix=function(bits,  dimension)
	{
		for (var i = 0; i < dimension; i++)
		{
			for (var j = 0; j < dimension; j++)
			{
				if (this.isMasked(i, j))
				{
					bits.flip(j, i);
				}
			}
		}
	}
	this.isMasked=function( i,  j)
	{
		return (((URShift(i, 1)) + (j / 3)) & 0x01) == 0;
	}
}

function DataMask101()
{
	this.unmaskBitMatrix=function(bits,  dimension)
	{
		for (var i = 0; i < dimension; i++)
		{
			for (var j = 0; j < dimension; j++)
			{
				if (this.isMasked(i, j))
				{
					bits.flip(j, i);
				}
			}
		}
	}
	this.isMasked=function( i,  j)
	{
		var temp = i * j;
		return (temp & 0x01) + (temp % 3) == 0;
	}
}

function DataMask110()
{
	this.unmaskBitMatrix=function(bits,  dimension)
	{
		for (var i = 0; i < dimension; i++)
		{
			for (var j = 0; j < dimension; j++)
			{
				if (this.isMasked(i, j))
				{
					bits.flip(j, i);
				}
			}
		}
	}
	this.isMasked=function( i,  j)
	{
		var temp = i * j;
		return (((temp & 0x01) + (temp % 3)) & 0x01) == 0;
	}
}
function DataMask111()
{
	this.unmaskBitMatrix=function(bits,  dimension)
	{
		for (var i = 0; i < dimension; i++)
		{
			for (var j = 0; j < dimension; j++)
			{
				if (this.isMasked(i, j))
				{
					bits.flip(j, i);
				}
			}
		}
	}
	this.isMasked=function( i,  j)
	{
		return ((((i + j) & 0x01) + ((i * j) % 3)) & 0x01) == 0;
	}
}

DataMask.DATA_MASKS = new Array(new DataMask000(), new DataMask001(), new DataMask010(), new DataMask011(), new DataMask100(), new DataMask101(), new DataMask110(), new DataMask111());


// Source: public/src/js/jsqrcode/rsdecoder.js
/*
  Ported to JavaScript by Lazar Laszlo 2011 
  
  lazarsoft@gmail.com, www.lazarsoft.info
  
*/

/*
*
* Copyright 2007 ZXing authors
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*      http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/


function ReedSolomonDecoder(field)
{
	this.field = field;
	this.decode=function(received,  twoS)
	{
			var poly = new GF256Poly(this.field, received);
			var syndromeCoefficients = new Array(twoS);
			for(var i=0;i<syndromeCoefficients.length;i++)syndromeCoefficients[i]=0;
			var dataMatrix = false;//this.field.Equals(GF256.DATA_MATRIX_FIELD);
			var noError = true;
			for (var i = 0; i < twoS; i++)
			{
				// Thanks to sanfordsquires for this fix:
				var eval = poly.evaluateAt(this.field.exp(dataMatrix?i + 1:i));
				syndromeCoefficients[syndromeCoefficients.length - 1 - i] = eval;
				if (eval != 0)
				{
					noError = false;
				}
			}
			if (noError)
			{
				return ;
			}
			var syndrome = new GF256Poly(this.field, syndromeCoefficients);
			var sigmaOmega = this.runEuclideanAlgorithm(this.field.buildMonomial(twoS, 1), syndrome, twoS);
			var sigma = sigmaOmega[0];
			var omega = sigmaOmega[1];
			var errorLocations = this.findErrorLocations(sigma);
			var errorMagnitudes = this.findErrorMagnitudes(omega, errorLocations, dataMatrix);
			for (var i = 0; i < errorLocations.length; i++)
			{
				var position = received.length - 1 - this.field.log(errorLocations[i]);
				if (position < 0)
				{
					throw "ReedSolomonException Bad error location";
				}
				received[position] = GF256.addOrSubtract(received[position], errorMagnitudes[i]);
			}
	}
	
	this.runEuclideanAlgorithm=function( a,  b,  R)
		{
			// Assume a's degree is >= b's
			if (a.Degree < b.Degree)
			{
				var temp = a;
				a = b;
				b = temp;
			}
			
			var rLast = a;
			var r = b;
			var sLast = this.field.One;
			var s = this.field.Zero;
			var tLast = this.field.Zero;
			var t = this.field.One;
			
			// Run Euclidean algorithm until r's degree is less than R/2
			while (r.Degree >= Math.floor(R / 2))
			{
				var rLastLast = rLast;
				var sLastLast = sLast;
				var tLastLast = tLast;
				rLast = r;
				sLast = s;
				tLast = t;
				
				// Divide rLastLast by rLast, with quotient in q and remainder in r
				if (rLast.Zero)
				{
					// Oops, Euclidean algorithm already terminated?
					throw "r_{i-1} was zero";
				}
				r = rLastLast;
				var q = this.field.Zero;
				var denominatorLeadingTerm = rLast.getCoefficient(rLast.Degree);
				var dltInverse = this.field.inverse(denominatorLeadingTerm);
				while (r.Degree >= rLast.Degree && !r.Zero)
				{
					var degreeDiff = r.Degree - rLast.Degree;
					var scale = this.field.multiply(r.getCoefficient(r.Degree), dltInverse);
					q = q.addOrSubtract(this.field.buildMonomial(degreeDiff, scale));
					r = r.addOrSubtract(rLast.multiplyByMonomial(degreeDiff, scale));
					//r.EXE();
				}
				
				s = q.multiply1(sLast).addOrSubtract(sLastLast);
				t = q.multiply1(tLast).addOrSubtract(tLastLast);
			}
			
			var sigmaTildeAtZero = t.getCoefficient(0);
			if (sigmaTildeAtZero == 0)
			{
				throw "ReedSolomonException sigmaTilde(0) was zero";
			}
			
			var inverse = this.field.inverse(sigmaTildeAtZero);
			var sigma = t.multiply2(inverse);
			var omega = r.multiply2(inverse);
			return new Array(sigma, omega);
		}
	this.findErrorLocations=function( errorLocator)
		{
			// This is a direct application of Chien's search
			var numErrors = errorLocator.Degree;
			if (numErrors == 1)
			{
				// shortcut
				return new Array(errorLocator.getCoefficient(1));
			}
			var result = new Array(numErrors);
			var e = 0;
			for (var i = 1; i < 256 && e < numErrors; i++)
			{
				if (errorLocator.evaluateAt(i) == 0)
				{
					result[e] = this.field.inverse(i);
					e++;
				}
			}
			if (e != numErrors)
			{
				throw "Error locator degree does not match number of roots";
			}
			return result;
		}
	this.findErrorMagnitudes=function( errorEvaluator,  errorLocations,  dataMatrix)
		{
			// This is directly applying Forney's Formula
			var s = errorLocations.length;
			var result = new Array(s);
			for (var i = 0; i < s; i++)
			{
				var xiInverse = this.field.inverse(errorLocations[i]);
				var denominator = 1;
				for (var j = 0; j < s; j++)
				{
					if (i != j)
					{
						denominator = this.field.multiply(denominator, GF256.addOrSubtract(1, this.field.multiply(errorLocations[j], xiInverse)));
					}
				}
				result[i] = this.field.multiply(errorEvaluator.evaluateAt(xiInverse), this.field.inverse(denominator));
				// Thanks to sanfordsquires for this fix:
				if (dataMatrix)
				{
					result[i] = this.field.multiply(result[i], xiInverse);
				}
			}
			return result;
		}
}
// Source: public/src/js/jsqrcode/gf256poly.js
/*
  Ported to JavaScript by Lazar Laszlo 2011 
  
  lazarsoft@gmail.com, www.lazarsoft.info
  
*/

/*
*
* Copyright 2007 ZXing authors
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*      http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/


function GF256Poly(field,  coefficients)
{
	if (coefficients == null || coefficients.length == 0)
	{
		throw "System.ArgumentException";
	}
	this.field = field;
	var coefficientsLength = coefficients.length;
	if (coefficientsLength > 1 && coefficients[0] == 0)
	{
		// Leading term must be non-zero for anything except the constant polynomial "0"
		var firstNonZero = 1;
		while (firstNonZero < coefficientsLength && coefficients[firstNonZero] == 0)
		{
			firstNonZero++;
		}
		if (firstNonZero == coefficientsLength)
		{
			this.coefficients = field.Zero.coefficients;
		}
		else
		{
			this.coefficients = new Array(coefficientsLength - firstNonZero);
			for(var i=0;i<this.coefficients.length;i++)this.coefficients[i]=0;
			//Array.Copy(coefficients, firstNonZero, this.coefficients, 0, this.coefficients.length);
			for(var ci=0;ci<this.coefficients.length;ci++)this.coefficients[ci]=coefficients[firstNonZero+ci];
		}
	}
	else
	{
		this.coefficients = coefficients;
	}
	
	this.__defineGetter__("Zero", function()
	{
		return this.coefficients[0] == 0;
	});
	this.__defineGetter__("Degree", function()
	{
		return this.coefficients.length - 1;
	});
	this.__defineGetter__("Coefficients", function()
	{
		return this.coefficients;
	});
	
	this.getCoefficient=function( degree)
	{
		return this.coefficients[this.coefficients.length - 1 - degree];
	}
	
	this.evaluateAt=function( a)
	{
		if (a == 0)
		{
			// Just return the x^0 coefficient
			return this.getCoefficient(0);
		}
		var size = this.coefficients.length;
		if (a == 1)
		{
			// Just the sum of the coefficients
			var result = 0;
			for (var i = 0; i < size; i++)
			{
				result = GF256.addOrSubtract(result, this.coefficients[i]);
			}
			return result;
		}
		var result2 = this.coefficients[0];
		for (var i = 1; i < size; i++)
		{
			result2 = GF256.addOrSubtract(this.field.multiply(a, result2), this.coefficients[i]);
		}
		return result2;
	}
	
	this.addOrSubtract=function( other)
		{
			if (this.field != other.field)
			{
				throw "GF256Polys do not have same GF256 field";
			}
			if (this.Zero)
			{
				return other;
			}
			if (other.Zero)
			{
				return this;
			}
			
			var smallerCoefficients = this.coefficients;
			var largerCoefficients = other.coefficients;
			if (smallerCoefficients.length > largerCoefficients.length)
			{
				var temp = smallerCoefficients;
				smallerCoefficients = largerCoefficients;
				largerCoefficients = temp;
			}
			var sumDiff = new Array(largerCoefficients.length);
			var lengthDiff = largerCoefficients.length - smallerCoefficients.length;
			// Copy high-order terms only found in higher-degree polynomial's coefficients
			//Array.Copy(largerCoefficients, 0, sumDiff, 0, lengthDiff);
			for(var ci=0;ci<lengthDiff;ci++)sumDiff[ci]=largerCoefficients[ci];
			
			for (var i = lengthDiff; i < largerCoefficients.length; i++)
			{
				sumDiff[i] = GF256.addOrSubtract(smallerCoefficients[i - lengthDiff], largerCoefficients[i]);
			}
			
			return new GF256Poly(field, sumDiff);
	}
	this.multiply1=function( other)
		{
			if (this.field!=other.field)
			{
				throw "GF256Polys do not have same GF256 field";
			}
			if (this.Zero || other.Zero)
			{
				return this.field.Zero;
			}
			var aCoefficients = this.coefficients;
			var aLength = aCoefficients.length;
			var bCoefficients = other.coefficients;
			var bLength = bCoefficients.length;
			var product = new Array(aLength + bLength - 1);
			for (var i = 0; i < aLength; i++)
			{
				var aCoeff = aCoefficients[i];
				for (var j = 0; j < bLength; j++)
				{
					product[i + j] = GF256.addOrSubtract(product[i + j], this.field.multiply(aCoeff, bCoefficients[j]));
				}
			}
			return new GF256Poly(this.field, product);
		}
	this.multiply2=function( scalar)
		{
			if (scalar == 0)
			{
				return this.field.Zero;
			}
			if (scalar == 1)
			{
				return this;
			}
			var size = this.coefficients.length;
			var product = new Array(size);
			for (var i = 0; i < size; i++)
			{
				product[i] = this.field.multiply(this.coefficients[i], scalar);
			}
			return new GF256Poly(this.field, product);
		}
	this.multiplyByMonomial=function( degree,  coefficient)
		{
			if (degree < 0)
			{
				throw "System.ArgumentException";
			}
			if (coefficient == 0)
			{
				return this.field.Zero;
			}
			var size = this.coefficients.length;
			var product = new Array(size + degree);
			for(var i=0;i<product.length;i++)product[i]=0;
			for (var i = 0; i < size; i++)
			{
				product[i] = this.field.multiply(this.coefficients[i], coefficient);
			}
			return new GF256Poly(this.field, product);
		}
	this.divide=function( other)
		{
			if (this.field!=other.field)
			{
				throw "GF256Polys do not have same GF256 field";
			}
			if (other.Zero)
			{
				throw "Divide by 0";
			}
			
			var quotient = this.field.Zero;
			var remainder = this;
			
			var denominatorLeadingTerm = other.getCoefficient(other.Degree);
			var inverseDenominatorLeadingTerm = this.field.inverse(denominatorLeadingTerm);
			
			while (remainder.Degree >= other.Degree && !remainder.Zero)
			{
				var degreeDifference = remainder.Degree - other.Degree;
				var scale = this.field.multiply(remainder.getCoefficient(remainder.Degree), inverseDenominatorLeadingTerm);
				var term = other.multiplyByMonomial(degreeDifference, scale);
				var iterationQuotient = this.field.buildMonomial(degreeDifference, scale);
				quotient = quotient.addOrSubtract(iterationQuotient);
				remainder = remainder.addOrSubtract(term);
			}
			
			return new Array(quotient, remainder);
		}
}
// Source: public/src/js/jsqrcode/gf256.js
/*
  Ported to JavaScript by Lazar Laszlo 2011 
  
  lazarsoft@gmail.com, www.lazarsoft.info
  
*/

/*
*
* Copyright 2007 ZXing authors
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*      http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/


function GF256( primitive)
{
	this.expTable = new Array(256);
	this.logTable = new Array(256);
	var x = 1;
	for (var i = 0; i < 256; i++)
	{
		this.expTable[i] = x;
		x <<= 1; // x = x * 2; we're assuming the generator alpha is 2
		if (x >= 0x100)
		{
			x ^= primitive;
		}
	}
	for (var i = 0; i < 255; i++)
	{
		this.logTable[this.expTable[i]] = i;
	}
	// logTable[0] == 0 but this should never be used
	var at0=new Array(1);at0[0]=0;
	this.zero = new GF256Poly(this, new Array(at0));
	var at1=new Array(1);at1[0]=1;
	this.one = new GF256Poly(this, new Array(at1));
	
	this.__defineGetter__("Zero", function()
	{
		return this.zero;
	});
	this.__defineGetter__("One", function()
	{
		return this.one;
	});
	this.buildMonomial=function( degree,  coefficient)
		{
			if (degree < 0)
			{
				throw "System.ArgumentException";
			}
			if (coefficient == 0)
			{
				return zero;
			}
			var coefficients = new Array(degree + 1);
			for(var i=0;i<coefficients.length;i++)coefficients[i]=0;
			coefficients[0] = coefficient;
			return new GF256Poly(this, coefficients);
		}
	this.exp=function( a)
		{
			return this.expTable[a];
		}
	this.log=function( a)
		{
			if (a == 0)
			{
				throw "System.ArgumentException";
			}
			return this.logTable[a];
		}
	this.inverse=function( a)
		{
			if (a == 0)
			{
				throw "System.ArithmeticException";
			}
			return this.expTable[255 - this.logTable[a]];
		}
	this.multiply=function( a,  b)
		{
			if (a == 0 || b == 0)
			{
				return 0;
			}
			if (a == 1)
			{
				return b;
			}
			if (b == 1)
			{
				return a;
			}
			return this.expTable[(this.logTable[a] + this.logTable[b]) % 255];
		}		
}

GF256.QR_CODE_FIELD = new GF256(0x011D);
GF256.DATA_MATRIX_FIELD = new GF256(0x012D);

GF256.addOrSubtract=function( a,  b)
{
	return a ^ b;
}
// Source: public/src/js/jsqrcode/decoder.js
/*
  Ported to JavaScript by Lazar Laszlo 2011 
  
  lazarsoft@gmail.com, www.lazarsoft.info
  
*/

/*
*
* Copyright 2007 ZXing authors
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*      http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/


Decoder={};
Decoder.rsDecoder = new ReedSolomonDecoder(GF256.QR_CODE_FIELD);

Decoder.correctErrors=function( codewordBytes,  numDataCodewords)
{
	var numCodewords = codewordBytes.length;
	// First read into an array of ints
	var codewordsInts = new Array(numCodewords);
	for (var i = 0; i < numCodewords; i++)
	{
		codewordsInts[i] = codewordBytes[i] & 0xFF;
	}
	var numECCodewords = codewordBytes.length - numDataCodewords;
	try
	{
		Decoder.rsDecoder.decode(codewordsInts, numECCodewords);
		//var corrector = new ReedSolomon(codewordsInts, numECCodewords);
		//corrector.correct();
	}
	catch ( rse)
	{
		throw rse;
	}
	// Copy back into array of bytes -- only need to worry about the bytes that were data
	// We don't care about errors in the error-correction codewords
	for (var i = 0; i < numDataCodewords; i++)
	{
		codewordBytes[i] =  codewordsInts[i];
	}
}

Decoder.decode=function(bits)
{
	var parser = new BitMatrixParser(bits);
	var version = parser.readVersion();
	var ecLevel = parser.readFormatInformation().ErrorCorrectionLevel;
	
	// Read codewords
	var codewords = parser.readCodewords();

	// Separate into data blocks
	var dataBlocks = DataBlock.getDataBlocks(codewords, version, ecLevel);
	
	// Count total number of data bytes
	var totalBytes = 0;
	for (var i = 0; i < dataBlocks.length; i++)
	{
		totalBytes += dataBlocks[i].NumDataCodewords;
	}
	var resultBytes = new Array(totalBytes);
	var resultOffset = 0;
	
	// Error-correct and copy data blocks together into a stream of bytes
	for (var j = 0; j < dataBlocks.length; j++)
	{
		var dataBlock = dataBlocks[j];
		var codewordBytes = dataBlock.Codewords;
		var numDataCodewords = dataBlock.NumDataCodewords;
		Decoder.correctErrors(codewordBytes, numDataCodewords);
		for (var i = 0; i < numDataCodewords; i++)
		{
			resultBytes[resultOffset++] = codewordBytes[i];
		}
	}
	
	// Decode the contents of that stream of bytes
	var reader = new QRCodeDataBlockReader(resultBytes, version.VersionNumber, ecLevel.Bits);
	return reader;
	//return DecodedBitStreamParser.decode(resultBytes, version, ecLevel);
}

// Source: public/src/js/jsqrcode/qrcode.js
/*
   Copyright 2011 Lazar Laszlo (lazarsoft@gmail.com, www.lazarsoft.info)
   
   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/


qrcode = window.qrcode || {};
qrcode.imagedata = null;
qrcode.width = 0;
qrcode.height = 0;
qrcode.qrCodeSymbol = null;
qrcode.debug = false;
qrcode.maxImgSize = 1024*1024;

qrcode.sizeOfDataLengthInfo =  [  [ 10, 9, 8, 8 ],  [ 12, 11, 16, 10 ],  [ 14, 13, 16, 12 ] ];

qrcode.callback = null;

qrcode.decode = function(src){
    
    if(arguments.length==0)
    {
        var canvas_qr = document.getElementById("qr-canvas");
        var context = canvas_qr.getContext('2d');
        qrcode.width = canvas_qr.width;
        qrcode.height = canvas_qr.height;
        qrcode.imagedata = context.getImageData(0, 0, qrcode.width, qrcode.height);
        qrcode.result = qrcode.process(context);
        if(qrcode.callback!=null)
            qrcode.callback(qrcode.result);
        return qrcode.result;
    }
    else
    {
        var image = new Image();
        image.onload=function(){
            //var canvas_qr = document.getElementById("qr-canvas");
            var canvas_qr = document.createElement('canvas');
            var context = canvas_qr.getContext('2d');
            var nheight = image.height;
            var nwidth = image.width;
            if(image.width*image.height>qrcode.maxImgSize)
            {
                var ir = image.width / image.height;
                nheight = Math.sqrt(qrcode.maxImgSize/ir);
                nwidth=ir*nheight;
            }

            canvas_qr.width = nwidth;
            canvas_qr.height = nheight;
            
            context.drawImage(image, 0, 0, canvas_qr.width, canvas_qr.height );
            qrcode.width = canvas_qr.width;
            qrcode.height = canvas_qr.height;
            try{
                qrcode.imagedata = context.getImageData(0, 0, canvas_qr.width, canvas_qr.height);
            }catch(e){
                qrcode.result = "Cross domain image reading not supported in your browser! Save it to your computer then drag and drop the file!";
                if(qrcode.callback!=null)
                    qrcode.callback(qrcode.result);
                return;
            }
            
            try
            {
                qrcode.result = qrcode.process(context);
            }
            catch(e)
            {
                console.log(e);
                qrcode.result = "error decoding QR Code";
            }
            if(qrcode.callback!=null)
                qrcode.callback(qrcode.result);
        }
        image.src = src;
    }
}

qrcode.isUrl = function(s)
{
    var regexp = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
    return regexp.test(s);
}

qrcode.decode_url = function (s)
{
  var escaped = "";
  try{
    escaped = escape( s );
  }
  catch(e)
  {
    console.log(e);
    escaped = s;
  }
  var ret = "";
  try{
    ret = decodeURIComponent( escaped );
  }
  catch(e)
  {
    console.log(e);
    ret = escaped;
  }
  return ret;
}

qrcode.decode_utf8 = function ( s )
{
    if(qrcode.isUrl(s))
        return qrcode.decode_url(s);
    else
        return s;
}

qrcode.process = function(ctx){
    
    var start = new Date().getTime();

    var image = qrcode.grayScaleToBitmap(qrcode.grayscale());
    //var image = qrcode.binarize(128);
    
    if(qrcode.debug)
    {
        for (var y = 0; y < qrcode.height; y++)
        {
            for (var x = 0; x < qrcode.width; x++)
            {
                var point = (x * 4) + (y * qrcode.width * 4);
                qrcode.imagedata.data[point] = image[x+y*qrcode.width]?0:0;
                qrcode.imagedata.data[point+1] = image[x+y*qrcode.width]?0:0;
                qrcode.imagedata.data[point+2] = image[x+y*qrcode.width]?255:0;
            }
        }
        ctx.putImageData(qrcode.imagedata, 0, 0);
    }
    
    //var finderPatternInfo = new FinderPatternFinder().findFinderPattern(image);
    
    var detector = new Detector(image);

    var qRCodeMatrix = detector.detect();
    
    /*for (var y = 0; y < qRCodeMatrix.bits.Height; y++)
    {
        for (var x = 0; x < qRCodeMatrix.bits.Width; x++)
        {
            var point = (x * 4*2) + (y*2 * qrcode.width * 4);
            qrcode.imagedata.data[point] = qRCodeMatrix.bits.get_Renamed(x,y)?0:0;
            qrcode.imagedata.data[point+1] = qRCodeMatrix.bits.get_Renamed(x,y)?0:0;
            qrcode.imagedata.data[point+2] = qRCodeMatrix.bits.get_Renamed(x,y)?255:0;
        }
    }*/
    if(qrcode.debug)
        ctx.putImageData(qrcode.imagedata, 0, 0);
    
    var reader = Decoder.decode(qRCodeMatrix.bits);
    var data = reader.DataByte;
    var str="";
    for(var i=0;i<data.length;i++)
    {
        for(var j=0;j<data[i].length;j++)
            str+=String.fromCharCode(data[i][j]);
    }
    
    var end = new Date().getTime();
    var time = end - start;
    console.log(time);
    
    return qrcode.decode_utf8(str);
    //alert("Time:" + time + " Code: "+str);
}

qrcode.getPixel = function(x,y){
    if (qrcode.width < x) {
        throw "point error";
    }
    if (qrcode.height < y) {
        throw "point error";
    }
    point = (x * 4) + (y * qrcode.width * 4);
    p = (qrcode.imagedata.data[point]*33 + qrcode.imagedata.data[point + 1]*34 + qrcode.imagedata.data[point + 2]*33)/100;
    return p;
}

qrcode.binarize = function(th){
    var ret = new Array(qrcode.width*qrcode.height);
    for (var y = 0; y < qrcode.height; y++)
    {
        for (var x = 0; x < qrcode.width; x++)
        {
            var gray = qrcode.getPixel(x, y);
            
            ret[x+y*qrcode.width] = gray<=th?true:false;
        }
    }
    return ret;
}

qrcode.getMiddleBrightnessPerArea=function(image)
{
    var numSqrtArea = 4;
    //obtain middle brightness((min + max) / 2) per area
    var areaWidth = Math.floor(qrcode.width / numSqrtArea);
    var areaHeight = Math.floor(qrcode.height / numSqrtArea);
    var minmax = new Array(numSqrtArea);
    for (var i = 0; i < numSqrtArea; i++)
    {
        minmax[i] = new Array(numSqrtArea);
        for (var i2 = 0; i2 < numSqrtArea; i2++)
        {
            minmax[i][i2] = new Array(0,0);
        }
    }
    for (var ay = 0; ay < numSqrtArea; ay++)
    {
        for (var ax = 0; ax < numSqrtArea; ax++)
        {
            minmax[ax][ay][0] = 0xFF;
            for (var dy = 0; dy < areaHeight; dy++)
            {
                for (var dx = 0; dx < areaWidth; dx++)
                {
                    var target = image[areaWidth * ax + dx+(areaHeight * ay + dy)*qrcode.width];
                    if (target < minmax[ax][ay][0])
                        minmax[ax][ay][0] = target;
                    if (target > minmax[ax][ay][1])
                        minmax[ax][ay][1] = target;
                }
            }
            //minmax[ax][ay][0] = (minmax[ax][ay][0] + minmax[ax][ay][1]) / 2;
        }
    }
    var middle = new Array(numSqrtArea);
    for (var i3 = 0; i3 < numSqrtArea; i3++)
    {
        middle[i3] = new Array(numSqrtArea);
    }
    for (var ay = 0; ay < numSqrtArea; ay++)
    {
        for (var ax = 0; ax < numSqrtArea; ax++)
        {
            middle[ax][ay] = Math.floor((minmax[ax][ay][0] + minmax[ax][ay][1]) / 2);
            //Console.out.print(middle[ax][ay] + ",");
        }
        //Console.out.println("");
    }
    //Console.out.println("");
    
    return middle;
}

qrcode.grayScaleToBitmap=function(grayScale)
{
    var middle = qrcode.getMiddleBrightnessPerArea(grayScale);
    var sqrtNumArea = middle.length;
    var areaWidth = Math.floor(qrcode.width / sqrtNumArea);
    var areaHeight = Math.floor(qrcode.height / sqrtNumArea);
    var bitmap = new Array(qrcode.height*qrcode.width);
    
    for (var ay = 0; ay < sqrtNumArea; ay++)
    {
        for (var ax = 0; ax < sqrtNumArea; ax++)
        {
            for (var dy = 0; dy < areaHeight; dy++)
            {
                for (var dx = 0; dx < areaWidth; dx++)
                {
                    bitmap[areaWidth * ax + dx+ (areaHeight * ay + dy)*qrcode.width] = (grayScale[areaWidth * ax + dx+ (areaHeight * ay + dy)*qrcode.width] < middle[ax][ay])?true:false;
                }
            }
        }
    }
    return bitmap;
}

qrcode.grayscale = function(){
    var ret = new Array(qrcode.width*qrcode.height);
    for (var y = 0; y < qrcode.height; y++)
    {
        for (var x = 0; x < qrcode.width; x++)
        {
            var gray = qrcode.getPixel(x, y);
            
            ret[x+y*qrcode.width] = gray;
        }
    }
    return ret;
}




function URShift( number,  bits)
{
    if (number >= 0)
        return number >> bits;
    else
        return (number >> bits) + (2 << ~bits);
}


Array.prototype.remove = function(from, to) {
  var rest = this.slice((to || from) + 1 || this.length);
  this.length = from < 0 ? this.length + from : from;
  return this.push.apply(this, rest);
};

// Source: public/src/js/jsqrcode/findpat.js
/*
  Ported to JavaScript by Lazar Laszlo 2011 
  
  lazarsoft@gmail.com, www.lazarsoft.info
  
*/

/*
*
* Copyright 2007 ZXing authors
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*      http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/


var MIN_SKIP = 3;
var MAX_MODULES = 57;
var INTEGER_MATH_SHIFT = 8;
var CENTER_QUORUM = 2;

qrcode.orderBestPatterns=function(patterns)
		{
			
			function distance( pattern1,  pattern2)
			{
				xDiff = pattern1.X - pattern2.X;
				yDiff = pattern1.Y - pattern2.Y;
				return  Math.sqrt( (xDiff * xDiff + yDiff * yDiff));
			}
			
			/// <summary> Returns the z component of the cross product between vectors BC and BA.</summary>
			function crossProductZ( pointA,  pointB,  pointC)
			{
				var bX = pointB.x;
				var bY = pointB.y;
				return ((pointC.x - bX) * (pointA.y - bY)) - ((pointC.y - bY) * (pointA.x - bX));
			}

			
			// Find distances between pattern centers
			var zeroOneDistance = distance(patterns[0], patterns[1]);
			var oneTwoDistance = distance(patterns[1], patterns[2]);
			var zeroTwoDistance = distance(patterns[0], patterns[2]);
			
			var pointA, pointB, pointC;
			// Assume one closest to other two is B; A and C will just be guesses at first
			if (oneTwoDistance >= zeroOneDistance && oneTwoDistance >= zeroTwoDistance)
			{
				pointB = patterns[0];
				pointA = patterns[1];
				pointC = patterns[2];
			}
			else if (zeroTwoDistance >= oneTwoDistance && zeroTwoDistance >= zeroOneDistance)
			{
				pointB = patterns[1];
				pointA = patterns[0];
				pointC = patterns[2];
			}
			else
			{
				pointB = patterns[2];
				pointA = patterns[0];
				pointC = patterns[1];
			}
			
			// Use cross product to figure out whether A and C are correct or flipped.
			// This asks whether BC x BA has a positive z component, which is the arrangement
			// we want for A, B, C. If it's negative, then we've got it flipped around and
			// should swap A and C.
			if (crossProductZ(pointA, pointB, pointC) < 0.0)
			{
				var temp = pointA;
				pointA = pointC;
				pointC = temp;
			}
			
			patterns[0] = pointA;
			patterns[1] = pointB;
			patterns[2] = pointC;
		}


function FinderPattern(posX, posY,  estimatedModuleSize)
{
	this.x=posX;
	this.y=posY;
	this.count = 1;
	this.estimatedModuleSize = estimatedModuleSize;
	
	this.__defineGetter__("EstimatedModuleSize", function()
	{
		return this.estimatedModuleSize;
	}); 
	this.__defineGetter__("Count", function()
	{
		return this.count;
	});
	this.__defineGetter__("X", function()
	{
		return this.x;
	});
	this.__defineGetter__("Y", function()
	{
		return this.y;
	});
	this.incrementCount = function()
	{
		this.count++;
	}
	this.aboutEquals=function( moduleSize,  i,  j)
		{
			if (Math.abs(i - this.y) <= moduleSize && Math.abs(j - this.x) <= moduleSize)
			{
				var moduleSizeDiff = Math.abs(moduleSize - this.estimatedModuleSize);
				return moduleSizeDiff <= 1.0 || moduleSizeDiff / this.estimatedModuleSize <= 1.0;
			}
			return false;
		}
	
}

function FinderPatternInfo(patternCenters)
{
	this.bottomLeft = patternCenters[0];
	this.topLeft = patternCenters[1];
	this.topRight = patternCenters[2];
	this.__defineGetter__("BottomLeft", function()
	{
		return this.bottomLeft;
	}); 
	this.__defineGetter__("TopLeft", function()
	{
		return this.topLeft;
	}); 
	this.__defineGetter__("TopRight", function()
	{
		return this.topRight;
	}); 
}

function FinderPatternFinder()
{
	this.image=null;
	this.possibleCenters = [];
	this.hasSkipped = false;
	this.crossCheckStateCount = new Array(0,0,0,0,0);
	this.resultPointCallback = null;
	
	this.__defineGetter__("CrossCheckStateCount", function()
	{
		this.crossCheckStateCount[0] = 0;
		this.crossCheckStateCount[1] = 0;
		this.crossCheckStateCount[2] = 0;
		this.crossCheckStateCount[3] = 0;
		this.crossCheckStateCount[4] = 0;
		return this.crossCheckStateCount;
	}); 
	
	this.foundPatternCross=function( stateCount)
		{
			var totalModuleSize = 0;
			for (var i = 0; i < 5; i++)
			{
				var count = stateCount[i];
				if (count == 0)
				{
					return false;
				}
				totalModuleSize += count;
			}
			if (totalModuleSize < 7)
			{
				return false;
			}
			var moduleSize = Math.floor((totalModuleSize << INTEGER_MATH_SHIFT) / 7);
			var maxVariance = Math.floor(moduleSize / 2);
			// Allow less than 50% variance from 1-1-3-1-1 proportions
			return Math.abs(moduleSize - (stateCount[0] << INTEGER_MATH_SHIFT)) < maxVariance && Math.abs(moduleSize - (stateCount[1] << INTEGER_MATH_SHIFT)) < maxVariance && Math.abs(3 * moduleSize - (stateCount[2] << INTEGER_MATH_SHIFT)) < 3 * maxVariance && Math.abs(moduleSize - (stateCount[3] << INTEGER_MATH_SHIFT)) < maxVariance && Math.abs(moduleSize - (stateCount[4] << INTEGER_MATH_SHIFT)) < maxVariance;
		}
	this.centerFromEnd=function( stateCount,  end)
		{
			return  (end - stateCount[4] - stateCount[3]) - stateCount[2] / 2.0;
		}
	this.crossCheckVertical=function( startI,  centerJ,  maxCount,  originalStateCountTotal)
		{
			var image = this.image;
			
			var maxI = qrcode.height;
			var stateCount = this.CrossCheckStateCount;
			
			// Start counting up from center
			var i = startI;
			while (i >= 0 && image[centerJ + i*qrcode.width])
			{
				stateCount[2]++;
				i--;
			}
			if (i < 0)
			{
				return NaN;
			}
			while (i >= 0 && !image[centerJ +i*qrcode.width] && stateCount[1] <= maxCount)
			{
				stateCount[1]++;
				i--;
			}
			// If already too many modules in this state or ran off the edge:
			if (i < 0 || stateCount[1] > maxCount)
			{
				return NaN;
			}
			while (i >= 0 && image[centerJ + i*qrcode.width] && stateCount[0] <= maxCount)
			{
				stateCount[0]++;
				i--;
			}
			if (stateCount[0] > maxCount)
			{
				return NaN;
			}
			
			// Now also count down from center
			i = startI + 1;
			while (i < maxI && image[centerJ +i*qrcode.width])
			{
				stateCount[2]++;
				i++;
			}
			if (i == maxI)
			{
				return NaN;
			}
			while (i < maxI && !image[centerJ + i*qrcode.width] && stateCount[3] < maxCount)
			{
				stateCount[3]++;
				i++;
			}
			if (i == maxI || stateCount[3] >= maxCount)
			{
				return NaN;
			}
			while (i < maxI && image[centerJ + i*qrcode.width] && stateCount[4] < maxCount)
			{
				stateCount[4]++;
				i++;
			}
			if (stateCount[4] >= maxCount)
			{
				return NaN;
			}
			
			// If we found a finder-pattern-like section, but its size is more than 40% different than
			// the original, assume it's a false positive
			var stateCountTotal = stateCount[0] + stateCount[1] + stateCount[2] + stateCount[3] + stateCount[4];
			if (5 * Math.abs(stateCountTotal - originalStateCountTotal) >= 2 * originalStateCountTotal)
			{
				return NaN;
			}
			
			return this.foundPatternCross(stateCount)?this.centerFromEnd(stateCount, i):NaN;
		}
	this.crossCheckHorizontal=function( startJ,  centerI,  maxCount, originalStateCountTotal)
		{
			var image = this.image;
			
			var maxJ = qrcode.width;
			var stateCount = this.CrossCheckStateCount;
			
			var j = startJ;
			while (j >= 0 && image[j+ centerI*qrcode.width])
			{
				stateCount[2]++;
				j--;
			}
			if (j < 0)
			{
				return NaN;
			}
			while (j >= 0 && !image[j+ centerI*qrcode.width] && stateCount[1] <= maxCount)
			{
				stateCount[1]++;
				j--;
			}
			if (j < 0 || stateCount[1] > maxCount)
			{
				return NaN;
			}
			while (j >= 0 && image[j+ centerI*qrcode.width] && stateCount[0] <= maxCount)
			{
				stateCount[0]++;
				j--;
			}
			if (stateCount[0] > maxCount)
			{
				return NaN;
			}
			
			j = startJ + 1;
			while (j < maxJ && image[j+ centerI*qrcode.width])
			{
				stateCount[2]++;
				j++;
			}
			if (j == maxJ)
			{
				return NaN;
			}
			while (j < maxJ && !image[j+ centerI*qrcode.width] && stateCount[3] < maxCount)
			{
				stateCount[3]++;
				j++;
			}
			if (j == maxJ || stateCount[3] >= maxCount)
			{
				return NaN;
			}
			while (j < maxJ && image[j+ centerI*qrcode.width] && stateCount[4] < maxCount)
			{
				stateCount[4]++;
				j++;
			}
			if (stateCount[4] >= maxCount)
			{
				return NaN;
			}
			
			// If we found a finder-pattern-like section, but its size is significantly different than
			// the original, assume it's a false positive
			var stateCountTotal = stateCount[0] + stateCount[1] + stateCount[2] + stateCount[3] + stateCount[4];
			if (5 * Math.abs(stateCountTotal - originalStateCountTotal) >= originalStateCountTotal)
			{
				return NaN;
			}
			
			return this.foundPatternCross(stateCount)?this.centerFromEnd(stateCount, j):NaN;
		}
	this.handlePossibleCenter=function( stateCount,  i,  j)
		{
			var stateCountTotal = stateCount[0] + stateCount[1] + stateCount[2] + stateCount[3] + stateCount[4];
			var centerJ = this.centerFromEnd(stateCount, j); //float
			var centerI = this.crossCheckVertical(i, Math.floor( centerJ), stateCount[2], stateCountTotal); //float
			if (!isNaN(centerI))
			{
				// Re-cross check
				centerJ = this.crossCheckHorizontal(Math.floor( centerJ), Math.floor( centerI), stateCount[2], stateCountTotal);
				if (!isNaN(centerJ))
				{
					var estimatedModuleSize =   stateCountTotal / 7.0;
					var found = false;
					var max = this.possibleCenters.length;
					for (var index = 0; index < max; index++)
					{
						var center = this.possibleCenters[index];
						// Look for about the same center and module size:
						if (center.aboutEquals(estimatedModuleSize, centerI, centerJ))
						{
							center.incrementCount();
							found = true;
							break;
						}
					}
					if (!found)
					{
						var point = new FinderPattern(centerJ, centerI, estimatedModuleSize);
						this.possibleCenters.push(point);
						if (this.resultPointCallback != null)
						{
							this.resultPointCallback.foundPossibleResultPoint(point);
						}
					}
					return true;
				}
			}
			return false;
		}
		
	this.selectBestPatterns=function()
		{
			
			var startSize = this.possibleCenters.length;
			if (startSize < 3)
			{
				// Couldn't find enough finder patterns
				throw "Couldn't find enough finder patterns";
			}
			
			// Filter outlier possibilities whose module size is too different
			if (startSize > 3)
			{
				// But we can only afford to do so if we have at least 4 possibilities to choose from
				var totalModuleSize = 0.0;
                var square = 0.0;
				for (var i = 0; i < startSize; i++)
				{
					//totalModuleSize +=  this.possibleCenters[i].EstimatedModuleSize;
                    var	centerValue=this.possibleCenters[i].EstimatedModuleSize;
					totalModuleSize += centerValue;
					square += (centerValue * centerValue);
				}
				var average = totalModuleSize /  startSize;
                this.possibleCenters.sort(function(center1,center2) {
				      var dA=Math.abs(center2.EstimatedModuleSize - average);
				      var dB=Math.abs(center1.EstimatedModuleSize - average);
				      if (dA < dB) {
				    	  return (-1);
				      } else if (dA == dB) {
				    	  return 0;
				      } else {
				    	  return 1;
				      }
					});

				var stdDev = Math.sqrt(square / startSize - average * average);
				var limit = Math.max(0.2 * average, stdDev);
				for (var i = 0; i < this.possibleCenters.length && this.possibleCenters.length > 3; i++)
				{
					var pattern =  this.possibleCenters[i];
					//if (Math.abs(pattern.EstimatedModuleSize - average) > 0.2 * average)
                    if (Math.abs(pattern.EstimatedModuleSize - average) > limit)
					{
						this.possibleCenters.remove(i);
						i--;
					}
				}
			}
			
			if (this.possibleCenters.length > 3)
			{
				// Throw away all but those first size candidate points we found.
				this.possibleCenters.sort(function(a, b){
					if (a.count > b.count){return -1;}
					if (a.count < b.count){return 1;}
					return 0;
				});
			}
			
			return new Array( this.possibleCenters[0],  this.possibleCenters[1],  this.possibleCenters[2]);
		}
		
	this.findRowSkip=function()
		{
			var max = this.possibleCenters.length;
			if (max <= 1)
			{
				return 0;
			}
			var firstConfirmedCenter = null;
			for (var i = 0; i < max; i++)
			{
				var center =  this.possibleCenters[i];
				if (center.Count >= CENTER_QUORUM)
				{
					if (firstConfirmedCenter == null)
					{
						firstConfirmedCenter = center;
					}
					else
					{
						// We have two confirmed centers
						// How far down can we skip before resuming looking for the next
						// pattern? In the worst case, only the difference between the
						// difference in the x / y coordinates of the two centers.
						// This is the case where you find top left last.
						this.hasSkipped = true;
						return Math.floor ((Math.abs(firstConfirmedCenter.X - center.X) - Math.abs(firstConfirmedCenter.Y - center.Y)) / 2);
					}
				}
			}
			return 0;
		}
	
	this.haveMultiplyConfirmedCenters=function()
		{
			var confirmedCount = 0;
			var totalModuleSize = 0.0;
			var max = this.possibleCenters.length;
			for (var i = 0; i < max; i++)
			{
				var pattern =  this.possibleCenters[i];
				if (pattern.Count >= CENTER_QUORUM)
				{
					confirmedCount++;
					totalModuleSize += pattern.EstimatedModuleSize;
				}
			}
			if (confirmedCount < 3)
			{
				return false;
			}
			// OK, we have at least 3 confirmed centers, but, it's possible that one is a "false positive"
			// and that we need to keep looking. We detect this by asking if the estimated module sizes
			// vary too much. We arbitrarily say that when the total deviation from average exceeds
			// 5% of the total module size estimates, it's too much.
			var average = totalModuleSize / max;
			var totalDeviation = 0.0;
			for (var i = 0; i < max; i++)
			{
				pattern = this.possibleCenters[i];
				totalDeviation += Math.abs(pattern.EstimatedModuleSize - average);
			}
			return totalDeviation <= 0.05 * totalModuleSize;
		}
		
	this.findFinderPattern = function(image){
		var tryHarder = false;
		this.image=image;
		var maxI = qrcode.height;
		var maxJ = qrcode.width;
		var iSkip = Math.floor((3 * maxI) / (4 * MAX_MODULES));
		if (iSkip < MIN_SKIP || tryHarder)
		{
				iSkip = MIN_SKIP;
		}
		
		var done = false;
		var stateCount = new Array(5);
		for (var i = iSkip - 1; i < maxI && !done; i += iSkip)
		{
			// Get a row of black/white values
			stateCount[0] = 0;
			stateCount[1] = 0;
			stateCount[2] = 0;
			stateCount[3] = 0;
			stateCount[4] = 0;
			var currentState = 0;
			for (var j = 0; j < maxJ; j++)
			{
				if (image[j+i*qrcode.width] )
				{
					// Black pixel
					if ((currentState & 1) == 1)
					{
						// Counting white pixels
						currentState++;
					}
					stateCount[currentState]++;
				}
				else
				{
					// White pixel
					if ((currentState & 1) == 0)
					{
						// Counting black pixels
						if (currentState == 4)
						{
							// A winner?
							if (this.foundPatternCross(stateCount))
							{
								// Yes
								var confirmed = this.handlePossibleCenter(stateCount, i, j);
								if (confirmed)
								{
									// Start examining every other line. Checking each line turned out to be too
									// expensive and didn't improve performance.
									iSkip = 2;
									if (this.hasSkipped)
									{
										done = this.haveMultiplyConfirmedCenters();
									}
									else
									{
										var rowSkip = this.findRowSkip();
										if (rowSkip > stateCount[2])
										{
											// Skip rows between row of lower confirmed center
											// and top of presumed third confirmed center
											// but back up a bit to get a full chance of detecting
											// it, entire width of center of finder pattern
											
											// Skip by rowSkip, but back off by stateCount[2] (size of last center
											// of pattern we saw) to be conservative, and also back off by iSkip which
											// is about to be re-added
											i += rowSkip - stateCount[2] - iSkip;
											j = maxJ - 1;
										}
									}
								}
								else
								{
									// Advance to next black pixel
									do 
									{
										j++;
									}
									while (j < maxJ && !image[j + i*qrcode.width]);
									j--; // back up to that last white pixel
								}
								// Clear state to start looking again
								currentState = 0;
								stateCount[0] = 0;
								stateCount[1] = 0;
								stateCount[2] = 0;
								stateCount[3] = 0;
								stateCount[4] = 0;
							}
							else
							{
								// No, shift counts back by two
								stateCount[0] = stateCount[2];
								stateCount[1] = stateCount[3];
								stateCount[2] = stateCount[4];
								stateCount[3] = 1;
								stateCount[4] = 0;
								currentState = 3;
							}
						}
						else
						{
							stateCount[++currentState]++;
						}
					}
					else
					{
						// Counting white pixels
						stateCount[currentState]++;
					}
				}
			}
			if (this.foundPatternCross(stateCount))
			{
				var confirmed = this.handlePossibleCenter(stateCount, i, maxJ);
				if (confirmed)
				{
					iSkip = stateCount[0];
					if (this.hasSkipped)
					{
						// Found a third one
						done = haveMultiplyConfirmedCenters();
					}
				}
			}
		}
		
		var patternInfo = this.selectBestPatterns();
		qrcode.orderBestPatterns(patternInfo);
		
		return new FinderPatternInfo(patternInfo);
	};
}

// Source: public/src/js/jsqrcode/alignpat.js
/*
  Ported to JavaScript by Lazar Laszlo 2011 
  
  lazarsoft@gmail.com, www.lazarsoft.info
  
*/

/*
*
* Copyright 2007 ZXing authors
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*      http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/


function AlignmentPattern(posX, posY,  estimatedModuleSize)
{
	this.x=posX;
	this.y=posY;
	this.count = 1;
	this.estimatedModuleSize = estimatedModuleSize;
	
	this.__defineGetter__("EstimatedModuleSize", function()
	{
		return this.estimatedModuleSize;
	}); 
	this.__defineGetter__("Count", function()
	{
		return this.count;
	});
	this.__defineGetter__("X", function()
	{
		return Math.floor(this.x);
	});
	this.__defineGetter__("Y", function()
	{
		return Math.floor(this.y);
	});
	this.incrementCount = function()
	{
		this.count++;
	}
	this.aboutEquals=function( moduleSize,  i,  j)
		{
			if (Math.abs(i - this.y) <= moduleSize && Math.abs(j - this.x) <= moduleSize)
			{
				var moduleSizeDiff = Math.abs(moduleSize - this.estimatedModuleSize);
				return moduleSizeDiff <= 1.0 || moduleSizeDiff / this.estimatedModuleSize <= 1.0;
			}
			return false;
		}
	
}

function AlignmentPatternFinder( image,  startX,  startY,  width,  height,  moduleSize,  resultPointCallback)
{
	this.image = image;
	this.possibleCenters = new Array();
	this.startX = startX;
	this.startY = startY;
	this.width = width;
	this.height = height;
	this.moduleSize = moduleSize;
	this.crossCheckStateCount = new Array(0,0,0);
	this.resultPointCallback = resultPointCallback;
	
	this.centerFromEnd=function(stateCount,  end)
		{
			return  (end - stateCount[2]) - stateCount[1] / 2.0;
		}
	this.foundPatternCross = function(stateCount)
		{
			var moduleSize = this.moduleSize;
			var maxVariance = moduleSize / 2.0;
			for (var i = 0; i < 3; i++)
			{
				if (Math.abs(moduleSize - stateCount[i]) >= maxVariance)
				{
					return false;
				}
			}
			return true;
		}

	this.crossCheckVertical=function( startI,  centerJ,  maxCount,  originalStateCountTotal)
		{
			var image = this.image;
			
			var maxI = qrcode.height;
			var stateCount = this.crossCheckStateCount;
			stateCount[0] = 0;
			stateCount[1] = 0;
			stateCount[2] = 0;
			
			// Start counting up from center
			var i = startI;
			while (i >= 0 && image[centerJ + i*qrcode.width] && stateCount[1] <= maxCount)
			{
				stateCount[1]++;
				i--;
			}
			// If already too many modules in this state or ran off the edge:
			if (i < 0 || stateCount[1] > maxCount)
			{
				return NaN;
			}
			while (i >= 0 && !image[centerJ + i*qrcode.width] && stateCount[0] <= maxCount)
			{
				stateCount[0]++;
				i--;
			}
			if (stateCount[0] > maxCount)
			{
				return NaN;
			}
			
			// Now also count down from center
			i = startI + 1;
			while (i < maxI && image[centerJ + i*qrcode.width] && stateCount[1] <= maxCount)
			{
				stateCount[1]++;
				i++;
			}
			if (i == maxI || stateCount[1] > maxCount)
			{
				return NaN;
			}
			while (i < maxI && !image[centerJ + i*qrcode.width] && stateCount[2] <= maxCount)
			{
				stateCount[2]++;
				i++;
			}
			if (stateCount[2] > maxCount)
			{
				return NaN;
			}
			
			var stateCountTotal = stateCount[0] + stateCount[1] + stateCount[2];
			if (5 * Math.abs(stateCountTotal - originalStateCountTotal) >= 2 * originalStateCountTotal)
			{
				return NaN;
			}
			
			return this.foundPatternCross(stateCount)?this.centerFromEnd(stateCount, i):NaN;
		}
		
	this.handlePossibleCenter=function( stateCount,  i,  j)
		{
			var stateCountTotal = stateCount[0] + stateCount[1] + stateCount[2];
			var centerJ = this.centerFromEnd(stateCount, j);
			var centerI = this.crossCheckVertical(i, Math.floor (centerJ), 2 * stateCount[1], stateCountTotal);
			if (!isNaN(centerI))
			{
				var estimatedModuleSize = (stateCount[0] + stateCount[1] + stateCount[2]) / 3.0;
				var max = this.possibleCenters.length;
				for (var index = 0; index < max; index++)
				{
					var center =  this.possibleCenters[index];
					// Look for about the same center and module size:
					if (center.aboutEquals(estimatedModuleSize, centerI, centerJ))
					{
						return new AlignmentPattern(centerJ, centerI, estimatedModuleSize);
					}
				}
				// Hadn't found this before; save it
				var point = new AlignmentPattern(centerJ, centerI, estimatedModuleSize);
				this.possibleCenters.push(point);
				if (this.resultPointCallback != null)
				{
					this.resultPointCallback.foundPossibleResultPoint(point);
				}
			}
			return null;
		}
		
	this.find = function()
	{
			var startX = this.startX;
			var height = this.height;
			var maxJ = startX + width;
			var middleI = startY + (height >> 1);
			// We are looking for black/white/black modules in 1:1:1 ratio;
			// this tracks the number of black/white/black modules seen so far
			var stateCount = new Array(0,0,0);
			for (var iGen = 0; iGen < height; iGen++)
			{
				// Search from middle outwards
				var i = middleI + ((iGen & 0x01) == 0?((iGen + 1) >> 1):- ((iGen + 1) >> 1));
				stateCount[0] = 0;
				stateCount[1] = 0;
				stateCount[2] = 0;
				var j = startX;
				// Burn off leading white pixels before anything else; if we start in the middle of
				// a white run, it doesn't make sense to count its length, since we don't know if the
				// white run continued to the left of the start point
				while (j < maxJ && !image[j + qrcode.width* i])
				{
					j++;
				}
				var currentState = 0;
				while (j < maxJ)
				{
					if (image[j + i*qrcode.width])
					{
						// Black pixel
						if (currentState == 1)
						{
							// Counting black pixels
							stateCount[currentState]++;
						}
						else
						{
							// Counting white pixels
							if (currentState == 2)
							{
								// A winner?
								if (this.foundPatternCross(stateCount))
								{
									// Yes
									var confirmed = this.handlePossibleCenter(stateCount, i, j);
									if (confirmed != null)
									{
										return confirmed;
									}
								}
								stateCount[0] = stateCount[2];
								stateCount[1] = 1;
								stateCount[2] = 0;
								currentState = 1;
							}
							else
							{
								stateCount[++currentState]++;
							}
						}
					}
					else
					{
						// White pixel
						if (currentState == 1)
						{
							// Counting black pixels
							currentState++;
						}
						stateCount[currentState]++;
					}
					j++;
				}
				if (this.foundPatternCross(stateCount))
				{
					var confirmed = this.handlePossibleCenter(stateCount, i, maxJ);
					if (confirmed != null)
					{
						return confirmed;
					}
				}
			}
			
			// Hmm, nothing we saw was observed and confirmed twice. If we had
			// any guess at all, return it.
			if (!(this.possibleCenters.length == 0))
			{
				return  this.possibleCenters[0];
			}
			
			throw "Couldn't find enough alignment patterns";
		}
	
}
// Source: public/src/js/jsqrcode/databr.js
/*
  Ported to JavaScript by Lazar Laszlo 2011 
  
  lazarsoft@gmail.com, www.lazarsoft.info
  
*/

/*
*
* Copyright 2007 ZXing authors
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*      http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/


function QRCodeDataBlockReader(blocks,  version,  numErrorCorrectionCode)
{
	this.blockPointer = 0;
	this.bitPointer = 7;
	this.dataLength = 0;
	this.blocks = blocks;
	this.numErrorCorrectionCode = numErrorCorrectionCode;
	if (version <= 9)
		this.dataLengthMode = 0;
	else if (version >= 10 && version <= 26)
		this.dataLengthMode = 1;
	else if (version >= 27 && version <= 40)
		this.dataLengthMode = 2;
		
	this.getNextBits = function( numBits)
		{			
			var bits = 0;
			if (numBits < this.bitPointer + 1)
			{
				// next word fits into current data block
				var mask = 0;
				for (var i = 0; i < numBits; i++)
				{
					mask += (1 << i);
				}
				mask <<= (this.bitPointer - numBits + 1);
				
				bits = (this.blocks[this.blockPointer] & mask) >> (this.bitPointer - numBits + 1);
				this.bitPointer -= numBits;
				return bits;
			}
			else if (numBits < this.bitPointer + 1 + 8)
			{
				// next word crosses 2 data blocks
				var mask1 = 0;
				for (var i = 0; i < this.bitPointer + 1; i++)
				{
					mask1 += (1 << i);
				}
				bits = (this.blocks[this.blockPointer] & mask1) << (numBits - (this.bitPointer + 1));
                this.blockPointer++;
				bits += ((this.blocks[this.blockPointer]) >> (8 - (numBits - (this.bitPointer + 1))));
				
				this.bitPointer = this.bitPointer - numBits % 8;
				if (this.bitPointer < 0)
				{
					this.bitPointer = 8 + this.bitPointer;
				}
				return bits;
			}
			else if (numBits < this.bitPointer + 1 + 16)
			{
				// next word crosses 3 data blocks
				var mask1 = 0; // mask of first block
				var mask3 = 0; // mask of 3rd block
				//bitPointer + 1 : number of bits of the 1st block
				//8 : number of the 2nd block (note that use already 8bits because next word uses 3 data blocks)
				//numBits - (bitPointer + 1 + 8) : number of bits of the 3rd block 
				for (var i = 0; i < this.bitPointer + 1; i++)
				{
					mask1 += (1 << i);
				}
				var bitsFirstBlock = (this.blocks[this.blockPointer] & mask1) << (numBits - (this.bitPointer + 1));
				this.blockPointer++;
				
				var bitsSecondBlock = this.blocks[this.blockPointer] << (numBits - (this.bitPointer + 1 + 8));
				this.blockPointer++;
				
				for (var i = 0; i < numBits - (this.bitPointer + 1 + 8); i++)
				{
					mask3 += (1 << i);
				}
				mask3 <<= 8 - (numBits - (this.bitPointer + 1 + 8));
				var bitsThirdBlock = (this.blocks[this.blockPointer] & mask3) >> (8 - (numBits - (this.bitPointer + 1 + 8)));
				
				bits = bitsFirstBlock + bitsSecondBlock + bitsThirdBlock;
				this.bitPointer = this.bitPointer - (numBits - 8) % 8;
				if (this.bitPointer < 0)
				{
					this.bitPointer = 8 + this.bitPointer;
				}
				return bits;
			}
			else
			{
				return 0;
			}
		}
	this.NextMode=function()
	{
		if ((this.blockPointer > this.blocks.length - this.numErrorCorrectionCode - 2))
			return 0;
		else
			return this.getNextBits(4);
	}
	this.getDataLength=function( modeIndicator)
		{
			var index = 0;
			while (true)
			{
				if ((modeIndicator >> index) == 1)
					break;
				index++;
			}
			
			return this.getNextBits(qrcode.sizeOfDataLengthInfo[this.dataLengthMode][index]);
		}
	this.getRomanAndFigureString=function( dataLength)
		{
			var length = dataLength;
			var intData = 0;
			var strData = "";
			var tableRomanAndFigure = new Array('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', ' ', '$', '%', '*', '+', '-', '.', '/', ':');
			do 
			{
				if (length > 1)
				{
					intData = this.getNextBits(11);
					var firstLetter = Math.floor(intData / 45);
					var secondLetter = intData % 45;
					strData += tableRomanAndFigure[firstLetter];
					strData += tableRomanAndFigure[secondLetter];
					length -= 2;
				}
				else if (length == 1)
				{
					intData = this.getNextBits(6);
					strData += tableRomanAndFigure[intData];
					length -= 1;
				}
			}
			while (length > 0);
			
			return strData;
		}
	this.getFigureString=function( dataLength)
		{
			var length = dataLength;
			var intData = 0;
			var strData = "";
			do 
			{
				if (length >= 3)
				{
					intData = this.getNextBits(10);
					if (intData < 100)
						strData += "0";
					if (intData < 10)
						strData += "0";
					length -= 3;
				}
				else if (length == 2)
				{
					intData = this.getNextBits(7);
					if (intData < 10)
						strData += "0";
					length -= 2;
				}
				else if (length == 1)
				{
					intData = this.getNextBits(4);
					length -= 1;
				}
				strData += intData;
			}
			while (length > 0);
			
			return strData;
		}
	this.get8bitByteArray=function( dataLength)
		{
			var length = dataLength;
			var intData = 0;
			var output = new Array();
			
			do 
			{
				intData = this.getNextBits(8);
				output.push( intData);
				length--;
			}
			while (length > 0);
			return output;
		}
    this.getKanjiString=function( dataLength)
		{
			var length = dataLength;
			var intData = 0;
			var unicodeString = "";
			do 
			{
				intData = getNextBits(13);
				var lowerByte = intData % 0xC0;
				var higherByte = intData / 0xC0;
				
				var tempWord = (higherByte << 8) + lowerByte;
				var shiftjisWord = 0;
				if (tempWord + 0x8140 <= 0x9FFC)
				{
					// between 8140 - 9FFC on Shift_JIS character set
					shiftjisWord = tempWord + 0x8140;
				}
				else
				{
					// between E040 - EBBF on Shift_JIS character set
					shiftjisWord = tempWord + 0xC140;
				}
				
				//var tempByte = new Array(0,0);
				//tempByte[0] = (sbyte) (shiftjisWord >> 8);
				//tempByte[1] = (sbyte) (shiftjisWord & 0xFF);
				//unicodeString += new String(SystemUtils.ToCharArray(SystemUtils.ToByteArray(tempByte)));
                unicodeString += String.fromCharCode(shiftjisWord);
				length--;
			}
			while (length > 0);
			
			
			return unicodeString;
		}

	this.__defineGetter__("DataByte", function()
	{
		var output = new Array();
		var MODE_NUMBER = 1;
	    var MODE_ROMAN_AND_NUMBER = 2;
	    var MODE_8BIT_BYTE = 4;
	    var MODE_KANJI = 8;
		do 
					{
						var mode = this.NextMode();
						//canvas.println("mode: " + mode);
						if (mode == 0)
						{
							if (output.length > 0)
								break;
							else
								throw "Empty data block";
						}
						//if (mode != 1 && mode != 2 && mode != 4 && mode != 8)
						//	break;
						//}
						if (mode != MODE_NUMBER && mode != MODE_ROMAN_AND_NUMBER && mode != MODE_8BIT_BYTE && mode != MODE_KANJI)
						{
							/*					canvas.println("Invalid mode: " + mode);
							mode = guessMode(mode);
							canvas.println("Guessed mode: " + mode); */
							throw "Invalid mode: " + mode + " in (block:" + this.blockPointer + " bit:" + this.bitPointer + ")";
						}
						dataLength = this.getDataLength(mode);
						if (dataLength < 1)
							throw "Invalid data length: " + dataLength;
						//canvas.println("length: " + dataLength);
						switch (mode)
						{
							
							case MODE_NUMBER: 
								//canvas.println("Mode: Figure");
								var temp_str = this.getFigureString(dataLength);
								var ta = new Array(temp_str.length);
								for(var j=0;j<temp_str.length;j++)
									ta[j]=temp_str.charCodeAt(j);
								output.push(ta);
								break;
							
							case MODE_ROMAN_AND_NUMBER: 
								//canvas.println("Mode: Roman&Figure");
								var temp_str = this.getRomanAndFigureString(dataLength);
								var ta = new Array(temp_str.length);
								for(var j=0;j<temp_str.length;j++)
									ta[j]=temp_str.charCodeAt(j);
								output.push(ta );
								//output.Write(SystemUtils.ToByteArray(temp_sbyteArray2), 0, temp_sbyteArray2.Length);
								break;
							
							case MODE_8BIT_BYTE: 
								//canvas.println("Mode: 8bit Byte");
								//sbyte[] temp_sbyteArray3;
								var temp_sbyteArray3 = this.get8bitByteArray(dataLength);
								output.push(temp_sbyteArray3);
								//output.Write(SystemUtils.ToByteArray(temp_sbyteArray3), 0, temp_sbyteArray3.Length);
								break;
							
							case MODE_KANJI: 
								//canvas.println("Mode: Kanji");
								//sbyte[] temp_sbyteArray4;
								//temp_sbyteArray4 = SystemUtils.ToSByteArray(SystemUtils.ToByteArray(getKanjiString(dataLength)));
								//output.Write(SystemUtils.ToByteArray(temp_sbyteArray4), 0, temp_sbyteArray4.Length);
                                var temp_str = this.getKanjiString(dataLength);
								output.push(temp_str);
								break;
							}
						//			
						//canvas.println("DataLength: " + dataLength);
						//Console.out.println(dataString);
					}
					while (true);
		return output;
	});
}

// Source: public/lib/moment/min/moment.min.js
//! moment.js
//! version : 2.10.6
//! authors : Tim Wood, Iskren Chernev, Moment.js contributors
//! license : MIT
//! momentjs.com
!function(a,b){"object"==typeof exports&&"undefined"!=typeof module?module.exports=b():"function"==typeof define&&define.amd?define(b):a.moment=b()}(this,function(){"use strict";function a(){return Hc.apply(null,arguments)}function b(a){Hc=a}function c(a){return"[object Array]"===Object.prototype.toString.call(a)}function d(a){return a instanceof Date||"[object Date]"===Object.prototype.toString.call(a)}function e(a,b){var c,d=[];for(c=0;c<a.length;++c)d.push(b(a[c],c));return d}function f(a,b){return Object.prototype.hasOwnProperty.call(a,b)}function g(a,b){for(var c in b)f(b,c)&&(a[c]=b[c]);return f(b,"toString")&&(a.toString=b.toString),f(b,"valueOf")&&(a.valueOf=b.valueOf),a}function h(a,b,c,d){return Ca(a,b,c,d,!0).utc()}function i(){return{empty:!1,unusedTokens:[],unusedInput:[],overflow:-2,charsLeftOver:0,nullInput:!1,invalidMonth:null,invalidFormat:!1,userInvalidated:!1,iso:!1}}function j(a){return null==a._pf&&(a._pf=i()),a._pf}function k(a){if(null==a._isValid){var b=j(a);a._isValid=!(isNaN(a._d.getTime())||!(b.overflow<0)||b.empty||b.invalidMonth||b.invalidWeekday||b.nullInput||b.invalidFormat||b.userInvalidated),a._strict&&(a._isValid=a._isValid&&0===b.charsLeftOver&&0===b.unusedTokens.length&&void 0===b.bigHour)}return a._isValid}function l(a){var b=h(NaN);return null!=a?g(j(b),a):j(b).userInvalidated=!0,b}function m(a,b){var c,d,e;if("undefined"!=typeof b._isAMomentObject&&(a._isAMomentObject=b._isAMomentObject),"undefined"!=typeof b._i&&(a._i=b._i),"undefined"!=typeof b._f&&(a._f=b._f),"undefined"!=typeof b._l&&(a._l=b._l),"undefined"!=typeof b._strict&&(a._strict=b._strict),"undefined"!=typeof b._tzm&&(a._tzm=b._tzm),"undefined"!=typeof b._isUTC&&(a._isUTC=b._isUTC),"undefined"!=typeof b._offset&&(a._offset=b._offset),"undefined"!=typeof b._pf&&(a._pf=j(b)),"undefined"!=typeof b._locale&&(a._locale=b._locale),Jc.length>0)for(c in Jc)d=Jc[c],e=b[d],"undefined"!=typeof e&&(a[d]=e);return a}function n(b){m(this,b),this._d=new Date(null!=b._d?b._d.getTime():NaN),Kc===!1&&(Kc=!0,a.updateOffset(this),Kc=!1)}function o(a){return a instanceof n||null!=a&&null!=a._isAMomentObject}function p(a){return 0>a?Math.ceil(a):Math.floor(a)}function q(a){var b=+a,c=0;return 0!==b&&isFinite(b)&&(c=p(b)),c}function r(a,b,c){var d,e=Math.min(a.length,b.length),f=Math.abs(a.length-b.length),g=0;for(d=0;e>d;d++)(c&&a[d]!==b[d]||!c&&q(a[d])!==q(b[d]))&&g++;return g+f}function s(){}function t(a){return a?a.toLowerCase().replace("_","-"):a}function u(a){for(var b,c,d,e,f=0;f<a.length;){for(e=t(a[f]).split("-"),b=e.length,c=t(a[f+1]),c=c?c.split("-"):null;b>0;){if(d=v(e.slice(0,b).join("-")))return d;if(c&&c.length>=b&&r(e,c,!0)>=b-1)break;b--}f++}return null}function v(a){var b=null;if(!Lc[a]&&"undefined"!=typeof module&&module&&module.exports)try{b=Ic._abbr,require("./locale/"+a),w(b)}catch(c){}return Lc[a]}function w(a,b){var c;return a&&(c="undefined"==typeof b?y(a):x(a,b),c&&(Ic=c)),Ic._abbr}function x(a,b){return null!==b?(b.abbr=a,Lc[a]=Lc[a]||new s,Lc[a].set(b),w(a),Lc[a]):(delete Lc[a],null)}function y(a){var b;if(a&&a._locale&&a._locale._abbr&&(a=a._locale._abbr),!a)return Ic;if(!c(a)){if(b=v(a))return b;a=[a]}return u(a)}function z(a,b){var c=a.toLowerCase();Mc[c]=Mc[c+"s"]=Mc[b]=a}function A(a){return"string"==typeof a?Mc[a]||Mc[a.toLowerCase()]:void 0}function B(a){var b,c,d={};for(c in a)f(a,c)&&(b=A(c),b&&(d[b]=a[c]));return d}function C(b,c){return function(d){return null!=d?(E(this,b,d),a.updateOffset(this,c),this):D(this,b)}}function D(a,b){return a._d["get"+(a._isUTC?"UTC":"")+b]()}function E(a,b,c){return a._d["set"+(a._isUTC?"UTC":"")+b](c)}function F(a,b){var c;if("object"==typeof a)for(c in a)this.set(c,a[c]);else if(a=A(a),"function"==typeof this[a])return this[a](b);return this}function G(a,b,c){var d=""+Math.abs(a),e=b-d.length,f=a>=0;return(f?c?"+":"":"-")+Math.pow(10,Math.max(0,e)).toString().substr(1)+d}function H(a,b,c,d){var e=d;"string"==typeof d&&(e=function(){return this[d]()}),a&&(Qc[a]=e),b&&(Qc[b[0]]=function(){return G(e.apply(this,arguments),b[1],b[2])}),c&&(Qc[c]=function(){return this.localeData().ordinal(e.apply(this,arguments),a)})}function I(a){return a.match(/\[[\s\S]/)?a.replace(/^\[|\]$/g,""):a.replace(/\\/g,"")}function J(a){var b,c,d=a.match(Nc);for(b=0,c=d.length;c>b;b++)Qc[d[b]]?d[b]=Qc[d[b]]:d[b]=I(d[b]);return function(e){var f="";for(b=0;c>b;b++)f+=d[b]instanceof Function?d[b].call(e,a):d[b];return f}}function K(a,b){return a.isValid()?(b=L(b,a.localeData()),Pc[b]=Pc[b]||J(b),Pc[b](a)):a.localeData().invalidDate()}function L(a,b){function c(a){return b.longDateFormat(a)||a}var d=5;for(Oc.lastIndex=0;d>=0&&Oc.test(a);)a=a.replace(Oc,c),Oc.lastIndex=0,d-=1;return a}function M(a){return"function"==typeof a&&"[object Function]"===Object.prototype.toString.call(a)}function N(a,b,c){dd[a]=M(b)?b:function(a){return a&&c?c:b}}function O(a,b){return f(dd,a)?dd[a](b._strict,b._locale):new RegExp(P(a))}function P(a){return a.replace("\\","").replace(/\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g,function(a,b,c,d,e){return b||c||d||e}).replace(/[-\/\\^$*+?.()|[\]{}]/g,"\\$&")}function Q(a,b){var c,d=b;for("string"==typeof a&&(a=[a]),"number"==typeof b&&(d=function(a,c){c[b]=q(a)}),c=0;c<a.length;c++)ed[a[c]]=d}function R(a,b){Q(a,function(a,c,d,e){d._w=d._w||{},b(a,d._w,d,e)})}function S(a,b,c){null!=b&&f(ed,a)&&ed[a](b,c._a,c,a)}function T(a,b){return new Date(Date.UTC(a,b+1,0)).getUTCDate()}function U(a){return this._months[a.month()]}function V(a){return this._monthsShort[a.month()]}function W(a,b,c){var d,e,f;for(this._monthsParse||(this._monthsParse=[],this._longMonthsParse=[],this._shortMonthsParse=[]),d=0;12>d;d++){if(e=h([2e3,d]),c&&!this._longMonthsParse[d]&&(this._longMonthsParse[d]=new RegExp("^"+this.months(e,"").replace(".","")+"$","i"),this._shortMonthsParse[d]=new RegExp("^"+this.monthsShort(e,"").replace(".","")+"$","i")),c||this._monthsParse[d]||(f="^"+this.months(e,"")+"|^"+this.monthsShort(e,""),this._monthsParse[d]=new RegExp(f.replace(".",""),"i")),c&&"MMMM"===b&&this._longMonthsParse[d].test(a))return d;if(c&&"MMM"===b&&this._shortMonthsParse[d].test(a))return d;if(!c&&this._monthsParse[d].test(a))return d}}function X(a,b){var c;return"string"==typeof b&&(b=a.localeData().monthsParse(b),"number"!=typeof b)?a:(c=Math.min(a.date(),T(a.year(),b)),a._d["set"+(a._isUTC?"UTC":"")+"Month"](b,c),a)}function Y(b){return null!=b?(X(this,b),a.updateOffset(this,!0),this):D(this,"Month")}function Z(){return T(this.year(),this.month())}function $(a){var b,c=a._a;return c&&-2===j(a).overflow&&(b=c[gd]<0||c[gd]>11?gd:c[hd]<1||c[hd]>T(c[fd],c[gd])?hd:c[id]<0||c[id]>24||24===c[id]&&(0!==c[jd]||0!==c[kd]||0!==c[ld])?id:c[jd]<0||c[jd]>59?jd:c[kd]<0||c[kd]>59?kd:c[ld]<0||c[ld]>999?ld:-1,j(a)._overflowDayOfYear&&(fd>b||b>hd)&&(b=hd),j(a).overflow=b),a}function _(b){a.suppressDeprecationWarnings===!1&&"undefined"!=typeof console&&console.warn&&console.warn("Deprecation warning: "+b)}function aa(a,b){var c=!0;return g(function(){return c&&(_(a+"\n"+(new Error).stack),c=!1),b.apply(this,arguments)},b)}function ba(a,b){od[a]||(_(b),od[a]=!0)}function ca(a){var b,c,d=a._i,e=pd.exec(d);if(e){for(j(a).iso=!0,b=0,c=qd.length;c>b;b++)if(qd[b][1].exec(d)){a._f=qd[b][0];break}for(b=0,c=rd.length;c>b;b++)if(rd[b][1].exec(d)){a._f+=(e[6]||" ")+rd[b][0];break}d.match(ad)&&(a._f+="Z"),va(a)}else a._isValid=!1}function da(b){var c=sd.exec(b._i);return null!==c?void(b._d=new Date(+c[1])):(ca(b),void(b._isValid===!1&&(delete b._isValid,a.createFromInputFallback(b))))}function ea(a,b,c,d,e,f,g){var h=new Date(a,b,c,d,e,f,g);return 1970>a&&h.setFullYear(a),h}function fa(a){var b=new Date(Date.UTC.apply(null,arguments));return 1970>a&&b.setUTCFullYear(a),b}function ga(a){return ha(a)?366:365}function ha(a){return a%4===0&&a%100!==0||a%400===0}function ia(){return ha(this.year())}function ja(a,b,c){var d,e=c-b,f=c-a.day();return f>e&&(f-=7),e-7>f&&(f+=7),d=Da(a).add(f,"d"),{week:Math.ceil(d.dayOfYear()/7),year:d.year()}}function ka(a){return ja(a,this._week.dow,this._week.doy).week}function la(){return this._week.dow}function ma(){return this._week.doy}function na(a){var b=this.localeData().week(this);return null==a?b:this.add(7*(a-b),"d")}function oa(a){var b=ja(this,1,4).week;return null==a?b:this.add(7*(a-b),"d")}function pa(a,b,c,d,e){var f,g=6+e-d,h=fa(a,0,1+g),i=h.getUTCDay();return e>i&&(i+=7),c=null!=c?1*c:e,f=1+g+7*(b-1)-i+c,{year:f>0?a:a-1,dayOfYear:f>0?f:ga(a-1)+f}}function qa(a){var b=Math.round((this.clone().startOf("day")-this.clone().startOf("year"))/864e5)+1;return null==a?b:this.add(a-b,"d")}function ra(a,b,c){return null!=a?a:null!=b?b:c}function sa(a){var b=new Date;return a._useUTC?[b.getUTCFullYear(),b.getUTCMonth(),b.getUTCDate()]:[b.getFullYear(),b.getMonth(),b.getDate()]}function ta(a){var b,c,d,e,f=[];if(!a._d){for(d=sa(a),a._w&&null==a._a[hd]&&null==a._a[gd]&&ua(a),a._dayOfYear&&(e=ra(a._a[fd],d[fd]),a._dayOfYear>ga(e)&&(j(a)._overflowDayOfYear=!0),c=fa(e,0,a._dayOfYear),a._a[gd]=c.getUTCMonth(),a._a[hd]=c.getUTCDate()),b=0;3>b&&null==a._a[b];++b)a._a[b]=f[b]=d[b];for(;7>b;b++)a._a[b]=f[b]=null==a._a[b]?2===b?1:0:a._a[b];24===a._a[id]&&0===a._a[jd]&&0===a._a[kd]&&0===a._a[ld]&&(a._nextDay=!0,a._a[id]=0),a._d=(a._useUTC?fa:ea).apply(null,f),null!=a._tzm&&a._d.setUTCMinutes(a._d.getUTCMinutes()-a._tzm),a._nextDay&&(a._a[id]=24)}}function ua(a){var b,c,d,e,f,g,h;b=a._w,null!=b.GG||null!=b.W||null!=b.E?(f=1,g=4,c=ra(b.GG,a._a[fd],ja(Da(),1,4).year),d=ra(b.W,1),e=ra(b.E,1)):(f=a._locale._week.dow,g=a._locale._week.doy,c=ra(b.gg,a._a[fd],ja(Da(),f,g).year),d=ra(b.w,1),null!=b.d?(e=b.d,f>e&&++d):e=null!=b.e?b.e+f:f),h=pa(c,d,e,g,f),a._a[fd]=h.year,a._dayOfYear=h.dayOfYear}function va(b){if(b._f===a.ISO_8601)return void ca(b);b._a=[],j(b).empty=!0;var c,d,e,f,g,h=""+b._i,i=h.length,k=0;for(e=L(b._f,b._locale).match(Nc)||[],c=0;c<e.length;c++)f=e[c],d=(h.match(O(f,b))||[])[0],d&&(g=h.substr(0,h.indexOf(d)),g.length>0&&j(b).unusedInput.push(g),h=h.slice(h.indexOf(d)+d.length),k+=d.length),Qc[f]?(d?j(b).empty=!1:j(b).unusedTokens.push(f),S(f,d,b)):b._strict&&!d&&j(b).unusedTokens.push(f);j(b).charsLeftOver=i-k,h.length>0&&j(b).unusedInput.push(h),j(b).bigHour===!0&&b._a[id]<=12&&b._a[id]>0&&(j(b).bigHour=void 0),b._a[id]=wa(b._locale,b._a[id],b._meridiem),ta(b),$(b)}function wa(a,b,c){var d;return null==c?b:null!=a.meridiemHour?a.meridiemHour(b,c):null!=a.isPM?(d=a.isPM(c),d&&12>b&&(b+=12),d||12!==b||(b=0),b):b}function xa(a){var b,c,d,e,f;if(0===a._f.length)return j(a).invalidFormat=!0,void(a._d=new Date(NaN));for(e=0;e<a._f.length;e++)f=0,b=m({},a),null!=a._useUTC&&(b._useUTC=a._useUTC),b._f=a._f[e],va(b),k(b)&&(f+=j(b).charsLeftOver,f+=10*j(b).unusedTokens.length,j(b).score=f,(null==d||d>f)&&(d=f,c=b));g(a,c||b)}function ya(a){if(!a._d){var b=B(a._i);a._a=[b.year,b.month,b.day||b.date,b.hour,b.minute,b.second,b.millisecond],ta(a)}}function za(a){var b=new n($(Aa(a)));return b._nextDay&&(b.add(1,"d"),b._nextDay=void 0),b}function Aa(a){var b=a._i,e=a._f;return a._locale=a._locale||y(a._l),null===b||void 0===e&&""===b?l({nullInput:!0}):("string"==typeof b&&(a._i=b=a._locale.preparse(b)),o(b)?new n($(b)):(c(e)?xa(a):e?va(a):d(b)?a._d=b:Ba(a),a))}function Ba(b){var f=b._i;void 0===f?b._d=new Date:d(f)?b._d=new Date(+f):"string"==typeof f?da(b):c(f)?(b._a=e(f.slice(0),function(a){return parseInt(a,10)}),ta(b)):"object"==typeof f?ya(b):"number"==typeof f?b._d=new Date(f):a.createFromInputFallback(b)}function Ca(a,b,c,d,e){var f={};return"boolean"==typeof c&&(d=c,c=void 0),f._isAMomentObject=!0,f._useUTC=f._isUTC=e,f._l=c,f._i=a,f._f=b,f._strict=d,za(f)}function Da(a,b,c,d){return Ca(a,b,c,d,!1)}function Ea(a,b){var d,e;if(1===b.length&&c(b[0])&&(b=b[0]),!b.length)return Da();for(d=b[0],e=1;e<b.length;++e)(!b[e].isValid()||b[e][a](d))&&(d=b[e]);return d}function Fa(){var a=[].slice.call(arguments,0);return Ea("isBefore",a)}function Ga(){var a=[].slice.call(arguments,0);return Ea("isAfter",a)}function Ha(a){var b=B(a),c=b.year||0,d=b.quarter||0,e=b.month||0,f=b.week||0,g=b.day||0,h=b.hour||0,i=b.minute||0,j=b.second||0,k=b.millisecond||0;this._milliseconds=+k+1e3*j+6e4*i+36e5*h,this._days=+g+7*f,this._months=+e+3*d+12*c,this._data={},this._locale=y(),this._bubble()}function Ia(a){return a instanceof Ha}function Ja(a,b){H(a,0,0,function(){var a=this.utcOffset(),c="+";return 0>a&&(a=-a,c="-"),c+G(~~(a/60),2)+b+G(~~a%60,2)})}function Ka(a){var b=(a||"").match(ad)||[],c=b[b.length-1]||[],d=(c+"").match(xd)||["-",0,0],e=+(60*d[1])+q(d[2]);return"+"===d[0]?e:-e}function La(b,c){var e,f;return c._isUTC?(e=c.clone(),f=(o(b)||d(b)?+b:+Da(b))-+e,e._d.setTime(+e._d+f),a.updateOffset(e,!1),e):Da(b).local()}function Ma(a){return 15*-Math.round(a._d.getTimezoneOffset()/15)}function Na(b,c){var d,e=this._offset||0;return null!=b?("string"==typeof b&&(b=Ka(b)),Math.abs(b)<16&&(b=60*b),!this._isUTC&&c&&(d=Ma(this)),this._offset=b,this._isUTC=!0,null!=d&&this.add(d,"m"),e!==b&&(!c||this._changeInProgress?bb(this,Ya(b-e,"m"),1,!1):this._changeInProgress||(this._changeInProgress=!0,a.updateOffset(this,!0),this._changeInProgress=null)),this):this._isUTC?e:Ma(this)}function Oa(a,b){return null!=a?("string"!=typeof a&&(a=-a),this.utcOffset(a,b),this):-this.utcOffset()}function Pa(a){return this.utcOffset(0,a)}function Qa(a){return this._isUTC&&(this.utcOffset(0,a),this._isUTC=!1,a&&this.subtract(Ma(this),"m")),this}function Ra(){return this._tzm?this.utcOffset(this._tzm):"string"==typeof this._i&&this.utcOffset(Ka(this._i)),this}function Sa(a){return a=a?Da(a).utcOffset():0,(this.utcOffset()-a)%60===0}function Ta(){return this.utcOffset()>this.clone().month(0).utcOffset()||this.utcOffset()>this.clone().month(5).utcOffset()}function Ua(){if("undefined"!=typeof this._isDSTShifted)return this._isDSTShifted;var a={};if(m(a,this),a=Aa(a),a._a){var b=a._isUTC?h(a._a):Da(a._a);this._isDSTShifted=this.isValid()&&r(a._a,b.toArray())>0}else this._isDSTShifted=!1;return this._isDSTShifted}function Va(){return!this._isUTC}function Wa(){return this._isUTC}function Xa(){return this._isUTC&&0===this._offset}function Ya(a,b){var c,d,e,g=a,h=null;return Ia(a)?g={ms:a._milliseconds,d:a._days,M:a._months}:"number"==typeof a?(g={},b?g[b]=a:g.milliseconds=a):(h=yd.exec(a))?(c="-"===h[1]?-1:1,g={y:0,d:q(h[hd])*c,h:q(h[id])*c,m:q(h[jd])*c,s:q(h[kd])*c,ms:q(h[ld])*c}):(h=zd.exec(a))?(c="-"===h[1]?-1:1,g={y:Za(h[2],c),M:Za(h[3],c),d:Za(h[4],c),h:Za(h[5],c),m:Za(h[6],c),s:Za(h[7],c),w:Za(h[8],c)}):null==g?g={}:"object"==typeof g&&("from"in g||"to"in g)&&(e=_a(Da(g.from),Da(g.to)),g={},g.ms=e.milliseconds,g.M=e.months),d=new Ha(g),Ia(a)&&f(a,"_locale")&&(d._locale=a._locale),d}function Za(a,b){var c=a&&parseFloat(a.replace(",","."));return(isNaN(c)?0:c)*b}function $a(a,b){var c={milliseconds:0,months:0};return c.months=b.month()-a.month()+12*(b.year()-a.year()),a.clone().add(c.months,"M").isAfter(b)&&--c.months,c.milliseconds=+b-+a.clone().add(c.months,"M"),c}function _a(a,b){var c;return b=La(b,a),a.isBefore(b)?c=$a(a,b):(c=$a(b,a),c.milliseconds=-c.milliseconds,c.months=-c.months),c}function ab(a,b){return function(c,d){var e,f;return null===d||isNaN(+d)||(ba(b,"moment()."+b+"(period, number) is deprecated. Please use moment()."+b+"(number, period)."),f=c,c=d,d=f),c="string"==typeof c?+c:c,e=Ya(c,d),bb(this,e,a),this}}function bb(b,c,d,e){var f=c._milliseconds,g=c._days,h=c._months;e=null==e?!0:e,f&&b._d.setTime(+b._d+f*d),g&&E(b,"Date",D(b,"Date")+g*d),h&&X(b,D(b,"Month")+h*d),e&&a.updateOffset(b,g||h)}function cb(a,b){var c=a||Da(),d=La(c,this).startOf("day"),e=this.diff(d,"days",!0),f=-6>e?"sameElse":-1>e?"lastWeek":0>e?"lastDay":1>e?"sameDay":2>e?"nextDay":7>e?"nextWeek":"sameElse";return this.format(b&&b[f]||this.localeData().calendar(f,this,Da(c)))}function db(){return new n(this)}function eb(a,b){var c;return b=A("undefined"!=typeof b?b:"millisecond"),"millisecond"===b?(a=o(a)?a:Da(a),+this>+a):(c=o(a)?+a:+Da(a),c<+this.clone().startOf(b))}function fb(a,b){var c;return b=A("undefined"!=typeof b?b:"millisecond"),"millisecond"===b?(a=o(a)?a:Da(a),+a>+this):(c=o(a)?+a:+Da(a),+this.clone().endOf(b)<c)}function gb(a,b,c){return this.isAfter(a,c)&&this.isBefore(b,c)}function hb(a,b){var c;return b=A(b||"millisecond"),"millisecond"===b?(a=o(a)?a:Da(a),+this===+a):(c=+Da(a),+this.clone().startOf(b)<=c&&c<=+this.clone().endOf(b))}function ib(a,b,c){var d,e,f=La(a,this),g=6e4*(f.utcOffset()-this.utcOffset());return b=A(b),"year"===b||"month"===b||"quarter"===b?(e=jb(this,f),"quarter"===b?e/=3:"year"===b&&(e/=12)):(d=this-f,e="second"===b?d/1e3:"minute"===b?d/6e4:"hour"===b?d/36e5:"day"===b?(d-g)/864e5:"week"===b?(d-g)/6048e5:d),c?e:p(e)}function jb(a,b){var c,d,e=12*(b.year()-a.year())+(b.month()-a.month()),f=a.clone().add(e,"months");return 0>b-f?(c=a.clone().add(e-1,"months"),d=(b-f)/(f-c)):(c=a.clone().add(e+1,"months"),d=(b-f)/(c-f)),-(e+d)}function kb(){return this.clone().locale("en").format("ddd MMM DD YYYY HH:mm:ss [GMT]ZZ")}function lb(){var a=this.clone().utc();return 0<a.year()&&a.year()<=9999?"function"==typeof Date.prototype.toISOString?this.toDate().toISOString():K(a,"YYYY-MM-DD[T]HH:mm:ss.SSS[Z]"):K(a,"YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]")}function mb(b){var c=K(this,b||a.defaultFormat);return this.localeData().postformat(c)}function nb(a,b){return this.isValid()?Ya({to:this,from:a}).locale(this.locale()).humanize(!b):this.localeData().invalidDate()}function ob(a){return this.from(Da(),a)}function pb(a,b){return this.isValid()?Ya({from:this,to:a}).locale(this.locale()).humanize(!b):this.localeData().invalidDate()}function qb(a){return this.to(Da(),a)}function rb(a){var b;return void 0===a?this._locale._abbr:(b=y(a),null!=b&&(this._locale=b),this)}function sb(){return this._locale}function tb(a){switch(a=A(a)){case"year":this.month(0);case"quarter":case"month":this.date(1);case"week":case"isoWeek":case"day":this.hours(0);case"hour":this.minutes(0);case"minute":this.seconds(0);case"second":this.milliseconds(0)}return"week"===a&&this.weekday(0),"isoWeek"===a&&this.isoWeekday(1),"quarter"===a&&this.month(3*Math.floor(this.month()/3)),this}function ub(a){return a=A(a),void 0===a||"millisecond"===a?this:this.startOf(a).add(1,"isoWeek"===a?"week":a).subtract(1,"ms")}function vb(){return+this._d-6e4*(this._offset||0)}function wb(){return Math.floor(+this/1e3)}function xb(){return this._offset?new Date(+this):this._d}function yb(){var a=this;return[a.year(),a.month(),a.date(),a.hour(),a.minute(),a.second(),a.millisecond()]}function zb(){var a=this;return{years:a.year(),months:a.month(),date:a.date(),hours:a.hours(),minutes:a.minutes(),seconds:a.seconds(),milliseconds:a.milliseconds()}}function Ab(){return k(this)}function Bb(){return g({},j(this))}function Cb(){return j(this).overflow}function Db(a,b){H(0,[a,a.length],0,b)}function Eb(a,b,c){return ja(Da([a,11,31+b-c]),b,c).week}function Fb(a){var b=ja(this,this.localeData()._week.dow,this.localeData()._week.doy).year;return null==a?b:this.add(a-b,"y")}function Gb(a){var b=ja(this,1,4).year;return null==a?b:this.add(a-b,"y")}function Hb(){return Eb(this.year(),1,4)}function Ib(){var a=this.localeData()._week;return Eb(this.year(),a.dow,a.doy)}function Jb(a){return null==a?Math.ceil((this.month()+1)/3):this.month(3*(a-1)+this.month()%3)}function Kb(a,b){return"string"!=typeof a?a:isNaN(a)?(a=b.weekdaysParse(a),"number"==typeof a?a:null):parseInt(a,10)}function Lb(a){return this._weekdays[a.day()]}function Mb(a){return this._weekdaysShort[a.day()]}function Nb(a){return this._weekdaysMin[a.day()]}function Ob(a){var b,c,d;for(this._weekdaysParse=this._weekdaysParse||[],b=0;7>b;b++)if(this._weekdaysParse[b]||(c=Da([2e3,1]).day(b),d="^"+this.weekdays(c,"")+"|^"+this.weekdaysShort(c,"")+"|^"+this.weekdaysMin(c,""),this._weekdaysParse[b]=new RegExp(d.replace(".",""),"i")),this._weekdaysParse[b].test(a))return b}function Pb(a){var b=this._isUTC?this._d.getUTCDay():this._d.getDay();return null!=a?(a=Kb(a,this.localeData()),this.add(a-b,"d")):b}function Qb(a){var b=(this.day()+7-this.localeData()._week.dow)%7;return null==a?b:this.add(a-b,"d")}function Rb(a){return null==a?this.day()||7:this.day(this.day()%7?a:a-7)}function Sb(a,b){H(a,0,0,function(){return this.localeData().meridiem(this.hours(),this.minutes(),b)})}function Tb(a,b){return b._meridiemParse}function Ub(a){return"p"===(a+"").toLowerCase().charAt(0)}function Vb(a,b,c){return a>11?c?"pm":"PM":c?"am":"AM"}function Wb(a,b){b[ld]=q(1e3*("0."+a))}function Xb(){return this._isUTC?"UTC":""}function Yb(){return this._isUTC?"Coordinated Universal Time":""}function Zb(a){return Da(1e3*a)}function $b(){return Da.apply(null,arguments).parseZone()}function _b(a,b,c){var d=this._calendar[a];return"function"==typeof d?d.call(b,c):d}function ac(a){var b=this._longDateFormat[a],c=this._longDateFormat[a.toUpperCase()];return b||!c?b:(this._longDateFormat[a]=c.replace(/MMMM|MM|DD|dddd/g,function(a){return a.slice(1)}),this._longDateFormat[a])}function bc(){return this._invalidDate}function cc(a){return this._ordinal.replace("%d",a)}function dc(a){return a}function ec(a,b,c,d){var e=this._relativeTime[c];return"function"==typeof e?e(a,b,c,d):e.replace(/%d/i,a)}function fc(a,b){var c=this._relativeTime[a>0?"future":"past"];return"function"==typeof c?c(b):c.replace(/%s/i,b)}function gc(a){var b,c;for(c in a)b=a[c],"function"==typeof b?this[c]=b:this["_"+c]=b;this._ordinalParseLenient=new RegExp(this._ordinalParse.source+"|"+/\d{1,2}/.source)}function hc(a,b,c,d){var e=y(),f=h().set(d,b);return e[c](f,a)}function ic(a,b,c,d,e){if("number"==typeof a&&(b=a,a=void 0),a=a||"",null!=b)return hc(a,b,c,e);var f,g=[];for(f=0;d>f;f++)g[f]=hc(a,f,c,e);return g}function jc(a,b){return ic(a,b,"months",12,"month")}function kc(a,b){return ic(a,b,"monthsShort",12,"month")}function lc(a,b){return ic(a,b,"weekdays",7,"day")}function mc(a,b){return ic(a,b,"weekdaysShort",7,"day")}function nc(a,b){return ic(a,b,"weekdaysMin",7,"day")}function oc(){var a=this._data;return this._milliseconds=Wd(this._milliseconds),this._days=Wd(this._days),this._months=Wd(this._months),a.milliseconds=Wd(a.milliseconds),a.seconds=Wd(a.seconds),a.minutes=Wd(a.minutes),a.hours=Wd(a.hours),a.months=Wd(a.months),a.years=Wd(a.years),this}function pc(a,b,c,d){var e=Ya(b,c);return a._milliseconds+=d*e._milliseconds,a._days+=d*e._days,a._months+=d*e._months,a._bubble()}function qc(a,b){return pc(this,a,b,1)}function rc(a,b){return pc(this,a,b,-1)}function sc(a){return 0>a?Math.floor(a):Math.ceil(a)}function tc(){var a,b,c,d,e,f=this._milliseconds,g=this._days,h=this._months,i=this._data;return f>=0&&g>=0&&h>=0||0>=f&&0>=g&&0>=h||(f+=864e5*sc(vc(h)+g),g=0,h=0),i.milliseconds=f%1e3,a=p(f/1e3),i.seconds=a%60,b=p(a/60),i.minutes=b%60,c=p(b/60),i.hours=c%24,g+=p(c/24),e=p(uc(g)),h+=e,g-=sc(vc(e)),d=p(h/12),h%=12,i.days=g,i.months=h,i.years=d,this}function uc(a){return 4800*a/146097}function vc(a){return 146097*a/4800}function wc(a){var b,c,d=this._milliseconds;if(a=A(a),"month"===a||"year"===a)return b=this._days+d/864e5,c=this._months+uc(b),"month"===a?c:c/12;switch(b=this._days+Math.round(vc(this._months)),a){case"week":return b/7+d/6048e5;case"day":return b+d/864e5;case"hour":return 24*b+d/36e5;case"minute":return 1440*b+d/6e4;case"second":return 86400*b+d/1e3;case"millisecond":return Math.floor(864e5*b)+d;default:throw new Error("Unknown unit "+a)}}function xc(){return this._milliseconds+864e5*this._days+this._months%12*2592e6+31536e6*q(this._months/12)}function yc(a){return function(){return this.as(a)}}function zc(a){return a=A(a),this[a+"s"]()}function Ac(a){return function(){return this._data[a]}}function Bc(){return p(this.days()/7)}function Cc(a,b,c,d,e){return e.relativeTime(b||1,!!c,a,d)}function Dc(a,b,c){var d=Ya(a).abs(),e=ke(d.as("s")),f=ke(d.as("m")),g=ke(d.as("h")),h=ke(d.as("d")),i=ke(d.as("M")),j=ke(d.as("y")),k=e<le.s&&["s",e]||1===f&&["m"]||f<le.m&&["mm",f]||1===g&&["h"]||g<le.h&&["hh",g]||1===h&&["d"]||h<le.d&&["dd",h]||1===i&&["M"]||i<le.M&&["MM",i]||1===j&&["y"]||["yy",j];return k[2]=b,k[3]=+a>0,k[4]=c,Cc.apply(null,k)}function Ec(a,b){return void 0===le[a]?!1:void 0===b?le[a]:(le[a]=b,!0)}function Fc(a){var b=this.localeData(),c=Dc(this,!a,b);return a&&(c=b.pastFuture(+this,c)),b.postformat(c)}function Gc(){var a,b,c,d=me(this._milliseconds)/1e3,e=me(this._days),f=me(this._months);a=p(d/60),b=p(a/60),d%=60,a%=60,c=p(f/12),f%=12;var g=c,h=f,i=e,j=b,k=a,l=d,m=this.asSeconds();return m?(0>m?"-":"")+"P"+(g?g+"Y":"")+(h?h+"M":"")+(i?i+"D":"")+(j||k||l?"T":"")+(j?j+"H":"")+(k?k+"M":"")+(l?l+"S":""):"P0D"}var Hc,Ic,Jc=a.momentProperties=[],Kc=!1,Lc={},Mc={},Nc=/(\[[^\[]*\])|(\\)?(Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Q|YYYYYY|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|mm?|ss?|S{1,9}|x|X|zz?|ZZ?|.)/g,Oc=/(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g,Pc={},Qc={},Rc=/\d/,Sc=/\d\d/,Tc=/\d{3}/,Uc=/\d{4}/,Vc=/[+-]?\d{6}/,Wc=/\d\d?/,Xc=/\d{1,3}/,Yc=/\d{1,4}/,Zc=/[+-]?\d{1,6}/,$c=/\d+/,_c=/[+-]?\d+/,ad=/Z|[+-]\d\d:?\d\d/gi,bd=/[+-]?\d+(\.\d{1,3})?/,cd=/[0-9]*['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+|[\u0600-\u06FF\/]+(\s*?[\u0600-\u06FF]+){1,2}/i,dd={},ed={},fd=0,gd=1,hd=2,id=3,jd=4,kd=5,ld=6;H("M",["MM",2],"Mo",function(){return this.month()+1}),H("MMM",0,0,function(a){return this.localeData().monthsShort(this,a)}),H("MMMM",0,0,function(a){return this.localeData().months(this,a)}),z("month","M"),N("M",Wc),N("MM",Wc,Sc),N("MMM",cd),N("MMMM",cd),Q(["M","MM"],function(a,b){b[gd]=q(a)-1}),Q(["MMM","MMMM"],function(a,b,c,d){var e=c._locale.monthsParse(a,d,c._strict);null!=e?b[gd]=e:j(c).invalidMonth=a});var md="January_February_March_April_May_June_July_August_September_October_November_December".split("_"),nd="Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec".split("_"),od={};a.suppressDeprecationWarnings=!1;var pd=/^\s*(?:[+-]\d{6}|\d{4})-(?:(\d\d-\d\d)|(W\d\d$)|(W\d\d-\d)|(\d\d\d))((T| )(\d\d(:\d\d(:\d\d(\.\d+)?)?)?)?([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/,qd=[["YYYYYY-MM-DD",/[+-]\d{6}-\d{2}-\d{2}/],["YYYY-MM-DD",/\d{4}-\d{2}-\d{2}/],["GGGG-[W]WW-E",/\d{4}-W\d{2}-\d/],["GGGG-[W]WW",/\d{4}-W\d{2}/],["YYYY-DDD",/\d{4}-\d{3}/]],rd=[["HH:mm:ss.SSSS",/(T| )\d\d:\d\d:\d\d\.\d+/],["HH:mm:ss",/(T| )\d\d:\d\d:\d\d/],["HH:mm",/(T| )\d\d:\d\d/],["HH",/(T| )\d\d/]],sd=/^\/?Date\((\-?\d+)/i;a.createFromInputFallback=aa("moment construction falls back to js Date. This is discouraged and will be removed in upcoming major release. Please refer to https://github.com/moment/moment/issues/1407 for more info.",function(a){a._d=new Date(a._i+(a._useUTC?" UTC":""))}),H(0,["YY",2],0,function(){return this.year()%100}),H(0,["YYYY",4],0,"year"),H(0,["YYYYY",5],0,"year"),H(0,["YYYYYY",6,!0],0,"year"),z("year","y"),N("Y",_c),N("YY",Wc,Sc),N("YYYY",Yc,Uc),N("YYYYY",Zc,Vc),N("YYYYYY",Zc,Vc),Q(["YYYYY","YYYYYY"],fd),Q("YYYY",function(b,c){c[fd]=2===b.length?a.parseTwoDigitYear(b):q(b)}),Q("YY",function(b,c){c[fd]=a.parseTwoDigitYear(b)}),a.parseTwoDigitYear=function(a){return q(a)+(q(a)>68?1900:2e3)};var td=C("FullYear",!1);H("w",["ww",2],"wo","week"),H("W",["WW",2],"Wo","isoWeek"),z("week","w"),z("isoWeek","W"),N("w",Wc),N("ww",Wc,Sc),N("W",Wc),N("WW",Wc,Sc),R(["w","ww","W","WW"],function(a,b,c,d){b[d.substr(0,1)]=q(a)});var ud={dow:0,doy:6};H("DDD",["DDDD",3],"DDDo","dayOfYear"),z("dayOfYear","DDD"),N("DDD",Xc),N("DDDD",Tc),Q(["DDD","DDDD"],function(a,b,c){c._dayOfYear=q(a)}),a.ISO_8601=function(){};var vd=aa("moment().min is deprecated, use moment.min instead. https://github.com/moment/moment/issues/1548",function(){var a=Da.apply(null,arguments);return this>a?this:a}),wd=aa("moment().max is deprecated, use moment.max instead. https://github.com/moment/moment/issues/1548",function(){var a=Da.apply(null,arguments);return a>this?this:a});Ja("Z",":"),Ja("ZZ",""),N("Z",ad),N("ZZ",ad),Q(["Z","ZZ"],function(a,b,c){c._useUTC=!0,c._tzm=Ka(a)});var xd=/([\+\-]|\d\d)/gi;a.updateOffset=function(){};var yd=/(\-)?(?:(\d*)\.)?(\d+)\:(\d+)(?:\:(\d+)\.?(\d{3})?)?/,zd=/^(-)?P(?:(?:([0-9,.]*)Y)?(?:([0-9,.]*)M)?(?:([0-9,.]*)D)?(?:T(?:([0-9,.]*)H)?(?:([0-9,.]*)M)?(?:([0-9,.]*)S)?)?|([0-9,.]*)W)$/;Ya.fn=Ha.prototype;var Ad=ab(1,"add"),Bd=ab(-1,"subtract");a.defaultFormat="YYYY-MM-DDTHH:mm:ssZ";var Cd=aa("moment().lang() is deprecated. Instead, use moment().localeData() to get the language configuration. Use moment().locale() to change languages.",function(a){return void 0===a?this.localeData():this.locale(a)});H(0,["gg",2],0,function(){return this.weekYear()%100}),H(0,["GG",2],0,function(){return this.isoWeekYear()%100}),Db("gggg","weekYear"),Db("ggggg","weekYear"),Db("GGGG","isoWeekYear"),Db("GGGGG","isoWeekYear"),z("weekYear","gg"),z("isoWeekYear","GG"),N("G",_c),N("g",_c),N("GG",Wc,Sc),N("gg",Wc,Sc),N("GGGG",Yc,Uc),N("gggg",Yc,Uc),N("GGGGG",Zc,Vc),N("ggggg",Zc,Vc),R(["gggg","ggggg","GGGG","GGGGG"],function(a,b,c,d){b[d.substr(0,2)]=q(a)}),R(["gg","GG"],function(b,c,d,e){c[e]=a.parseTwoDigitYear(b)}),H("Q",0,0,"quarter"),z("quarter","Q"),N("Q",Rc),Q("Q",function(a,b){b[gd]=3*(q(a)-1)}),H("D",["DD",2],"Do","date"),z("date","D"),N("D",Wc),N("DD",Wc,Sc),N("Do",function(a,b){return a?b._ordinalParse:b._ordinalParseLenient}),Q(["D","DD"],hd),Q("Do",function(a,b){b[hd]=q(a.match(Wc)[0],10)});var Dd=C("Date",!0);H("d",0,"do","day"),H("dd",0,0,function(a){return this.localeData().weekdaysMin(this,a)}),H("ddd",0,0,function(a){return this.localeData().weekdaysShort(this,a)}),H("dddd",0,0,function(a){return this.localeData().weekdays(this,a)}),H("e",0,0,"weekday"),H("E",0,0,"isoWeekday"),z("day","d"),z("weekday","e"),z("isoWeekday","E"),N("d",Wc),N("e",Wc),N("E",Wc),N("dd",cd),N("ddd",cd),N("dddd",cd),R(["dd","ddd","dddd"],function(a,b,c){var d=c._locale.weekdaysParse(a);null!=d?b.d=d:j(c).invalidWeekday=a}),R(["d","e","E"],function(a,b,c,d){b[d]=q(a)});var Ed="Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"),Fd="Sun_Mon_Tue_Wed_Thu_Fri_Sat".split("_"),Gd="Su_Mo_Tu_We_Th_Fr_Sa".split("_");H("H",["HH",2],0,"hour"),H("h",["hh",2],0,function(){return this.hours()%12||12}),Sb("a",!0),Sb("A",!1),z("hour","h"),N("a",Tb),N("A",Tb),N("H",Wc),N("h",Wc),N("HH",Wc,Sc),N("hh",Wc,Sc),Q(["H","HH"],id),Q(["a","A"],function(a,b,c){c._isPm=c._locale.isPM(a),c._meridiem=a}),Q(["h","hh"],function(a,b,c){b[id]=q(a),j(c).bigHour=!0});var Hd=/[ap]\.?m?\.?/i,Id=C("Hours",!0);H("m",["mm",2],0,"minute"),z("minute","m"),N("m",Wc),N("mm",Wc,Sc),Q(["m","mm"],jd);var Jd=C("Minutes",!1);H("s",["ss",2],0,"second"),z("second","s"),N("s",Wc),N("ss",Wc,Sc),Q(["s","ss"],kd);var Kd=C("Seconds",!1);H("S",0,0,function(){return~~(this.millisecond()/100)}),H(0,["SS",2],0,function(){return~~(this.millisecond()/10)}),H(0,["SSS",3],0,"millisecond"),H(0,["SSSS",4],0,function(){return 10*this.millisecond()}),H(0,["SSSSS",5],0,function(){return 100*this.millisecond()}),H(0,["SSSSSS",6],0,function(){return 1e3*this.millisecond()}),H(0,["SSSSSSS",7],0,function(){return 1e4*this.millisecond()}),H(0,["SSSSSSSS",8],0,function(){return 1e5*this.millisecond()}),H(0,["SSSSSSSSS",9],0,function(){return 1e6*this.millisecond()}),z("millisecond","ms"),N("S",Xc,Rc),N("SS",Xc,Sc),N("SSS",Xc,Tc);var Ld;for(Ld="SSSS";Ld.length<=9;Ld+="S")N(Ld,$c);for(Ld="S";Ld.length<=9;Ld+="S")Q(Ld,Wb);var Md=C("Milliseconds",!1);H("z",0,0,"zoneAbbr"),H("zz",0,0,"zoneName");var Nd=n.prototype;Nd.add=Ad,Nd.calendar=cb,Nd.clone=db,Nd.diff=ib,Nd.endOf=ub,Nd.format=mb,Nd.from=nb,Nd.fromNow=ob,Nd.to=pb,Nd.toNow=qb,Nd.get=F,Nd.invalidAt=Cb,Nd.isAfter=eb,Nd.isBefore=fb,Nd.isBetween=gb,Nd.isSame=hb,Nd.isValid=Ab,Nd.lang=Cd,Nd.locale=rb,Nd.localeData=sb,Nd.max=wd,Nd.min=vd,Nd.parsingFlags=Bb,Nd.set=F,Nd.startOf=tb,Nd.subtract=Bd,Nd.toArray=yb,Nd.toObject=zb,Nd.toDate=xb,Nd.toISOString=lb,Nd.toJSON=lb,Nd.toString=kb,Nd.unix=wb,Nd.valueOf=vb,Nd.year=td,Nd.isLeapYear=ia,Nd.weekYear=Fb,Nd.isoWeekYear=Gb,Nd.quarter=Nd.quarters=Jb,Nd.month=Y,Nd.daysInMonth=Z,Nd.week=Nd.weeks=na,Nd.isoWeek=Nd.isoWeeks=oa,Nd.weeksInYear=Ib,Nd.isoWeeksInYear=Hb,Nd.date=Dd,Nd.day=Nd.days=Pb,Nd.weekday=Qb,Nd.isoWeekday=Rb,Nd.dayOfYear=qa,Nd.hour=Nd.hours=Id,Nd.minute=Nd.minutes=Jd,Nd.second=Nd.seconds=Kd,
Nd.millisecond=Nd.milliseconds=Md,Nd.utcOffset=Na,Nd.utc=Pa,Nd.local=Qa,Nd.parseZone=Ra,Nd.hasAlignedHourOffset=Sa,Nd.isDST=Ta,Nd.isDSTShifted=Ua,Nd.isLocal=Va,Nd.isUtcOffset=Wa,Nd.isUtc=Xa,Nd.isUTC=Xa,Nd.zoneAbbr=Xb,Nd.zoneName=Yb,Nd.dates=aa("dates accessor is deprecated. Use date instead.",Dd),Nd.months=aa("months accessor is deprecated. Use month instead",Y),Nd.years=aa("years accessor is deprecated. Use year instead",td),Nd.zone=aa("moment().zone is deprecated, use moment().utcOffset instead. https://github.com/moment/moment/issues/1779",Oa);var Od=Nd,Pd={sameDay:"[Today at] LT",nextDay:"[Tomorrow at] LT",nextWeek:"dddd [at] LT",lastDay:"[Yesterday at] LT",lastWeek:"[Last] dddd [at] LT",sameElse:"L"},Qd={LTS:"h:mm:ss A",LT:"h:mm A",L:"MM/DD/YYYY",LL:"MMMM D, YYYY",LLL:"MMMM D, YYYY h:mm A",LLLL:"dddd, MMMM D, YYYY h:mm A"},Rd="Invalid date",Sd="%d",Td=/\d{1,2}/,Ud={future:"in %s",past:"%s ago",s:"a few seconds",m:"a minute",mm:"%d minutes",h:"an hour",hh:"%d hours",d:"a day",dd:"%d days",M:"a month",MM:"%d months",y:"a year",yy:"%d years"},Vd=s.prototype;Vd._calendar=Pd,Vd.calendar=_b,Vd._longDateFormat=Qd,Vd.longDateFormat=ac,Vd._invalidDate=Rd,Vd.invalidDate=bc,Vd._ordinal=Sd,Vd.ordinal=cc,Vd._ordinalParse=Td,Vd.preparse=dc,Vd.postformat=dc,Vd._relativeTime=Ud,Vd.relativeTime=ec,Vd.pastFuture=fc,Vd.set=gc,Vd.months=U,Vd._months=md,Vd.monthsShort=V,Vd._monthsShort=nd,Vd.monthsParse=W,Vd.week=ka,Vd._week=ud,Vd.firstDayOfYear=ma,Vd.firstDayOfWeek=la,Vd.weekdays=Lb,Vd._weekdays=Ed,Vd.weekdaysMin=Nb,Vd._weekdaysMin=Gd,Vd.weekdaysShort=Mb,Vd._weekdaysShort=Fd,Vd.weekdaysParse=Ob,Vd.isPM=Ub,Vd._meridiemParse=Hd,Vd.meridiem=Vb,w("en",{ordinalParse:/\d{1,2}(th|st|nd|rd)/,ordinal:function(a){var b=a%10,c=1===q(a%100/10)?"th":1===b?"st":2===b?"nd":3===b?"rd":"th";return a+c}}),a.lang=aa("moment.lang is deprecated. Use moment.locale instead.",w),a.langData=aa("moment.langData is deprecated. Use moment.localeData instead.",y);var Wd=Math.abs,Xd=yc("ms"),Yd=yc("s"),Zd=yc("m"),$d=yc("h"),_d=yc("d"),ae=yc("w"),be=yc("M"),ce=yc("y"),de=Ac("milliseconds"),ee=Ac("seconds"),fe=Ac("minutes"),ge=Ac("hours"),he=Ac("days"),ie=Ac("months"),je=Ac("years"),ke=Math.round,le={s:45,m:45,h:22,d:26,M:11},me=Math.abs,ne=Ha.prototype;ne.abs=oc,ne.add=qc,ne.subtract=rc,ne.as=wc,ne.asMilliseconds=Xd,ne.asSeconds=Yd,ne.asMinutes=Zd,ne.asHours=$d,ne.asDays=_d,ne.asWeeks=ae,ne.asMonths=be,ne.asYears=ce,ne.valueOf=xc,ne._bubble=tc,ne.get=zc,ne.milliseconds=de,ne.seconds=ee,ne.minutes=fe,ne.hours=ge,ne.days=he,ne.weeks=Bc,ne.months=ie,ne.years=je,ne.humanize=Fc,ne.toISOString=Gc,ne.toString=Gc,ne.toJSON=Gc,ne.locale=rb,ne.localeData=sb,ne.toIsoString=aa("toIsoString() is deprecated. Please use toISOString() instead (notice the capitals)",Gc),ne.lang=Cd,H("X",0,0,"unix"),H("x",0,0,"valueOf"),N("x",_c),N("X",bd),Q("X",function(a,b,c){c._d=new Date(1e3*parseFloat(a,10))}),Q("x",function(a,b,c){c._d=new Date(q(a))}),a.version="2.10.6",b(Da),a.fn=Od,a.min=Fa,a.max=Ga,a.utc=h,a.unix=Zb,a.months=jc,a.isDate=d,a.locale=w,a.invalid=l,a.duration=Ya,a.isMoment=o,a.weekdays=lc,a.parseZone=$b,a.localeData=y,a.isDuration=Ia,a.monthsShort=kc,a.weekdaysMin=nc,a.defineLocale=x,a.weekdaysShort=mc,a.normalizeUnits=A,a.relativeTimeThreshold=Ec;var oe=a;return oe});
// Source: public/lib/c3/c3.min.js
/* @license C3.js v0.7.1 | (c) C3 Team and other contributors | http://c3js.org/ */
!function(t,e){"object"==typeof exports&&"undefined"!=typeof module?module.exports=e():"function"==typeof define&&define.amd?define(e):(t=t||self).c3=e()}(this,function(){"use strict";function s(t){return(s="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t})(t)}function l(t){var e=this;e.d3=window.d3?window.d3:"undefined"!=typeof require?require("d3"):void 0,e.api=t,e.config=e.getDefaultConfig(),e.data={},e.cache={},e.axes={}}function n(t){this.internal=new l(this),this.internal.loadConfig(t),this.internal.beforeInit(t),this.internal.init(),this.internal.afterInit(t),function e(i,n,r){Object.keys(i).forEach(function(t){n[t]=i[t].bind(r),0<Object.keys(i[t]).length&&e(i[t],n[t],r)})}(n.prototype,this,this)}function i(t,e){var i=this;i.component=t,i.params=e||{},i.d3=t.d3,i.scale=i.d3.scaleLinear(),i.range,i.orient="bottom",i.innerTickSize=6,i.outerTickSize=this.params.withOuterTick?6:0,i.tickPadding=3,i.tickValues=null,i.tickFormat,i.tickArguments,i.tickOffset=0,i.tickCulling=!0,i.tickCentered,i.tickTextCharSize,i.tickTextRotate=i.params.tickTextRotate,i.tickLength,i.axis=i.generateAxis()}i.prototype.axisX=function(t,e,i){t.attr("transform",function(t){return"translate("+Math.ceil(e(t)+i)+", 0)"})},i.prototype.axisY=function(t,e){t.attr("transform",function(t){return"translate(0,"+Math.ceil(e(t))+")"})},i.prototype.scaleExtent=function(t){var e=t[0],i=t[t.length-1];return e<i?[e,i]:[i,e]},i.prototype.generateTicks=function(t){var e,i,n=[];if(t.ticks)return t.ticks.apply(t,this.tickArguments);for(i=t.domain(),e=Math.ceil(i[0]);e<i[1];e++)n.push(e);return 0<n.length&&0<n[0]&&n.unshift(n[0]-(n[1]-n[0])),n},i.prototype.copyScale=function(){var t,e=this.scale.copy();return this.params.isCategory&&(t=this.scale.domain(),e.domain([t[0],t[1]-1])),e},i.prototype.textFormatted=function(t){var e=this.tickFormat?this.tickFormat(t):t;return void 0!==e?e:""},i.prototype.updateRange=function(){var t=this;return t.range=t.scale.rangeExtent?t.scale.rangeExtent():t.scaleExtent(t.scale.range()),t.range},i.prototype.updateTickTextCharSize=function(t){var a=this;if(a.tickTextCharSize)return a.tickTextCharSize;var o={h:11.5,w:5.5};return t.select("text").text(function(t){return a.textFormatted(t)}).each(function(t){var e=this.getBoundingClientRect(),i=a.textFormatted(t),n=e.height,r=i?e.width/i.length:void 0;n&&r&&(o.h=n,o.w=r)}).text(""),a.tickTextCharSize=o},i.prototype.isVertical=function(){return"left"===this.orient||"right"===this.orient},i.prototype.tspanData=function(t,e,i){var n=this,r=n.params.tickMultiline?n.splitTickText(t,i):[].concat(n.textFormatted(t));return n.params.tickMultiline&&0<n.params.tickMultilineMax&&(r=n.ellipsify(r,n.params.tickMultilineMax)),r.map(function(t){return{index:e,splitted:t,length:r.length}})},i.prototype.splitTickText=function(t,e){var r,a,o,s=this,i=s.textFormatted(t),c=s.params.tickWidth;if("[object Array]"===Object.prototype.toString.call(i))return i;return(!c||c<=0)&&(c=s.isVertical()?95:s.params.isCategory?Math.ceil(e(1)-e(0))-12:110),function t(e,i){a=void 0;for(var n=1;n<i.length;n++)if(" "===i.charAt(n)&&(a=n),r=i.substr(0,n+1),o=s.tickTextCharSize.w*r.length,c<o)return t(e.concat(i.substr(0,a||n)),i.slice(a?a+1:n));return e.concat(i)}([],i+"")},i.prototype.ellipsify=function(t,e){if(t.length<=e)return t;for(var i=t.slice(0,e),n=3,r=e-1;0<=r;r--){var a=i[r].length;if(i[r]=i[r].substr(0,a-n).padEnd(a,"."),(n-=a)<=0)break}return i},i.prototype.updateTickLength=function(){this.tickLength=Math.max(this.innerTickSize,0)+this.tickPadding},i.prototype.lineY2=function(t){var e=this,i=e.scale(t)+(e.tickCentered?0:e.tickOffset);return e.range[0]<i&&i<e.range[1]?e.innerTickSize:0},i.prototype.textY=function(){var t=this.tickTextRotate;return t?11.5-t/15*2.5*(0<t?1:-1):this.tickLength},i.prototype.textTransform=function(){var t=this.tickTextRotate;return t?"rotate("+t+")":""},i.prototype.textTextAnchor=function(){var t=this.tickTextRotate;return t?0<t?"start":"end":"middle"},i.prototype.tspanDx=function(){var t=this.tickTextRotate;return t?8*Math.sin(Math.PI*(t/180)):0},i.prototype.tspanDy=function(t,e){var i=this.tickTextCharSize.h;return 0===e&&(i=this.isVertical()?-((t.length-1)*(this.tickTextCharSize.h/2)-3):".71em"),i},i.prototype.generateAxis=function(){var w=this,v=w.d3,b=w.params;function T(t,m){var S;return t.each(function(){var t,e,i,n=T.g=v.select(this),r=this.__chart__||w.scale,a=this.__chart__=w.copyScale(),o=w.tickValues?w.tickValues:w.generateTicks(a),s=n.selectAll(".tick").data(o,a),c=s.enter().insert("g",".domain").attr("class","tick").style("opacity",1e-6),d=s.exit().remove(),l=s.merge(c);b.isCategory?(w.tickOffset=Math.ceil((a(1)-a(0))/2),e=w.tickCentered?0:w.tickOffset,i=w.tickCentered?w.tickOffset:0):w.tickOffset=e=0,w.updateRange(),w.updateTickLength(),w.updateTickTextCharSize(n.select(".tick"));var u=l.select("line").merge(c.append("line")),h=l.select("text").merge(c.append("text")),g=l.selectAll("text").selectAll("tspan").data(function(t,e){return w.tspanData(t,e,a)}),p=g.enter().append("tspan").merge(g).text(function(t){return t.splitted});g.exit().remove();var f=n.selectAll(".domain").data([0]),_=f.enter().append("path").merge(f).attr("class","domain");switch(w.orient){case"bottom":t=w.axisX,u.attr("x1",e).attr("x2",e).attr("y2",function(t,e){return w.lineY2(t,e)}),h.attr("x",0).attr("y",function(t,e){return w.textY(t,e)}).attr("transform",function(t,e){return w.textTransform(t,e)}).style("text-anchor",function(t,e){return w.textTextAnchor(t,e)}),p.attr("x",0).attr("dy",function(t,e){return w.tspanDy(t,e)}).attr("dx",function(t,e){return w.tspanDx(t,e)}),_.attr("d","M"+w.range[0]+","+w.outerTickSize+"V0H"+w.range[1]+"V"+w.outerTickSize);break;case"top":t=w.axisX,u.attr("x1",e).attr("x2",e).attr("y2",function(t,e){return-1*w.lineY2(t,e)}),h.attr("x",0).attr("y",function(t,e){return-1*w.textY(t,e)-(b.isCategory?2:w.tickLength-2)}).attr("transform",function(t,e){return w.textTransform(t,e)}).style("text-anchor",function(t,e){return w.textTextAnchor(t,e)}),p.attr("x",0).attr("dy",function(t,e){return w.tspanDy(t,e)}).attr("dx",function(t,e){return w.tspanDx(t,e)}),_.attr("d","M"+w.range[0]+","+-w.outerTickSize+"V0H"+w.range[1]+"V"+-w.outerTickSize);break;case"left":t=w.axisY,u.attr("x2",-w.innerTickSize).attr("y1",i).attr("y2",i),h.attr("x",-w.tickLength).attr("y",w.tickOffset).style("text-anchor","end"),p.attr("x",-w.tickLength).attr("dy",function(t,e){return w.tspanDy(t,e)}),_.attr("d","M"+-w.outerTickSize+","+w.range[0]+"H0V"+w.range[1]+"H"+-w.outerTickSize);break;case"right":t=w.axisY,u.attr("x2",w.innerTickSize).attr("y1",i).attr("y2",i),h.attr("x",w.tickLength).attr("y",w.tickOffset).style("text-anchor","start"),p.attr("x",w.tickLength).attr("dy",function(t,e){return w.tspanDy(t,e)}),_.attr("d","M"+w.outerTickSize+","+w.range[0]+"H0V"+w.range[1]+"H"+w.outerTickSize)}if(a.rangeBand){var x=a,y=x.rangeBand()/2;r=a=function(t){return x(t)+y}}else r.rangeBand?r=a:d.call(t,a,w.tickOffset);c.call(t,r,w.tickOffset),S=(m?l.transition(m):l).style("opacity",1).call(t,a,w.tickOffset)}),S}return T.scale=function(t){return arguments.length?(w.scale=t,T):w.scale},T.orient=function(t){return arguments.length?(w.orient=t in{top:1,right:1,bottom:1,left:1}?t+"":"bottom",T):w.orient},T.tickFormat=function(t){return arguments.length?(w.tickFormat=t,T):w.tickFormat},T.tickCentered=function(t){return arguments.length?(w.tickCentered=t,T):w.tickCentered},T.tickOffset=function(){return w.tickOffset},T.tickInterval=function(){var t;return(t=b.isCategory?2*w.tickOffset:(T.g.select("path.domain").node().getTotalLength()-2*w.outerTickSize)/T.g.selectAll("line").size())===1/0?0:t},T.ticks=function(){return arguments.length?(w.tickArguments=arguments,T):w.tickArguments},T.tickCulling=function(t){return arguments.length?(w.tickCulling=t,T):w.tickCulling},T.tickValues=function(t){if("function"==typeof t)w.tickValues=function(){return t(w.scale.domain())};else{if(!arguments.length)return w.tickValues;w.tickValues=t}return T},T};var N={target:"c3-target",chart:"c3-chart",chartLine:"c3-chart-line",chartLines:"c3-chart-lines",chartBar:"c3-chart-bar",chartBars:"c3-chart-bars",chartText:"c3-chart-text",chartTexts:"c3-chart-texts",chartArc:"c3-chart-arc",chartArcs:"c3-chart-arcs",chartArcsTitle:"c3-chart-arcs-title",chartArcsBackground:"c3-chart-arcs-background",chartArcsGaugeUnit:"c3-chart-arcs-gauge-unit",chartArcsGaugeMax:"c3-chart-arcs-gauge-max",chartArcsGaugeMin:"c3-chart-arcs-gauge-min",selectedCircle:"c3-selected-circle",selectedCircles:"c3-selected-circles",eventRect:"c3-event-rect",eventRects:"c3-event-rects",eventRectsSingle:"c3-event-rects-single",eventRectsMultiple:"c3-event-rects-multiple",zoomRect:"c3-zoom-rect",brush:"c3-brush",dragZoom:"c3-drag-zoom",focused:"c3-focused",defocused:"c3-defocused",region:"c3-region",regions:"c3-regions",title:"c3-title",tooltipContainer:"c3-tooltip-container",tooltip:"c3-tooltip",tooltipName:"c3-tooltip-name",shape:"c3-shape",shapes:"c3-shapes",line:"c3-line",lines:"c3-lines",bar:"c3-bar",bars:"c3-bars",circle:"c3-circle",circles:"c3-circles",arc:"c3-arc",arcLabelLine:"c3-arc-label-line",arcs:"c3-arcs",area:"c3-area",areas:"c3-areas",empty:"c3-empty",text:"c3-text",texts:"c3-texts",gaugeValue:"c3-gauge-value",grid:"c3-grid",gridLines:"c3-grid-lines",xgrid:"c3-xgrid",xgrids:"c3-xgrids",xgridLine:"c3-xgrid-line",xgridLines:"c3-xgrid-lines",xgridFocus:"c3-xgrid-focus",ygrid:"c3-ygrid",ygrids:"c3-ygrids",ygridLine:"c3-ygrid-line",ygridLines:"c3-ygrid-lines",colorScale:"c3-colorscale",stanfordElements:"c3-stanford-elements",stanfordLine:"c3-stanford-line",stanfordLines:"c3-stanford-lines",stanfordRegion:"c3-stanford-region",stanfordRegions:"c3-stanford-regions",stanfordText:"c3-stanford-text",stanfordTexts:"c3-stanford-texts",axis:"c3-axis",axisX:"c3-axis-x",axisXLabel:"c3-axis-x-label",axisY:"c3-axis-y",axisYLabel:"c3-axis-y-label",axisY2:"c3-axis-y2",axisY2Label:"c3-axis-y2-label",legendBackground:"c3-legend-background",legendItem:"c3-legend-item",legendItemEvent:"c3-legend-item-event",legendItemTile:"c3-legend-item-tile",legendItemHidden:"c3-legend-item-hidden",legendItemFocused:"c3-legend-item-focused",dragarea:"c3-dragarea",EXPANDED:"_expanded_",SELECTED:"_selected_",INCLUDED:"_included_"},a=function(t){return Math.ceil(t)+.5},r=function(t){return 10*Math.ceil(t/10)},R=function(t){return t[1]-t[0]},Y=function(t,e,i){return k(t[e])?t[e]:i},y=function(t){var e=t.getBoundingClientRect(),i=[t.pathSegList.getItem(0),t.pathSegList.getItem(1)];return{x:i[0].x,y:Math.min(i[0].y,i[1].y),width:e.width,height:e.height}},o=function(t){return Array.isArray(t)},k=function(t){return void 0!==t},u=function(t){return null==t||c(t)&&0===t.length||"object"===s(t)&&0===Object.keys(t).length},h=function(t){return"function"==typeof t},c=function(t){return"string"==typeof t},v=function(t){return void 0===t},P=function(t){return t||0===t},C=function(t){return!u(t)},_=function(t){return"string"==typeof t?t.replace(/</g,"&lt;").replace(/>/g,"&gt;"):t},d=function t(e){!function(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}(this,t),this.owner=e,this.d3=e.d3,this.internal=i};d.prototype.init=function(){var t=this.owner,e=t.config,i=t.main;t.axes.x=i.append("g").attr("class",N.axis+" "+N.axisX).attr("clip-path",e.axis_x_inner?"":t.clipPathForXAxis).attr("transform",t.getTranslate("x")).style("visibility",e.axis_x_show?"visible":"hidden"),t.axes.x.append("text").attr("class",N.axisXLabel).attr("transform",e.axis_rotated?"rotate(-90)":"").style("text-anchor",this.textAnchorForXAxisLabel.bind(this)),t.axes.y=i.append("g").attr("class",N.axis+" "+N.axisY).attr("clip-path",e.axis_y_inner?"":t.clipPathForYAxis).attr("transform",t.getTranslate("y")).style("visibility",e.axis_y_show?"visible":"hidden"),t.axes.y.append("text").attr("class",N.axisYLabel).attr("transform",e.axis_rotated?"":"rotate(-90)").style("text-anchor",this.textAnchorForYAxisLabel.bind(this)),t.axes.y2=i.append("g").attr("class",N.axis+" "+N.axisY2).attr("transform",t.getTranslate("y2")).style("visibility",e.axis_y2_show?"visible":"hidden"),t.axes.y2.append("text").attr("class",N.axisY2Label).attr("transform",e.axis_rotated?"":"rotate(-90)").style("text-anchor",this.textAnchorForY2AxisLabel.bind(this))},d.prototype.getXAxis=function(t,e,i,n,r,a,o){var s=this.owner,c=s.config,d={isCategory:s.isCategorized(),withOuterTick:r,tickMultiline:c.axis_x_tick_multiline,tickMultilineMax:c.axis_x_tick_multiline?Number(c.axis_x_tick_multilineMax):0,tickWidth:c.axis_x_tick_width,tickTextRotate:o?0:c.axis_x_tick_rotate,withoutTransition:a},l=new this.internal(this,d).axis.scale(t).orient(e);return s.isTimeSeries()&&n&&"function"!=typeof n&&(n=n.map(function(t){return s.parseDate(t)})),l.tickFormat(i).tickValues(n),s.isCategorized()&&(l.tickCentered(c.axis_x_tick_centered),u(c.axis_x_tick_culling)&&(c.axis_x_tick_culling=!1)),l},d.prototype.updateXAxisTickValues=function(t,e){var i,n=this.owner,r=n.config;return(r.axis_x_tick_fit||r.axis_x_tick_count)&&(i=this.generateTickValues(n.mapTargetsToUniqueXs(t),r.axis_x_tick_count,n.isTimeSeries())),e?e.tickValues(i):(n.xAxis.tickValues(i),n.subXAxis.tickValues(i)),i},d.prototype.getYAxis=function(t,e,i,n,r,a,o){var s=this.owner,c=s.config,d={withOuterTick:r,withoutTransition:a,tickTextRotate:o?0:c.axis_y_tick_rotate},l=new this.internal(this,d).axis.scale(t).orient(e).tickFormat(i);return s.isTimeSeriesY()?l.ticks(c.axis_y_tick_time_type,c.axis_y_tick_time_interval):l.tickValues(n),l},d.prototype.getId=function(t){var e=this.owner.config;return t in e.data_axes?e.data_axes[t]:"y"},d.prototype.getXAxisTickFormat=function(){var e=this.owner,i=e.config,n=e.isTimeSeries()?e.defaultAxisTimeFormat:e.isCategorized()?e.categoryName:function(t){return t};return i.axis_x_tick_format&&(h(i.axis_x_tick_format)?n=i.axis_x_tick_format:e.isTimeSeries()&&(n=function(t){return t?e.axisTimeFormat(i.axis_x_tick_format)(t):""})),h(n)?function(t){return n.call(e,t)}:n},d.prototype.getTickValues=function(t,e){return t||(e?e.tickValues():void 0)},d.prototype.getXAxisTickValues=function(){return this.getTickValues(this.owner.config.axis_x_tick_values,this.owner.xAxis)},d.prototype.getYAxisTickValues=function(){return this.getTickValues(this.owner.config.axis_y_tick_values,this.owner.yAxis)},d.prototype.getY2AxisTickValues=function(){return this.getTickValues(this.owner.config.axis_y2_tick_values,this.owner.y2Axis)},d.prototype.getLabelOptionByAxisId=function(t){var e,i=this.owner.config;return"y"===t?e=i.axis_y_label:"y2"===t?e=i.axis_y2_label:"x"===t&&(e=i.axis_x_label),e},d.prototype.getLabelText=function(t){var e=this.getLabelOptionByAxisId(t);return c(e)?e:e?e.text:null},d.prototype.setLabelText=function(t,e){var i=this.owner.config,n=this.getLabelOptionByAxisId(t);c(n)?"y"===t?i.axis_y_label=e:"y2"===t?i.axis_y2_label=e:"x"===t&&(i.axis_x_label=e):n&&(n.text=e)},d.prototype.getLabelPosition=function(t,e){var i=this.getLabelOptionByAxisId(t),n=i&&"object"===s(i)&&i.position?i.position:e;return{isInner:0<=n.indexOf("inner"),isOuter:0<=n.indexOf("outer"),isLeft:0<=n.indexOf("left"),isCenter:0<=n.indexOf("center"),isRight:0<=n.indexOf("right"),isTop:0<=n.indexOf("top"),isMiddle:0<=n.indexOf("middle"),isBottom:0<=n.indexOf("bottom")}},d.prototype.getXAxisLabelPosition=function(){return this.getLabelPosition("x",this.owner.config.axis_rotated?"inner-top":"inner-right")},d.prototype.getYAxisLabelPosition=function(){return this.getLabelPosition("y",this.owner.config.axis_rotated?"inner-right":"inner-top")},d.prototype.getY2AxisLabelPosition=function(){return this.getLabelPosition("y2",this.owner.config.axis_rotated?"inner-right":"inner-top")},d.prototype.getLabelPositionById=function(t){return"y2"===t?this.getY2AxisLabelPosition():"y"===t?this.getYAxisLabelPosition():this.getXAxisLabelPosition()},d.prototype.textForXAxisLabel=function(){return this.getLabelText("x")},d.prototype.textForYAxisLabel=function(){return this.getLabelText("y")},d.prototype.textForY2AxisLabel=function(){return this.getLabelText("y2")},d.prototype.xForAxisLabel=function(t,e){var i=this.owner;return t?e.isLeft?0:e.isCenter?i.width/2:i.width:e.isBottom?-i.height:e.isMiddle?-i.height/2:0},d.prototype.dxForAxisLabel=function(t,e){return t?e.isLeft?"0.5em":e.isRight?"-0.5em":"0":e.isTop?"-0.5em":e.isBottom?"0.5em":"0"},d.prototype.textAnchorForAxisLabel=function(t,e){return t?e.isLeft?"start":e.isCenter?"middle":"end":e.isBottom?"start":e.isMiddle?"middle":"end"},d.prototype.xForXAxisLabel=function(){return this.xForAxisLabel(!this.owner.config.axis_rotated,this.getXAxisLabelPosition())},d.prototype.xForYAxisLabel=function(){return this.xForAxisLabel(this.owner.config.axis_rotated,this.getYAxisLabelPosition())},d.prototype.xForY2AxisLabel=function(){return this.xForAxisLabel(this.owner.config.axis_rotated,this.getY2AxisLabelPosition())},d.prototype.dxForXAxisLabel=function(){return this.dxForAxisLabel(!this.owner.config.axis_rotated,this.getXAxisLabelPosition())},d.prototype.dxForYAxisLabel=function(){return this.dxForAxisLabel(this.owner.config.axis_rotated,this.getYAxisLabelPosition())},d.prototype.dxForY2AxisLabel=function(){return this.dxForAxisLabel(this.owner.config.axis_rotated,this.getY2AxisLabelPosition())},d.prototype.dyForXAxisLabel=function(){var t=this.owner,e=t.config,i=this.getXAxisLabelPosition();return e.axis_rotated?i.isInner?"1.2em":-25-(t.config.axis_x_inner?0:this.getMaxTickWidth("x")):i.isInner?"-0.5em":e.axis_x_height?e.axis_x_height-10:"3em"},d.prototype.dyForYAxisLabel=function(){var t=this.owner,e=this.getYAxisLabelPosition();return t.config.axis_rotated?e.isInner?"-0.5em":"3em":e.isInner?"1.2em":-10-(t.config.axis_y_inner?0:this.getMaxTickWidth("y")+10)},d.prototype.dyForY2AxisLabel=function(){var t=this.owner,e=this.getY2AxisLabelPosition();return t.config.axis_rotated?e.isInner?"1.2em":"-2.2em":e.isInner?"-0.5em":15+(t.config.axis_y2_inner?0:this.getMaxTickWidth("y2")+15)},d.prototype.textAnchorForXAxisLabel=function(){var t=this.owner;return this.textAnchorForAxisLabel(!t.config.axis_rotated,this.getXAxisLabelPosition())},d.prototype.textAnchorForYAxisLabel=function(){var t=this.owner;return this.textAnchorForAxisLabel(t.config.axis_rotated,this.getYAxisLabelPosition())},d.prototype.textAnchorForY2AxisLabel=function(){var t=this.owner;return this.textAnchorForAxisLabel(t.config.axis_rotated,this.getY2AxisLabelPosition())},d.prototype.getMaxTickWidth=function(t,e){var i,n,r,a,o=this.owner,s=o.config,c=0;return e&&o.currentMaxTickWidths[t]||(o.svg&&(i=o.filterTargetsToShow(o.data.targets),"y"===t?(n=o.y.copy().domain(o.getYDomain(i,"y")),r=this.getYAxis(n,o.yOrient,s.axis_y_tick_format,o.yAxisTickValues,!1,!0,!0)):"y2"===t?(n=o.y2.copy().domain(o.getYDomain(i,"y2")),r=this.getYAxis(n,o.y2Orient,s.axis_y2_tick_format,o.y2AxisTickValues,!1,!0,!0)):(n=o.x.copy().domain(o.getXDomain(i)),r=this.getXAxis(n,o.xOrient,o.xAxisTickFormat,o.xAxisTickValues,!1,!0,!0),this.updateXAxisTickValues(i,r)),(a=o.d3.select("body").append("div").classed("c3",!0)).append("svg").style("visibility","hidden").style("position","fixed").style("top",0).style("left",0).append("g").call(r).each(function(){o.d3.select(this).selectAll("text").each(function(){var t=this.getBoundingClientRect();c<t.width&&(c=t.width)}),a.remove()})),o.currentMaxTickWidths[t]=c<=0?o.currentMaxTickWidths[t]:c),o.currentMaxTickWidths[t]},d.prototype.updateLabels=function(t){var e=this.owner,i=e.main.select("."+N.axisX+" ."+N.axisXLabel),n=e.main.select("."+N.axisY+" ."+N.axisYLabel),r=e.main.select("."+N.axisY2+" ."+N.axisY2Label);(t?i.transition():i).attr("x",this.xForXAxisLabel.bind(this)).attr("dx",this.dxForXAxisLabel.bind(this)).attr("dy",this.dyForXAxisLabel.bind(this)).text(this.textForXAxisLabel.bind(this)),(t?n.transition():n).attr("x",this.xForYAxisLabel.bind(this)).attr("dx",this.dxForYAxisLabel.bind(this)).attr("dy",this.dyForYAxisLabel.bind(this)).text(this.textForYAxisLabel.bind(this)),(t?r.transition():r).attr("x",this.xForY2AxisLabel.bind(this)).attr("dx",this.dxForY2AxisLabel.bind(this)).attr("dy",this.dyForY2AxisLabel.bind(this)).text(this.textForY2AxisLabel.bind(this))},d.prototype.getPadding=function(t,e,i,n){var r="number"==typeof t?t:t[e];return P(r)?"ratio"===t.unit?t[e]*n:this.convertPixelsToAxisPadding(r,n):i},d.prototype.convertPixelsToAxisPadding=function(t,e){var i=this.owner;return e*(t/(i.config.axis_rotated?i.width:i.height))},d.prototype.generateTickValues=function(t,e,i){var n,r,a,o,s,c,d,l=t;if(e)if(1===(n=h(e)?e():e))l=[t[0]];else if(2===n)l=[t[0],t[t.length-1]];else if(2<n){for(o=n-2,r=t[0],s=((a=t[t.length-1])-r)/(1+o),l=[r],c=0;c<o;c++)d=+r+s*(c+1),l.push(i?new Date(d):d);l.push(a)}return i||(l=l.sort(function(t,e){return t-e})),l},d.prototype.generateTransitions=function(t){var e=this.owner.axes;return{axisX:t?e.x.transition().duration(t):e.x,axisY:t?e.y.transition().duration(t):e.y,axisY2:t?e.y2.transition().duration(t):e.y2,axisSubX:t?e.subx.transition().duration(t):e.subx}},d.prototype.redraw=function(t,e){var i=this.owner,n=t?i.d3.transition().duration(t):null;i.axes.x.style("opacity",e?0:1).call(i.xAxis,n),i.axes.y.style("opacity",e?0:1).call(i.yAxis,n),i.axes.y2.style("opacity",e?0:1).call(i.y2Axis,n),i.axes.subx.style("opacity",e?0:1).call(i.subXAxis,n)};var t={version:"0.7.1",chart:{fn:n.prototype,internal:{fn:l.prototype,axis:{fn:d.prototype,internal:{fn:i.prototype}}}},generate:function(t){return new n(t)}};function g(t){return t/Math.pow(10,Math.ceil(Math.log(t)/Math.LN10-1e-12))==1}l.prototype.beforeInit=function(){},l.prototype.afterInit=function(){},l.prototype.init=function(){var t=this,e=t.config;if(t.initParams(),e.data_url)t.convertUrlToData(e.data_url,e.data_mimeType,e.data_headers,e.data_keys,t.initWithData);else if(e.data_json)t.initWithData(t.convertJsonToData(e.data_json,e.data_keys));else if(e.data_rows)t.initWithData(t.convertRowsToData(e.data_rows));else{if(!e.data_columns)throw Error("url or json or rows or columns is required.");t.initWithData(t.convertColumnsToData(e.data_columns))}},l.prototype.initParams=function(){var t=this,e=t.d3,i=t.config;t.clipId="c3-"+ +new Date+"-clip",t.clipIdForXAxis=t.clipId+"-xaxis",t.clipIdForYAxis=t.clipId+"-yaxis",t.clipIdForGrid=t.clipId+"-grid",t.clipIdForSubchart=t.clipId+"-subchart",t.clipPath=t.getClipPath(t.clipId),t.clipPathForXAxis=t.getClipPath(t.clipIdForXAxis),t.clipPathForYAxis=t.getClipPath(t.clipIdForYAxis),t.clipPathForGrid=t.getClipPath(t.clipIdForGrid),t.clipPathForSubchart=t.getClipPath(t.clipIdForSubchart),t.dragStart=null,t.dragging=!1,t.flowing=!1,t.cancelClick=!1,t.mouseover=!1,t.transiting=!1,t.color=t.generateColor(),t.levelColor=t.generateLevelColor(),t.dataTimeParse=(i.data_xLocaltime?e.timeParse:e.utcParse)(t.config.data_xFormat),t.axisTimeFormat=i.axis_x_localtime?e.timeFormat:e.utcFormat,t.defaultAxisTimeFormat=function(t){return t.getMilliseconds()?e.timeFormat(".%L")(t):t.getSeconds()?e.timeFormat(":%S")(t):t.getMinutes()?e.timeFormat("%I:%M")(t):t.getHours()?e.timeFormat("%I %p")(t):t.getDay()&&1!==t.getDate()?e.timeFormat("%-m/%-d")(t):1!==t.getDate()?e.timeFormat("%-m/%-d")(t):t.getMonth()?e.timeFormat("%-m/%-d")(t):e.timeFormat("%Y/%-m/%-d")(t)},t.hiddenTargetIds=[],t.hiddenLegendIds=[],t.focusedTargetIds=[],t.defocusedTargetIds=[],t.xOrient=i.axis_rotated?i.axis_x_inner?"right":"left":i.axis_x_inner?"top":"bottom",t.yOrient=i.axis_rotated?i.axis_y_inner?"top":"bottom":i.axis_y_inner?"right":"left",t.y2Orient=i.axis_rotated?i.axis_y2_inner?"bottom":"top":i.axis_y2_inner?"left":"right",t.subXOrient=i.axis_rotated?"left":"bottom",t.isLegendRight="right"===i.legend_position,t.isLegendInset="inset"===i.legend_position,t.isLegendTop="top-left"===i.legend_inset_anchor||"top-right"===i.legend_inset_anchor,t.isLegendLeft="top-left"===i.legend_inset_anchor||"bottom-left"===i.legend_inset_anchor,t.legendStep=0,t.legendItemWidth=0,t.legendItemHeight=0,t.currentMaxTickWidths={x:0,y:0,y2:0},t.rotated_padding_left=30,t.rotated_padding_right=i.axis_rotated&&!i.axis_x_show?0:30,t.rotated_padding_top=5,t.withoutFadeIn={},t.intervalForObserveInserted=void 0,t.axes.subx=e.selectAll([])},l.prototype.initChartElements=function(){this.initBar&&this.initBar(),this.initLine&&this.initLine(),this.initArc&&this.initArc(),this.initGauge&&this.initGauge(),this.initText&&this.initText()},l.prototype.initWithData=function(t){var e,i,n=this,r=n.d3,a=n.config,o=!0;n.axis=new d(n),a.bindto?"function"==typeof a.bindto.node?n.selectChart=a.bindto:n.selectChart=r.select(a.bindto):n.selectChart=r.selectAll([]),n.selectChart.empty()&&(n.selectChart=r.select(document.createElement("div")).style("opacity",0),n.observeInserted(n.selectChart),o=!1),n.selectChart.html("").classed("c3",!0),n.data.xs={},n.data.targets=n.convertDataToTargets(t),a.data_filter&&(n.data.targets=n.data.targets.filter(a.data_filter)),a.data_hide&&n.addHiddenTargetIds(!0===a.data_hide?n.mapToIds(n.data.targets):a.data_hide),a.legend_hide&&n.addHiddenLegendIds(!0===a.legend_hide?n.mapToIds(n.data.targets):a.legend_hide),n.isStanfordGraphType()&&n.initStanfordData(),n.updateSizes(),n.updateScales(),n.x.domain(r.extent(n.getXDomain(n.data.targets))),n.y.domain(n.getYDomain(n.data.targets,"y")),n.y2.domain(n.getYDomain(n.data.targets,"y2")),n.subX.domain(n.x.domain()),n.subY.domain(n.y.domain()),n.subY2.domain(n.y2.domain()),n.orgXDomain=n.x.domain(),n.svg=n.selectChart.append("svg").style("overflow","hidden").on("mouseenter",function(){return a.onmouseover.call(n)}).on("mouseleave",function(){return a.onmouseout.call(n)}),n.config.svg_classname&&n.svg.attr("class",n.config.svg_classname),e=n.svg.append("defs"),n.clipChart=n.appendClip(e,n.clipId),n.clipXAxis=n.appendClip(e,n.clipIdForXAxis),n.clipYAxis=n.appendClip(e,n.clipIdForYAxis),n.clipGrid=n.appendClip(e,n.clipIdForGrid),n.clipSubchart=n.appendClip(e,n.clipIdForSubchart),n.updateSvgSize(),i=n.main=n.svg.append("g").attr("transform",n.getTranslate("main")),n.initPie&&n.initPie(),n.initDragZoom&&n.initDragZoom(),n.initSubchart&&n.initSubchart(),n.initTooltip&&n.initTooltip(),n.initLegend&&n.initLegend(),n.initTitle&&n.initTitle(),n.initZoom&&n.initZoom(),n.isStanfordGraphType()&&n.drawColorScale(),n.initSubchartBrush&&n.initSubchartBrush(),i.append("text").attr("class",N.text+" "+N.empty).attr("text-anchor","middle").attr("dominant-baseline","middle"),n.initRegion(),n.initGrid(),i.append("g").attr("clip-path",n.clipPath).attr("class",N.chart),a.grid_lines_front&&n.initGridLines(),n.initStanfordElements(),n.initEventRect(),n.initChartElements(),n.axis.init(),n.updateTargets(n.data.targets),a.axis_x_selection&&n.brush.selectionAsValue(n.getDefaultSelection()),o&&(n.updateDimension(),n.config.oninit.call(n),n.redraw({withTransition:!1,withTransform:!0,withUpdateXDomain:!0,withUpdateOrgXDomain:!0,withTransitionForAxis:!1})),n.bindResize(),n.bindWindowFocus(),n.api.element=n.selectChart.node()},l.prototype.smoothLines=function(t,e){var a=this;"grid"===e&&t.each(function(){var t=a.d3.select(this),e=t.attr("x1"),i=t.attr("x2"),n=t.attr("y1"),r=t.attr("y2");t.attr({x1:Math.ceil(e),x2:Math.ceil(i),y1:Math.ceil(n),y2:Math.ceil(r)})})},l.prototype.updateSizes=function(){var t=this,e=t.config,i=t.legend?t.getLegendHeight():0,n=t.legend?t.getLegendWidth():0,r=t.isLegendRight||t.isLegendInset?0:i,a=t.hasArcType(),o=e.axis_rotated||a?0:t.getHorizontalAxisHeight("x"),s=e.subchart_show&&!a?e.subchart_size_height+o:0;t.currentWidth=t.getCurrentWidth(),t.currentHeight=t.getCurrentHeight(),t.margin=e.axis_rotated?{top:t.getHorizontalAxisHeight("y2")+t.getCurrentPaddingTop(),right:a?0:t.getCurrentPaddingRight(),bottom:t.getHorizontalAxisHeight("y")+r+t.getCurrentPaddingBottom(),left:s+(a?0:t.getCurrentPaddingLeft())}:{top:4+t.getCurrentPaddingTop(),right:a?0:t.getCurrentPaddingRight(),bottom:o+s+r+t.getCurrentPaddingBottom(),left:a?0:t.getCurrentPaddingLeft()},t.margin2=e.axis_rotated?{top:t.margin.top,right:NaN,bottom:20+r,left:t.rotated_padding_left}:{top:t.currentHeight-s-r,right:NaN,bottom:o+r,left:t.margin.left},t.margin3={top:0,right:NaN,bottom:0,left:0},t.updateSizeForLegend&&t.updateSizeForLegend(i,n),t.width=t.currentWidth-t.margin.left-t.margin.right,t.height=t.currentHeight-t.margin.top-t.margin.bottom,t.width<0&&(t.width=0),t.height<0&&(t.height=0),t.width2=e.axis_rotated?t.margin.left-t.rotated_padding_left-t.rotated_padding_right:t.width,t.height2=e.axis_rotated?t.height:t.currentHeight-t.margin2.top-t.margin2.bottom,t.width2<0&&(t.width2=0),t.height2<0&&(t.height2=0),t.arcWidth=t.width-(t.isLegendRight?n+10:0),t.arcHeight=t.height-(t.isLegendRight?0:10),t.hasType("gauge")&&!e.gauge_fullCircle&&(t.arcHeight+=t.height-t.getGaugeLabelHeight()),t.updateRadius&&t.updateRadius(),t.isLegendRight&&a&&(t.margin3.left=t.arcWidth/2+1.1*t.radiusExpanded)},l.prototype.updateTargets=function(t){var e=this;e.updateTargetsForText(t),e.updateTargetsForBar(t),e.updateTargetsForLine(t),e.hasArcType()&&e.updateTargetsForArc&&e.updateTargetsForArc(t),e.updateTargetsForSubchart&&e.updateTargetsForSubchart(t),e.showTargets()},l.prototype.showTargets=function(){var e=this;e.svg.selectAll("."+N.target).filter(function(t){return e.isTargetToShow(t.id)}).transition().duration(e.config.transition_duration).style("opacity",1)},l.prototype.redraw=function(t,e){var i,n,r,a,o,s,c,d,l,u,h,g,p,f,_,x,y,m,S,w,v,b,T,A,P,C,L,V,G,E,O,I=this,R=I.main,k=I.d3,F=I.config,D=I.getShapeIndices(I.isAreaType),X=I.getShapeIndices(I.isBarType),M=I.getShapeIndices(I.isLineType),z=I.hasArcType(),H=I.filterTargetsToShow(I.data.targets),B=I.xv.bind(I);if(i=Y(t=t||{},"withY",!0),n=Y(t,"withSubchart",!0),r=Y(t,"withTransition",!0),s=Y(t,"withTransform",!1),c=Y(t,"withUpdateXDomain",!1),d=Y(t,"withUpdateOrgXDomain",!1),l=Y(t,"withTrimXDomain",!0),p=Y(t,"withUpdateXAxis",c),u=Y(t,"withLegend",!1),h=Y(t,"withEventRect",!0),g=Y(t,"withDimension",!0),a=Y(t,"withTransitionForExit",r),o=Y(t,"withTransitionForAxis",r),S=r?F.transition_duration:0,w=a?S:0,v=o?S:0,e=e||I.axis.generateTransitions(v),u&&F.legend_show?I.updateLegend(I.mapToIds(I.data.targets),t,e):g&&I.updateDimension(!0),I.isCategorized()&&0===H.length&&I.x.domain([0,I.axes.x.selectAll(".tick").size()]),H.length?(I.updateXDomain(H,c,d,l),F.axis_x_tick_values||(C=I.axis.updateXAxisTickValues(H))):(I.xAxis.tickValues([]),I.subXAxis.tickValues([])),F.zoom_rescale&&!t.flow&&(G=I.x.orgDomain()),I.y.domain(I.getYDomain(H,"y",G)),I.y2.domain(I.getYDomain(H,"y2",G)),!F.axis_y_tick_values&&F.axis_y_tick_count&&I.yAxis.tickValues(I.axis.generateTickValues(I.y.domain(),F.axis_y_tick_count)),!F.axis_y2_tick_values&&F.axis_y2_tick_count&&I.y2Axis.tickValues(I.axis.generateTickValues(I.y2.domain(),F.axis_y2_tick_count)),I.axis.redraw(v,z),I.axis.updateLabels(r),(c||p)&&H.length)if(F.axis_x_tick_culling&&C){for(L=1;L<C.length;L++)if(C.length/L<F.axis_x_tick_culling_max){V=L;break}I.svg.selectAll("."+N.axisX+" .tick text").each(function(t){var e=C.indexOf(t);0<=e&&k.select(this).style("display",e%V?"none":"block")})}else I.svg.selectAll("."+N.axisX+" .tick text").style("display","block");f=I.generateDrawArea?I.generateDrawArea(D,!1):void 0,_=I.generateDrawBar?I.generateDrawBar(X):void 0,x=I.generateDrawLine?I.generateDrawLine(M,!1):void 0,y=I.generateXYForText(D,X,M,!0),m=I.generateXYForText(D,X,M,!1),I.updateCircleY(),E=(I.config.axis_rotated?I.circleY:I.circleX).bind(I),O=(I.config.axis_rotated?I.circleX:I.circleY).bind(I),i&&(I.subY.domain(I.getYDomain(H,"y")),I.subY2.domain(I.getYDomain(H,"y2"))),I.updateXgridFocus(),R.select("text."+N.text+"."+N.empty).attr("x",I.width/2).attr("y",I.height/2).text(F.data_empty_label_text).transition().style("opacity",H.length?0:1),h&&I.redrawEventRect(),I.updateGrid(S),I.updateStanfordElements(S),I.updateRegion(S),I.updateBar(w),I.updateLine(w),I.updateArea(w),I.updateCircle(E,O),I.hasDataLabel()&&I.updateText(y,m,w),I.redrawTitle&&I.redrawTitle(),I.redrawArc&&I.redrawArc(S,w,s),I.redrawSubchart&&I.redrawSubchart(n,e,S,w,D,X,M),I.isStanfordGraphType()&&I.drawColorScale(),R.selectAll("."+N.selectedCircles).filter(I.isBarType.bind(I)).selectAll("circle").remove(),t.flow&&(A=I.generateFlow({targets:H,flow:t.flow,duration:t.flow.duration,drawBar:_,drawLine:x,drawArea:f,cx:E,cy:O,xv:B,xForText:y,yForText:m})),I.isTabVisible()&&(S?(P=k.transition().duration(S),b=[],[I.redrawBar(_,!0,P),I.redrawLine(x,!0,P),I.redrawArea(f,!0,P),I.redrawCircle(E,O,!0,P),I.redrawText(y,m,t.flow,!0,P),I.redrawRegion(!0,P),I.redrawGrid(!0,P)].forEach(function(t){t.forEach(function(t){b.push(t)})}),T=I.generateWait(),b.forEach(function(t){T.add(t)}),T(function(){A&&A(),F.onrendered&&F.onrendered.call(I)})):(I.redrawBar(_),I.redrawLine(x),I.redrawArea(f),I.redrawCircle(E,O),I.redrawText(y,m,t.flow),I.redrawRegion(),I.redrawGrid(),A&&A(),F.onrendered&&F.onrendered.call(I))),I.mapToIds(I.data.targets).forEach(function(t){I.withoutFadeIn[t]=!0})},l.prototype.updateAndRedraw=function(t){var e,i=this,n=i.config;(t=t||{}).withTransition=Y(t,"withTransition",!0),t.withTransform=Y(t,"withTransform",!1),t.withLegend=Y(t,"withLegend",!1),t.withUpdateXDomain=Y(t,"withUpdateXDomain",!0),t.withUpdateOrgXDomain=Y(t,"withUpdateOrgXDomain",!0),t.withTransitionForExit=!1,t.withTransitionForTransform=Y(t,"withTransitionForTransform",t.withTransition),i.updateSizes(),t.withLegend&&n.legend_show||(e=i.axis.generateTransitions(t.withTransitionForAxis?n.transition_duration:0),i.updateScales(),i.updateSvgSize(),i.transformAll(t.withTransitionForTransform,e)),i.redraw(t,e)},l.prototype.redrawWithoutRescale=function(){this.redraw({withY:!1,withSubchart:!1,withEventRect:!1,withTransitionForAxis:!1})},l.prototype.isTimeSeries=function(){return"timeseries"===this.config.axis_x_type},l.prototype.isCategorized=function(){return 0<=this.config.axis_x_type.indexOf("categor")},l.prototype.isCustomX=function(){var t=this.config;return!this.isTimeSeries()&&(t.data_x||C(t.data_xs))},l.prototype.isTimeSeriesY=function(){return"timeseries"===this.config.axis_y_type},l.prototype.getTranslate=function(t){var e,i,n=this,r=n.config;return"main"===t?(e=a(n.margin.left),i=a(n.margin.top)):"context"===t?(e=a(n.margin2.left),i=a(n.margin2.top)):"legend"===t?(e=n.margin3.left,i=n.margin3.top):"x"===t?(e=0,i=r.axis_rotated?0:n.height):"y"===t?(e=0,i=r.axis_rotated?n.height:0):"y2"===t?(e=r.axis_rotated?0:n.width,i=r.axis_rotated?1:0):"subx"===t?(e=0,i=r.axis_rotated?0:n.height2):"arc"===t&&(e=n.arcWidth/2,i=n.arcHeight/2-(n.hasType("gauge")?6:0)),"translate("+e+","+i+")"},l.prototype.initialOpacity=function(t){return null!==t.value&&this.withoutFadeIn[t.id]?1:0},l.prototype.initialOpacityForCircle=function(t){return null!==t.value&&this.withoutFadeIn[t.id]?this.opacityForCircle(t):0},l.prototype.opacityForCircle=function(t){var e=(h(this.config.point_show)?this.config.point_show(t):this.config.point_show)||this.isStanfordType(t)?1:0;return P(t.value)?this.isScatterType(t)?.5:e:0},l.prototype.opacityForText=function(){return this.hasDataLabel()?1:0},l.prototype.xx=function(t){return t?this.x(t.x):null},l.prototype.xvCustom=function(t,e){var i=this,n=e?t[e]:t.value;return i.isTimeSeries()?n=i.parseDate(t.value):i.isCategorized()&&"string"==typeof t.value&&(n=i.config.axis_x_categories.indexOf(t.value)),Math.ceil(i.x(n))},l.prototype.yvCustom=function(t,e){var i=t.axis&&"y2"===t.axis?this.y2:this.y,n=e?t[e]:t.value;return Math.ceil(i(n))},l.prototype.xv=function(t){var e=this,i=t.value;return e.isTimeSeries()?i=e.parseDate(t.value):e.isCategorized()&&"string"==typeof t.value&&(i=e.config.axis_x_categories.indexOf(t.value)),Math.ceil(e.x(i))},l.prototype.yv=function(t){var e=t.axis&&"y2"===t.axis?this.y2:this.y;return Math.ceil(e(t.value))},l.prototype.subxx=function(t){return t?this.subX(t.x):null},l.prototype.transformMain=function(t,e){var i,n,r,a=this;e&&e.axisX?i=e.axisX:(i=a.main.select("."+N.axisX),t&&(i=i.transition())),e&&e.axisY?n=e.axisY:(n=a.main.select("."+N.axisY),t&&(n=n.transition())),e&&e.axisY2?r=e.axisY2:(r=a.main.select("."+N.axisY2),t&&(r=r.transition())),(t?a.main.transition():a.main).attr("transform",a.getTranslate("main")),i.attr("transform",a.getTranslate("x")),n.attr("transform",a.getTranslate("y")),r.attr("transform",a.getTranslate("y2")),a.main.select("."+N.chartArcs).attr("transform",a.getTranslate("arc"))},l.prototype.transformAll=function(t,e){var i=this;i.transformMain(t,e),i.config.subchart_show&&i.transformContext(t,e),i.legend&&i.transformLegend(t)},l.prototype.updateSvgSize=function(){var t=this,e=t.svg.select(".c3-brush .overlay");t.svg.attr("width",t.currentWidth).attr("height",t.currentHeight),t.svg.selectAll(["#"+t.clipId,"#"+t.clipIdForGrid]).select("rect").attr("width",t.width).attr("height",t.height),t.svg.select("#"+t.clipIdForXAxis).select("rect").attr("x",t.getXAxisClipX.bind(t)).attr("y",t.getXAxisClipY.bind(t)).attr("width",t.getXAxisClipWidth.bind(t)).attr("height",t.getXAxisClipHeight.bind(t)),t.svg.select("#"+t.clipIdForYAxis).select("rect").attr("x",t.getYAxisClipX.bind(t)).attr("y",t.getYAxisClipY.bind(t)).attr("width",t.getYAxisClipWidth.bind(t)).attr("height",t.getYAxisClipHeight.bind(t)),t.svg.select("#"+t.clipIdForSubchart).select("rect").attr("width",t.width).attr("height",e.size()?e.attr("height"):0),t.selectChart.style("max-height",t.currentHeight+"px")},l.prototype.updateDimension=function(t){var e=this;t||(e.config.axis_rotated?(e.axes.x.call(e.xAxis),e.axes.subx.call(e.subXAxis)):(e.axes.y.call(e.yAxis),e.axes.y2.call(e.y2Axis))),e.updateSizes(),e.updateScales(),e.updateSvgSize(),e.transformAll(!1)},l.prototype.observeInserted=function(e){var i,n=this;"undefined"!=typeof MutationObserver?(i=new MutationObserver(function(t){t.forEach(function(t){"childList"===t.type&&t.previousSibling&&(i.disconnect(),n.intervalForObserveInserted=window.setInterval(function(){e.node().parentNode&&(window.clearInterval(n.intervalForObserveInserted),n.updateDimension(),n.brush&&n.brush.update(),n.config.oninit.call(n),n.redraw({withTransform:!0,withUpdateXDomain:!0,withUpdateOrgXDomain:!0,withTransition:!1,withTransitionForTransform:!1,withLegend:!0}),e.transition().style("opacity",1))},10))})})).observe(e.node(),{attributes:!0,childList:!0,characterData:!0}):window.console.error("MutationObserver not defined.")},l.prototype.bindResize=function(){var t=this,e=t.config;if(t.resizeFunction=t.generateResize(),t.resizeFunction.add(function(){e.onresize.call(t)}),e.resize_auto&&t.resizeFunction.add(function(){void 0!==t.resizeTimeout&&window.clearTimeout(t.resizeTimeout),t.resizeTimeout=window.setTimeout(function(){delete t.resizeTimeout,t.updateAndRedraw({withUpdateXDomain:!1,withUpdateOrgXDomain:!1,withTransition:!1,withTransitionForTransform:!1,withLegend:!0}),t.brush&&t.brush.update()},100)}),t.resizeFunction.add(function(){e.onresized.call(t)}),t.resizeIfElementDisplayed=function(){null!=t.api&&t.api.element.offsetParent&&t.resizeFunction()},window.attachEvent)window.attachEvent("onresize",t.resizeIfElementDisplayed);else if(window.addEventListener)window.addEventListener("resize",t.resizeIfElementDisplayed,!1);else{var i=window.onresize;i?i.add&&i.remove||(i=t.generateResize()).add(window.onresize):i=t.generateResize(),i.add(t.resizeFunction),window.onresize=function(){t.api.element.offsetParent&&i()}}},l.prototype.bindWindowFocus=function(){var t=this;this.windowFocusHandler||(this.windowFocusHandler=function(){t.redraw()},window.addEventListener("focus",this.windowFocusHandler))},l.prototype.unbindWindowFocus=function(){window.removeEventListener("focus",this.windowFocusHandler),delete this.windowFocusHandler},l.prototype.generateResize=function(){var i=[];function t(){i.forEach(function(t){t()})}return t.add=function(t){i.push(t)},t.remove=function(t){for(var e=0;e<i.length;e++)if(i[e]===t){i.splice(e,1);break}},t},l.prototype.endall=function(t,e){var i=0;t.each(function(){++i}).on("end",function(){--i||e.apply(this,arguments)})},l.prototype.generateWait=function(){var n=this,r=[],t=function(t){var i=setInterval(function(){if(n.isTabVisible()){var e=0;r.forEach(function(t){if(t.empty())e+=1;else try{t.transition()}catch(t){e+=1}}),e===r.length&&(clearInterval(i),t&&t())}},50)};return t.add=function(t){r.push(t)},t},l.prototype.parseDate=function(t){var e;return t instanceof Date?e=t:"string"==typeof t?e=this.dataTimeParse(t):"object"===s(t)?e=new Date(+t):"number"!=typeof t||isNaN(t)||(e=new Date(+t)),e&&!isNaN(+e)||window.console.error("Failed to parse x '"+t+"' to Date object"),e},l.prototype.isTabVisible=function(){return!document.hidden},l.prototype.getPathBox=y,l.prototype.CLASS=N,"SVGPathSeg"in window||(window.SVGPathSeg=function(t,e,i){this.pathSegType=t,this.pathSegTypeAsLetter=e,this._owningPathSegList=i},window.SVGPathSeg.prototype.classname="SVGPathSeg",window.SVGPathSeg.PATHSEG_UNKNOWN=0,window.SVGPathSeg.PATHSEG_CLOSEPATH=1,window.SVGPathSeg.PATHSEG_MOVETO_ABS=2,window.SVGPathSeg.PATHSEG_MOVETO_REL=3,window.SVGPathSeg.PATHSEG_LINETO_ABS=4,window.SVGPathSeg.PATHSEG_LINETO_REL=5,window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_ABS=6,window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_REL=7,window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_ABS=8,window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_REL=9,window.SVGPathSeg.PATHSEG_ARC_ABS=10,window.SVGPathSeg.PATHSEG_ARC_REL=11,window.SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_ABS=12,window.SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_REL=13,window.SVGPathSeg.PATHSEG_LINETO_VERTICAL_ABS=14,window.SVGPathSeg.PATHSEG_LINETO_VERTICAL_REL=15,window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_ABS=16,window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_REL=17,window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_ABS=18,window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_REL=19,window.SVGPathSeg.prototype._segmentChanged=function(){this._owningPathSegList&&this._owningPathSegList.segmentChanged(this)},window.SVGPathSegClosePath=function(t){window.SVGPathSeg.call(this,window.SVGPathSeg.PATHSEG_CLOSEPATH,"z",t)},window.SVGPathSegClosePath.prototype=Object.create(window.SVGPathSeg.prototype),window.SVGPathSegClosePath.prototype.toString=function(){return"[object SVGPathSegClosePath]"},window.SVGPathSegClosePath.prototype._asPathString=function(){return this.pathSegTypeAsLetter},window.SVGPathSegClosePath.prototype.clone=function(){return new window.SVGPathSegClosePath(void 0)},window.SVGPathSegMovetoAbs=function(t,e,i){window.SVGPathSeg.call(this,window.SVGPathSeg.PATHSEG_MOVETO_ABS,"M",t),this._x=e,this._y=i},window.SVGPathSegMovetoAbs.prototype=Object.create(window.SVGPathSeg.prototype),window.SVGPathSegMovetoAbs.prototype.toString=function(){return"[object SVGPathSegMovetoAbs]"},window.SVGPathSegMovetoAbs.prototype._asPathString=function(){return this.pathSegTypeAsLetter+" "+this._x+" "+this._y},window.SVGPathSegMovetoAbs.prototype.clone=function(){return new window.SVGPathSegMovetoAbs(void 0,this._x,this._y)},Object.defineProperty(window.SVGPathSegMovetoAbs.prototype,"x",{get:function(){return this._x},set:function(t){this._x=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegMovetoAbs.prototype,"y",{get:function(){return this._y},set:function(t){this._y=t,this._segmentChanged()},enumerable:!0}),window.SVGPathSegMovetoRel=function(t,e,i){window.SVGPathSeg.call(this,window.SVGPathSeg.PATHSEG_MOVETO_REL,"m",t),this._x=e,this._y=i},window.SVGPathSegMovetoRel.prototype=Object.create(window.SVGPathSeg.prototype),window.SVGPathSegMovetoRel.prototype.toString=function(){return"[object SVGPathSegMovetoRel]"},window.SVGPathSegMovetoRel.prototype._asPathString=function(){return this.pathSegTypeAsLetter+" "+this._x+" "+this._y},window.SVGPathSegMovetoRel.prototype.clone=function(){return new window.SVGPathSegMovetoRel(void 0,this._x,this._y)},Object.defineProperty(window.SVGPathSegMovetoRel.prototype,"x",{get:function(){return this._x},set:function(t){this._x=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegMovetoRel.prototype,"y",{get:function(){return this._y},set:function(t){this._y=t,this._segmentChanged()},enumerable:!0}),window.SVGPathSegLinetoAbs=function(t,e,i){window.SVGPathSeg.call(this,window.SVGPathSeg.PATHSEG_LINETO_ABS,"L",t),this._x=e,this._y=i},window.SVGPathSegLinetoAbs.prototype=Object.create(window.SVGPathSeg.prototype),window.SVGPathSegLinetoAbs.prototype.toString=function(){return"[object SVGPathSegLinetoAbs]"},window.SVGPathSegLinetoAbs.prototype._asPathString=function(){return this.pathSegTypeAsLetter+" "+this._x+" "+this._y},window.SVGPathSegLinetoAbs.prototype.clone=function(){return new window.SVGPathSegLinetoAbs(void 0,this._x,this._y)},Object.defineProperty(window.SVGPathSegLinetoAbs.prototype,"x",{get:function(){return this._x},set:function(t){this._x=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegLinetoAbs.prototype,"y",{get:function(){return this._y},set:function(t){this._y=t,this._segmentChanged()},enumerable:!0}),window.SVGPathSegLinetoRel=function(t,e,i){window.SVGPathSeg.call(this,window.SVGPathSeg.PATHSEG_LINETO_REL,"l",t),this._x=e,this._y=i},window.SVGPathSegLinetoRel.prototype=Object.create(window.SVGPathSeg.prototype),window.SVGPathSegLinetoRel.prototype.toString=function(){return"[object SVGPathSegLinetoRel]"},window.SVGPathSegLinetoRel.prototype._asPathString=function(){return this.pathSegTypeAsLetter+" "+this._x+" "+this._y},window.SVGPathSegLinetoRel.prototype.clone=function(){return new window.SVGPathSegLinetoRel(void 0,this._x,this._y)},Object.defineProperty(window.SVGPathSegLinetoRel.prototype,"x",{get:function(){return this._x},set:function(t){this._x=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegLinetoRel.prototype,"y",{get:function(){return this._y},set:function(t){this._y=t,this._segmentChanged()},enumerable:!0}),window.SVGPathSegCurvetoCubicAbs=function(t,e,i,n,r,a,o){window.SVGPathSeg.call(this,window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_ABS,"C",t),this._x=e,this._y=i,this._x1=n,this._y1=r,this._x2=a,this._y2=o},window.SVGPathSegCurvetoCubicAbs.prototype=Object.create(window.SVGPathSeg.prototype),window.SVGPathSegCurvetoCubicAbs.prototype.toString=function(){return"[object SVGPathSegCurvetoCubicAbs]"},window.SVGPathSegCurvetoCubicAbs.prototype._asPathString=function(){return this.pathSegTypeAsLetter+" "+this._x1+" "+this._y1+" "+this._x2+" "+this._y2+" "+this._x+" "+this._y},window.SVGPathSegCurvetoCubicAbs.prototype.clone=function(){return new window.SVGPathSegCurvetoCubicAbs(void 0,this._x,this._y,this._x1,this._y1,this._x2,this._y2)},Object.defineProperty(window.SVGPathSegCurvetoCubicAbs.prototype,"x",{get:function(){return this._x},set:function(t){this._x=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegCurvetoCubicAbs.prototype,"y",{get:function(){return this._y},set:function(t){this._y=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegCurvetoCubicAbs.prototype,"x1",{get:function(){return this._x1},set:function(t){this._x1=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegCurvetoCubicAbs.prototype,"y1",{get:function(){return this._y1},set:function(t){this._y1=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegCurvetoCubicAbs.prototype,"x2",{get:function(){return this._x2},set:function(t){this._x2=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegCurvetoCubicAbs.prototype,"y2",{get:function(){return this._y2},set:function(t){this._y2=t,this._segmentChanged()},enumerable:!0}),window.SVGPathSegCurvetoCubicRel=function(t,e,i,n,r,a,o){window.SVGPathSeg.call(this,window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_REL,"c",t),this._x=e,this._y=i,this._x1=n,this._y1=r,this._x2=a,this._y2=o},window.SVGPathSegCurvetoCubicRel.prototype=Object.create(window.SVGPathSeg.prototype),window.SVGPathSegCurvetoCubicRel.prototype.toString=function(){return"[object SVGPathSegCurvetoCubicRel]"},window.SVGPathSegCurvetoCubicRel.prototype._asPathString=function(){return this.pathSegTypeAsLetter+" "+this._x1+" "+this._y1+" "+this._x2+" "+this._y2+" "+this._x+" "+this._y},window.SVGPathSegCurvetoCubicRel.prototype.clone=function(){return new window.SVGPathSegCurvetoCubicRel(void 0,this._x,this._y,this._x1,this._y1,this._x2,this._y2)},Object.defineProperty(window.SVGPathSegCurvetoCubicRel.prototype,"x",{get:function(){return this._x},set:function(t){this._x=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegCurvetoCubicRel.prototype,"y",{get:function(){return this._y},set:function(t){this._y=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegCurvetoCubicRel.prototype,"x1",{get:function(){return this._x1},set:function(t){this._x1=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegCurvetoCubicRel.prototype,"y1",{get:function(){return this._y1},set:function(t){this._y1=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegCurvetoCubicRel.prototype,"x2",{get:function(){return this._x2},set:function(t){this._x2=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegCurvetoCubicRel.prototype,"y2",{get:function(){return this._y2},set:function(t){this._y2=t,this._segmentChanged()},enumerable:!0}),window.SVGPathSegCurvetoQuadraticAbs=function(t,e,i,n,r){window.SVGPathSeg.call(this,window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_ABS,"Q",t),this._x=e,this._y=i,this._x1=n,this._y1=r},window.SVGPathSegCurvetoQuadraticAbs.prototype=Object.create(window.SVGPathSeg.prototype),window.SVGPathSegCurvetoQuadraticAbs.prototype.toString=function(){return"[object SVGPathSegCurvetoQuadraticAbs]"},window.SVGPathSegCurvetoQuadraticAbs.prototype._asPathString=function(){return this.pathSegTypeAsLetter+" "+this._x1+" "+this._y1+" "+this._x+" "+this._y},window.SVGPathSegCurvetoQuadraticAbs.prototype.clone=function(){return new window.SVGPathSegCurvetoQuadraticAbs(void 0,this._x,this._y,this._x1,this._y1)},Object.defineProperty(window.SVGPathSegCurvetoQuadraticAbs.prototype,"x",{get:function(){return this._x},set:function(t){this._x=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegCurvetoQuadraticAbs.prototype,"y",{get:function(){return this._y},set:function(t){this._y=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegCurvetoQuadraticAbs.prototype,"x1",{get:function(){return this._x1},set:function(t){this._x1=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegCurvetoQuadraticAbs.prototype,"y1",{get:function(){return this._y1},set:function(t){this._y1=t,this._segmentChanged()},enumerable:!0}),window.SVGPathSegCurvetoQuadraticRel=function(t,e,i,n,r){window.SVGPathSeg.call(this,window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_REL,"q",t),this._x=e,this._y=i,this._x1=n,this._y1=r},window.SVGPathSegCurvetoQuadraticRel.prototype=Object.create(window.SVGPathSeg.prototype),window.SVGPathSegCurvetoQuadraticRel.prototype.toString=function(){return"[object SVGPathSegCurvetoQuadraticRel]"},window.SVGPathSegCurvetoQuadraticRel.prototype._asPathString=function(){return this.pathSegTypeAsLetter+" "+this._x1+" "+this._y1+" "+this._x+" "+this._y},window.SVGPathSegCurvetoQuadraticRel.prototype.clone=function(){return new window.SVGPathSegCurvetoQuadraticRel(void 0,this._x,this._y,this._x1,this._y1)},Object.defineProperty(window.SVGPathSegCurvetoQuadraticRel.prototype,"x",{get:function(){return this._x},set:function(t){this._x=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegCurvetoQuadraticRel.prototype,"y",{get:function(){return this._y},set:function(t){this._y=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegCurvetoQuadraticRel.prototype,"x1",{get:function(){return this._x1},set:function(t){this._x1=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegCurvetoQuadraticRel.prototype,"y1",{get:function(){return this._y1},set:function(t){this._y1=t,this._segmentChanged()},enumerable:!0}),window.SVGPathSegArcAbs=function(t,e,i,n,r,a,o,s){window.SVGPathSeg.call(this,window.SVGPathSeg.PATHSEG_ARC_ABS,"A",t),this._x=e,this._y=i,this._r1=n,this._r2=r,this._angle=a,this._largeArcFlag=o,this._sweepFlag=s},window.SVGPathSegArcAbs.prototype=Object.create(window.SVGPathSeg.prototype),window.SVGPathSegArcAbs.prototype.toString=function(){return"[object SVGPathSegArcAbs]"},window.SVGPathSegArcAbs.prototype._asPathString=function(){return this.pathSegTypeAsLetter+" "+this._r1+" "+this._r2+" "+this._angle+" "+(this._largeArcFlag?"1":"0")+" "+(this._sweepFlag?"1":"0")+" "+this._x+" "+this._y},window.SVGPathSegArcAbs.prototype.clone=function(){return new window.SVGPathSegArcAbs(void 0,this._x,this._y,this._r1,this._r2,this._angle,this._largeArcFlag,this._sweepFlag)},Object.defineProperty(window.SVGPathSegArcAbs.prototype,"x",{get:function(){return this._x},set:function(t){this._x=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegArcAbs.prototype,"y",{get:function(){return this._y},set:function(t){this._y=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegArcAbs.prototype,"r1",{get:function(){return this._r1},set:function(t){this._r1=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegArcAbs.prototype,"r2",{get:function(){return this._r2},set:function(t){this._r2=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegArcAbs.prototype,"angle",{get:function(){return this._angle},set:function(t){this._angle=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegArcAbs.prototype,"largeArcFlag",{get:function(){return this._largeArcFlag},set:function(t){this._largeArcFlag=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegArcAbs.prototype,"sweepFlag",{get:function(){return this._sweepFlag},set:function(t){this._sweepFlag=t,this._segmentChanged()},enumerable:!0}),window.SVGPathSegArcRel=function(t,e,i,n,r,a,o,s){window.SVGPathSeg.call(this,window.SVGPathSeg.PATHSEG_ARC_REL,"a",t),this._x=e,this._y=i,this._r1=n,this._r2=r,this._angle=a,this._largeArcFlag=o,this._sweepFlag=s},window.SVGPathSegArcRel.prototype=Object.create(window.SVGPathSeg.prototype),window.SVGPathSegArcRel.prototype.toString=function(){return"[object SVGPathSegArcRel]"},window.SVGPathSegArcRel.prototype._asPathString=function(){return this.pathSegTypeAsLetter+" "+this._r1+" "+this._r2+" "+this._angle+" "+(this._largeArcFlag?"1":"0")+" "+(this._sweepFlag?"1":"0")+" "+this._x+" "+this._y},window.SVGPathSegArcRel.prototype.clone=function(){return new window.SVGPathSegArcRel(void 0,this._x,this._y,this._r1,this._r2,this._angle,this._largeArcFlag,this._sweepFlag)},Object.defineProperty(window.SVGPathSegArcRel.prototype,"x",{get:function(){return this._x},set:function(t){this._x=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegArcRel.prototype,"y",{get:function(){return this._y},set:function(t){this._y=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegArcRel.prototype,"r1",{get:function(){return this._r1},set:function(t){this._r1=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegArcRel.prototype,"r2",{get:function(){return this._r2},set:function(t){this._r2=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegArcRel.prototype,"angle",{get:function(){return this._angle},set:function(t){this._angle=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegArcRel.prototype,"largeArcFlag",{get:function(){return this._largeArcFlag},set:function(t){this._largeArcFlag=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegArcRel.prototype,"sweepFlag",{get:function(){return this._sweepFlag},set:function(t){this._sweepFlag=t,this._segmentChanged()},enumerable:!0}),window.SVGPathSegLinetoHorizontalAbs=function(t,e){window.SVGPathSeg.call(this,window.SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_ABS,"H",t),this._x=e},window.SVGPathSegLinetoHorizontalAbs.prototype=Object.create(window.SVGPathSeg.prototype),window.SVGPathSegLinetoHorizontalAbs.prototype.toString=function(){return"[object SVGPathSegLinetoHorizontalAbs]"},window.SVGPathSegLinetoHorizontalAbs.prototype._asPathString=function(){return this.pathSegTypeAsLetter+" "+this._x},window.SVGPathSegLinetoHorizontalAbs.prototype.clone=function(){return new window.SVGPathSegLinetoHorizontalAbs(void 0,this._x)},Object.defineProperty(window.SVGPathSegLinetoHorizontalAbs.prototype,"x",{get:function(){return this._x},set:function(t){this._x=t,this._segmentChanged()},enumerable:!0}),window.SVGPathSegLinetoHorizontalRel=function(t,e){window.SVGPathSeg.call(this,window.SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_REL,"h",t),this._x=e},window.SVGPathSegLinetoHorizontalRel.prototype=Object.create(window.SVGPathSeg.prototype),window.SVGPathSegLinetoHorizontalRel.prototype.toString=function(){return"[object SVGPathSegLinetoHorizontalRel]"},window.SVGPathSegLinetoHorizontalRel.prototype._asPathString=function(){return this.pathSegTypeAsLetter+" "+this._x},window.SVGPathSegLinetoHorizontalRel.prototype.clone=function(){return new window.SVGPathSegLinetoHorizontalRel(void 0,this._x)},Object.defineProperty(window.SVGPathSegLinetoHorizontalRel.prototype,"x",{get:function(){return this._x},set:function(t){this._x=t,this._segmentChanged()},enumerable:!0}),window.SVGPathSegLinetoVerticalAbs=function(t,e){window.SVGPathSeg.call(this,window.SVGPathSeg.PATHSEG_LINETO_VERTICAL_ABS,"V",t),this._y=e},window.SVGPathSegLinetoVerticalAbs.prototype=Object.create(window.SVGPathSeg.prototype),window.SVGPathSegLinetoVerticalAbs.prototype.toString=function(){return"[object SVGPathSegLinetoVerticalAbs]"},window.SVGPathSegLinetoVerticalAbs.prototype._asPathString=function(){return this.pathSegTypeAsLetter+" "+this._y},window.SVGPathSegLinetoVerticalAbs.prototype.clone=function(){return new window.SVGPathSegLinetoVerticalAbs(void 0,this._y)},Object.defineProperty(window.SVGPathSegLinetoVerticalAbs.prototype,"y",{get:function(){return this._y},set:function(t){this._y=t,this._segmentChanged()},enumerable:!0}),window.SVGPathSegLinetoVerticalRel=function(t,e){window.SVGPathSeg.call(this,window.SVGPathSeg.PATHSEG_LINETO_VERTICAL_REL,"v",t),this._y=e},window.SVGPathSegLinetoVerticalRel.prototype=Object.create(window.SVGPathSeg.prototype),window.SVGPathSegLinetoVerticalRel.prototype.toString=function(){return"[object SVGPathSegLinetoVerticalRel]"},window.SVGPathSegLinetoVerticalRel.prototype._asPathString=function(){return this.pathSegTypeAsLetter+" "+this._y},window.SVGPathSegLinetoVerticalRel.prototype.clone=function(){return new window.SVGPathSegLinetoVerticalRel(void 0,this._y)},Object.defineProperty(window.SVGPathSegLinetoVerticalRel.prototype,"y",{get:function(){return this._y},set:function(t){this._y=t,this._segmentChanged()},enumerable:!0}),window.SVGPathSegCurvetoCubicSmoothAbs=function(t,e,i,n,r){window.SVGPathSeg.call(this,window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_ABS,"S",t),this._x=e,this._y=i,this._x2=n,this._y2=r},window.SVGPathSegCurvetoCubicSmoothAbs.prototype=Object.create(window.SVGPathSeg.prototype),window.SVGPathSegCurvetoCubicSmoothAbs.prototype.toString=function(){return"[object SVGPathSegCurvetoCubicSmoothAbs]"},window.SVGPathSegCurvetoCubicSmoothAbs.prototype._asPathString=function(){return this.pathSegTypeAsLetter+" "+this._x2+" "+this._y2+" "+this._x+" "+this._y},window.SVGPathSegCurvetoCubicSmoothAbs.prototype.clone=function(){return new window.SVGPathSegCurvetoCubicSmoothAbs(void 0,this._x,this._y,this._x2,this._y2)},Object.defineProperty(window.SVGPathSegCurvetoCubicSmoothAbs.prototype,"x",{get:function(){return this._x},set:function(t){this._x=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegCurvetoCubicSmoothAbs.prototype,"y",{get:function(){return this._y},set:function(t){this._y=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegCurvetoCubicSmoothAbs.prototype,"x2",{get:function(){return this._x2},set:function(t){this._x2=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegCurvetoCubicSmoothAbs.prototype,"y2",{get:function(){return this._y2},set:function(t){this._y2=t,this._segmentChanged()},enumerable:!0}),window.SVGPathSegCurvetoCubicSmoothRel=function(t,e,i,n,r){window.SVGPathSeg.call(this,window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_REL,"s",t),this._x=e,this._y=i,this._x2=n,this._y2=r},window.SVGPathSegCurvetoCubicSmoothRel.prototype=Object.create(window.SVGPathSeg.prototype),window.SVGPathSegCurvetoCubicSmoothRel.prototype.toString=function(){return"[object SVGPathSegCurvetoCubicSmoothRel]"},window.SVGPathSegCurvetoCubicSmoothRel.prototype._asPathString=function(){return this.pathSegTypeAsLetter+" "+this._x2+" "+this._y2+" "+this._x+" "+this._y},window.SVGPathSegCurvetoCubicSmoothRel.prototype.clone=function(){return new window.SVGPathSegCurvetoCubicSmoothRel(void 0,this._x,this._y,this._x2,this._y2)},Object.defineProperty(window.SVGPathSegCurvetoCubicSmoothRel.prototype,"x",{get:function(){return this._x},set:function(t){this._x=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegCurvetoCubicSmoothRel.prototype,"y",{get:function(){return this._y},set:function(t){this._y=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegCurvetoCubicSmoothRel.prototype,"x2",{get:function(){return this._x2},set:function(t){this._x2=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegCurvetoCubicSmoothRel.prototype,"y2",{get:function(){return this._y2},set:function(t){this._y2=t,this._segmentChanged()},enumerable:!0}),window.SVGPathSegCurvetoQuadraticSmoothAbs=function(t,e,i){window.SVGPathSeg.call(this,window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_ABS,"T",t),this._x=e,this._y=i},window.SVGPathSegCurvetoQuadraticSmoothAbs.prototype=Object.create(window.SVGPathSeg.prototype),window.SVGPathSegCurvetoQuadraticSmoothAbs.prototype.toString=function(){return"[object SVGPathSegCurvetoQuadraticSmoothAbs]"},window.SVGPathSegCurvetoQuadraticSmoothAbs.prototype._asPathString=function(){return this.pathSegTypeAsLetter+" "+this._x+" "+this._y},window.SVGPathSegCurvetoQuadraticSmoothAbs.prototype.clone=function(){return new window.SVGPathSegCurvetoQuadraticSmoothAbs(void 0,this._x,this._y)},Object.defineProperty(window.SVGPathSegCurvetoQuadraticSmoothAbs.prototype,"x",{get:function(){return this._x},set:function(t){this._x=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegCurvetoQuadraticSmoothAbs.prototype,"y",{get:function(){return this._y},set:function(t){this._y=t,this._segmentChanged()},enumerable:!0}),window.SVGPathSegCurvetoQuadraticSmoothRel=function(t,e,i){window.SVGPathSeg.call(this,window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_REL,"t",t),this._x=e,this._y=i},window.SVGPathSegCurvetoQuadraticSmoothRel.prototype=Object.create(window.SVGPathSeg.prototype),window.SVGPathSegCurvetoQuadraticSmoothRel.prototype.toString=function(){return"[object SVGPathSegCurvetoQuadraticSmoothRel]"},window.SVGPathSegCurvetoQuadraticSmoothRel.prototype._asPathString=function(){return this.pathSegTypeAsLetter+" "+this._x+" "+this._y},window.SVGPathSegCurvetoQuadraticSmoothRel.prototype.clone=function(){return new window.SVGPathSegCurvetoQuadraticSmoothRel(void 0,this._x,this._y)},Object.defineProperty(window.SVGPathSegCurvetoQuadraticSmoothRel.prototype,"x",{get:function(){return this._x},set:function(t){this._x=t,this._segmentChanged()},enumerable:!0}),Object.defineProperty(window.SVGPathSegCurvetoQuadraticSmoothRel.prototype,"y",{get:function(){return this._y},set:function(t){this._y=t,this._segmentChanged()},enumerable:!0}),window.SVGPathElement.prototype.createSVGPathSegClosePath=function(){return new window.SVGPathSegClosePath(void 0)},window.SVGPathElement.prototype.createSVGPathSegMovetoAbs=function(t,e){return new window.SVGPathSegMovetoAbs(void 0,t,e)},window.SVGPathElement.prototype.createSVGPathSegMovetoRel=function(t,e){return new window.SVGPathSegMovetoRel(void 0,t,e)},window.SVGPathElement.prototype.createSVGPathSegLinetoAbs=function(t,e){return new window.SVGPathSegLinetoAbs(void 0,t,e)},window.SVGPathElement.prototype.createSVGPathSegLinetoRel=function(t,e){return new window.SVGPathSegLinetoRel(void 0,t,e)},window.SVGPathElement.prototype.createSVGPathSegCurvetoCubicAbs=function(t,e,i,n,r,a){return new window.SVGPathSegCurvetoCubicAbs(void 0,t,e,i,n,r,a)},window.SVGPathElement.prototype.createSVGPathSegCurvetoCubicRel=function(t,e,i,n,r,a){return new window.SVGPathSegCurvetoCubicRel(void 0,t,e,i,n,r,a)},window.SVGPathElement.prototype.createSVGPathSegCurvetoQuadraticAbs=function(t,e,i,n){return new window.SVGPathSegCurvetoQuadraticAbs(void 0,t,e,i,n)},window.SVGPathElement.prototype.createSVGPathSegCurvetoQuadraticRel=function(t,e,i,n){return new window.SVGPathSegCurvetoQuadraticRel(void 0,t,e,i,n)},window.SVGPathElement.prototype.createSVGPathSegArcAbs=function(t,e,i,n,r,a,o){return new window.SVGPathSegArcAbs(void 0,t,e,i,n,r,a,o)},window.SVGPathElement.prototype.createSVGPathSegArcRel=function(t,e,i,n,r,a,o){return new window.SVGPathSegArcRel(void 0,t,e,i,n,r,a,o)},window.SVGPathElement.prototype.createSVGPathSegLinetoHorizontalAbs=function(t){return new window.SVGPathSegLinetoHorizontalAbs(void 0,t)},window.SVGPathElement.prototype.createSVGPathSegLinetoHorizontalRel=function(t){return new window.SVGPathSegLinetoHorizontalRel(void 0,t)},window.SVGPathElement.prototype.createSVGPathSegLinetoVerticalAbs=function(t){return new window.SVGPathSegLinetoVerticalAbs(void 0,t)},window.SVGPathElement.prototype.createSVGPathSegLinetoVerticalRel=function(t){return new window.SVGPathSegLinetoVerticalRel(void 0,t)},window.SVGPathElement.prototype.createSVGPathSegCurvetoCubicSmoothAbs=function(t,e,i,n){return new window.SVGPathSegCurvetoCubicSmoothAbs(void 0,t,e,i,n)},window.SVGPathElement.prototype.createSVGPathSegCurvetoCubicSmoothRel=function(t,e,i,n){return new window.SVGPathSegCurvetoCubicSmoothRel(void 0,t,e,i,n)},window.SVGPathElement.prototype.createSVGPathSegCurvetoQuadraticSmoothAbs=function(t,e){return new window.SVGPathSegCurvetoQuadraticSmoothAbs(void 0,t,e)},window.SVGPathElement.prototype.createSVGPathSegCurvetoQuadraticSmoothRel=function(t,e){return new window.SVGPathSegCurvetoQuadraticSmoothRel(void 0,t,e)},"getPathSegAtLength"in window.SVGPathElement.prototype||(window.SVGPathElement.prototype.getPathSegAtLength=function(t){if(void 0===t||!isFinite(t))throw"Invalid arguments.";var e=document.createElementNS("http://www.w3.org/2000/svg","path");e.setAttribute("d",this.getAttribute("d"));var i=e.pathSegList.numberOfItems-1;if(i<=0)return 0;do{if(e.pathSegList.removeItem(i),t>e.getTotalLength())break;i--}while(0<i);return i})),"SVGPathSegList"in window||(window.SVGPathSegList=function(t){this._pathElement=t,this._list=this._parsePath(this._pathElement.getAttribute("d")),this._mutationObserverConfig={attributes:!0,attributeFilter:["d"]},this._pathElementMutationObserver=new MutationObserver(this._updateListFromPathMutations.bind(this)),this._pathElementMutationObserver.observe(this._pathElement,this._mutationObserverConfig)},window.SVGPathSegList.prototype.classname="SVGPathSegList",Object.defineProperty(window.SVGPathSegList.prototype,"numberOfItems",{get:function(){return this._checkPathSynchronizedToList(),this._list.length},enumerable:!0}),Object.defineProperty(window.SVGPathElement.prototype,"pathSegList",{get:function(){return this._pathSegList||(this._pathSegList=new window.SVGPathSegList(this)),this._pathSegList},enumerable:!0}),Object.defineProperty(window.SVGPathElement.prototype,"normalizedPathSegList",{get:function(){return this.pathSegList},enumerable:!0}),Object.defineProperty(window.SVGPathElement.prototype,"animatedPathSegList",{get:function(){return this.pathSegList},enumerable:!0}),Object.defineProperty(window.SVGPathElement.prototype,"animatedNormalizedPathSegList",{get:function(){return this.pathSegList},enumerable:!0}),window.SVGPathSegList.prototype._checkPathSynchronizedToList=function(){this._updateListFromPathMutations(this._pathElementMutationObserver.takeRecords())},window.SVGPathSegList.prototype._updateListFromPathMutations=function(t){if(this._pathElement){var e=!1;t.forEach(function(t){"d"==t.attributeName&&(e=!0)}),e&&(this._list=this._parsePath(this._pathElement.getAttribute("d")))}},window.SVGPathSegList.prototype._writeListToPath=function(){this._pathElementMutationObserver.disconnect(),this._pathElement.setAttribute("d",window.SVGPathSegList._pathSegArrayAsString(this._list)),this._pathElementMutationObserver.observe(this._pathElement,this._mutationObserverConfig)},window.SVGPathSegList.prototype.segmentChanged=function(t){this._writeListToPath()},window.SVGPathSegList.prototype.clear=function(){this._checkPathSynchronizedToList(),this._list.forEach(function(t){t._owningPathSegList=null}),this._list=[],this._writeListToPath()},window.SVGPathSegList.prototype.initialize=function(t){return this._checkPathSynchronizedToList(),this._list=[t],(t._owningPathSegList=this)._writeListToPath(),t},window.SVGPathSegList.prototype._checkValidIndex=function(t){if(isNaN(t)||t<0||t>=this.numberOfItems)throw"INDEX_SIZE_ERR"},window.SVGPathSegList.prototype.getItem=function(t){return this._checkPathSynchronizedToList(),this._checkValidIndex(t),this._list[t]},window.SVGPathSegList.prototype.insertItemBefore=function(t,e){return this._checkPathSynchronizedToList(),e>this.numberOfItems&&(e=this.numberOfItems),t._owningPathSegList&&(t=t.clone()),this._list.splice(e,0,t),(t._owningPathSegList=this)._writeListToPath(),t},window.SVGPathSegList.prototype.replaceItem=function(t,e){return this._checkPathSynchronizedToList(),t._owningPathSegList&&(t=t.clone()),this._checkValidIndex(e),((this._list[e]=t)._owningPathSegList=this)._writeListToPath(),t},window.SVGPathSegList.prototype.removeItem=function(t){this._checkPathSynchronizedToList(),this._checkValidIndex(t);var e=this._list[t];return this._list.splice(t,1),this._writeListToPath(),e},window.SVGPathSegList.prototype.appendItem=function(t){return this._checkPathSynchronizedToList(),t._owningPathSegList&&(t=t.clone()),this._list.push(t),(t._owningPathSegList=this)._writeListToPath(),t},window.SVGPathSegList._pathSegArrayAsString=function(t){var e="",i=!0;return t.forEach(function(t){i?(i=!1,e+=t._asPathString()):e+=" "+t._asPathString()}),e},window.SVGPathSegList.prototype._parsePath=function(t){if(!t||0==t.length)return[];var n=this,e=function(){this.pathSegList=[]};e.prototype.appendSegment=function(t){this.pathSegList.push(t)};var i=function(t){this._string=t,this._currentIndex=0,this._endIndex=this._string.length,this._previousCommand=window.SVGPathSeg.PATHSEG_UNKNOWN,this._skipOptionalSpaces()};i.prototype._isCurrentSpace=function(){var t=this._string[this._currentIndex];return t<=" "&&(" "==t||"\n"==t||"\t"==t||"\r"==t||"\f"==t)},i.prototype._skipOptionalSpaces=function(){for(;this._currentIndex<this._endIndex&&this._isCurrentSpace();)this._currentIndex++;return this._currentIndex<this._endIndex},i.prototype._skipOptionalSpacesOrDelimiter=function(){return!(this._currentIndex<this._endIndex&&!this._isCurrentSpace()&&","!=this._string.charAt(this._currentIndex))&&(this._skipOptionalSpaces()&&this._currentIndex<this._endIndex&&","==this._string.charAt(this._currentIndex)&&(this._currentIndex++,this._skipOptionalSpaces()),this._currentIndex<this._endIndex)},i.prototype.hasMoreData=function(){return this._currentIndex<this._endIndex},i.prototype.peekSegmentType=function(){var t=this._string[this._currentIndex];return this._pathSegTypeFromChar(t)},i.prototype._pathSegTypeFromChar=function(t){switch(t){case"Z":case"z":return window.SVGPathSeg.PATHSEG_CLOSEPATH;case"M":return window.SVGPathSeg.PATHSEG_MOVETO_ABS;case"m":return window.SVGPathSeg.PATHSEG_MOVETO_REL;case"L":return window.SVGPathSeg.PATHSEG_LINETO_ABS;case"l":return window.SVGPathSeg.PATHSEG_LINETO_REL;case"C":return window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_ABS;case"c":return window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_REL;case"Q":return window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_ABS;case"q":return window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_REL;case"A":return window.SVGPathSeg.PATHSEG_ARC_ABS;case"a":return window.SVGPathSeg.PATHSEG_ARC_REL;case"H":return window.SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_ABS;case"h":return window.SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_REL;case"V":return window.SVGPathSeg.PATHSEG_LINETO_VERTICAL_ABS;case"v":return window.SVGPathSeg.PATHSEG_LINETO_VERTICAL_REL;case"S":return window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_ABS;case"s":return window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_REL;case"T":return window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_ABS;case"t":return window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_REL;default:return window.SVGPathSeg.PATHSEG_UNKNOWN}},i.prototype._nextCommandHelper=function(t,e){return("+"==t||"-"==t||"."==t||"0"<=t&&t<="9")&&e!=window.SVGPathSeg.PATHSEG_CLOSEPATH?e==window.SVGPathSeg.PATHSEG_MOVETO_ABS?window.SVGPathSeg.PATHSEG_LINETO_ABS:e==window.SVGPathSeg.PATHSEG_MOVETO_REL?window.SVGPathSeg.PATHSEG_LINETO_REL:e:window.SVGPathSeg.PATHSEG_UNKNOWN},i.prototype.initialCommandIsMoveTo=function(){if(!this.hasMoreData())return!0;var t=this.peekSegmentType();return t==window.SVGPathSeg.PATHSEG_MOVETO_ABS||t==window.SVGPathSeg.PATHSEG_MOVETO_REL},i.prototype._parseNumber=function(){var t=0,e=0,i=1,n=0,r=1,a=1,o=this._currentIndex;if(this._skipOptionalSpaces(),this._currentIndex<this._endIndex&&"+"==this._string.charAt(this._currentIndex)?this._currentIndex++:this._currentIndex<this._endIndex&&"-"==this._string.charAt(this._currentIndex)&&(this._currentIndex++,r=-1),!(this._currentIndex==this._endIndex||(this._string.charAt(this._currentIndex)<"0"||"9"<this._string.charAt(this._currentIndex))&&"."!=this._string.charAt(this._currentIndex))){for(var s=this._currentIndex;this._currentIndex<this._endIndex&&"0"<=this._string.charAt(this._currentIndex)&&this._string.charAt(this._currentIndex)<="9";)this._currentIndex++;if(this._currentIndex!=s)for(var c=this._currentIndex-1,d=1;s<=c;)e+=d*(this._string.charAt(c--)-"0"),d*=10;if(this._currentIndex<this._endIndex&&"."==this._string.charAt(this._currentIndex)){if(this._currentIndex++,this._currentIndex>=this._endIndex||this._string.charAt(this._currentIndex)<"0"||"9"<this._string.charAt(this._currentIndex))return;for(;this._currentIndex<this._endIndex&&"0"<=this._string.charAt(this._currentIndex)&&this._string.charAt(this._currentIndex)<="9";)i*=10,n+=(this._string.charAt(this._currentIndex)-"0")/i,this._currentIndex+=1}if(this._currentIndex!=o&&this._currentIndex+1<this._endIndex&&("e"==this._string.charAt(this._currentIndex)||"E"==this._string.charAt(this._currentIndex))&&"x"!=this._string.charAt(this._currentIndex+1)&&"m"!=this._string.charAt(this._currentIndex+1)){if(this._currentIndex++,"+"==this._string.charAt(this._currentIndex)?this._currentIndex++:"-"==this._string.charAt(this._currentIndex)&&(this._currentIndex++,a=-1),this._currentIndex>=this._endIndex||this._string.charAt(this._currentIndex)<"0"||"9"<this._string.charAt(this._currentIndex))return;for(;this._currentIndex<this._endIndex&&"0"<=this._string.charAt(this._currentIndex)&&this._string.charAt(this._currentIndex)<="9";)t*=10,t+=this._string.charAt(this._currentIndex)-"0",this._currentIndex++}var l=e+n;if(l*=r,t&&(l*=Math.pow(10,a*t)),o!=this._currentIndex)return this._skipOptionalSpacesOrDelimiter(),l}},i.prototype._parseArcFlag=function(){if(!(this._currentIndex>=this._endIndex)){var t=!1,e=this._string.charAt(this._currentIndex++);if("0"==e)t=!1;else{if("1"!=e)return;t=!0}return this._skipOptionalSpacesOrDelimiter(),t}},i.prototype.parseSegment=function(){var t=this._string[this._currentIndex],e=this._pathSegTypeFromChar(t);if(e==window.SVGPathSeg.PATHSEG_UNKNOWN){if(this._previousCommand==window.SVGPathSeg.PATHSEG_UNKNOWN)return null;if((e=this._nextCommandHelper(t,this._previousCommand))==window.SVGPathSeg.PATHSEG_UNKNOWN)return null}else this._currentIndex++;switch(this._previousCommand=e){case window.SVGPathSeg.PATHSEG_MOVETO_REL:return new window.SVGPathSegMovetoRel(n,this._parseNumber(),this._parseNumber());case window.SVGPathSeg.PATHSEG_MOVETO_ABS:return new window.SVGPathSegMovetoAbs(n,this._parseNumber(),this._parseNumber());case window.SVGPathSeg.PATHSEG_LINETO_REL:return new window.SVGPathSegLinetoRel(n,this._parseNumber(),this._parseNumber());case window.SVGPathSeg.PATHSEG_LINETO_ABS:return new window.SVGPathSegLinetoAbs(n,this._parseNumber(),this._parseNumber());case window.SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_REL:return new window.SVGPathSegLinetoHorizontalRel(n,this._parseNumber());case window.SVGPathSeg.PATHSEG_LINETO_HORIZONTAL_ABS:return new window.SVGPathSegLinetoHorizontalAbs(n,this._parseNumber());case window.SVGPathSeg.PATHSEG_LINETO_VERTICAL_REL:return new window.SVGPathSegLinetoVerticalRel(n,this._parseNumber());case window.SVGPathSeg.PATHSEG_LINETO_VERTICAL_ABS:return new window.SVGPathSegLinetoVerticalAbs(n,this._parseNumber());case window.SVGPathSeg.PATHSEG_CLOSEPATH:return this._skipOptionalSpaces(),new window.SVGPathSegClosePath(n);case window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_REL:var i={x1:this._parseNumber(),y1:this._parseNumber(),x2:this._parseNumber(),y2:this._parseNumber(),x:this._parseNumber(),y:this._parseNumber()};return new window.SVGPathSegCurvetoCubicRel(n,i.x,i.y,i.x1,i.y1,i.x2,i.y2);case window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_ABS:return i={x1:this._parseNumber(),y1:this._parseNumber(),x2:this._parseNumber(),y2:this._parseNumber(),x:this._parseNumber(),y:this._parseNumber()},new window.SVGPathSegCurvetoCubicAbs(n,i.x,i.y,i.x1,i.y1,i.x2,i.y2);case window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_REL:return i={x2:this._parseNumber(),y2:this._parseNumber(),x:this._parseNumber(),y:this._parseNumber()},new window.SVGPathSegCurvetoCubicSmoothRel(n,i.x,i.y,i.x2,i.y2);case window.SVGPathSeg.PATHSEG_CURVETO_CUBIC_SMOOTH_ABS:return i={x2:this._parseNumber(),y2:this._parseNumber(),x:this._parseNumber(),y:this._parseNumber()},new window.SVGPathSegCurvetoCubicSmoothAbs(n,i.x,i.y,i.x2,i.y2);case window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_REL:return i={x1:this._parseNumber(),y1:this._parseNumber(),x:this._parseNumber(),y:this._parseNumber()},new window.SVGPathSegCurvetoQuadraticRel(n,i.x,i.y,i.x1,i.y1);case window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_ABS:return i={x1:this._parseNumber(),y1:this._parseNumber(),x:this._parseNumber(),y:this._parseNumber()},new window.SVGPathSegCurvetoQuadraticAbs(n,i.x,i.y,i.x1,i.y1);case window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_REL:return new window.SVGPathSegCurvetoQuadraticSmoothRel(n,this._parseNumber(),this._parseNumber());case window.SVGPathSeg.PATHSEG_CURVETO_QUADRATIC_SMOOTH_ABS:return new window.SVGPathSegCurvetoQuadraticSmoothAbs(n,this._parseNumber(),this._parseNumber());case window.SVGPathSeg.PATHSEG_ARC_REL:return i={x1:this._parseNumber(),y1:this._parseNumber(),arcAngle:this._parseNumber(),arcLarge:this._parseArcFlag(),arcSweep:this._parseArcFlag(),x:this._parseNumber(),y:this._parseNumber()},new window.SVGPathSegArcRel(n,i.x,i.y,i.x1,i.y1,i.arcAngle,i.arcLarge,i.arcSweep);case window.SVGPathSeg.PATHSEG_ARC_ABS:return i={x1:this._parseNumber(),y1:this._parseNumber(),arcAngle:this._parseNumber(),arcLarge:this._parseArcFlag(),arcSweep:this._parseArcFlag(),x:this._parseNumber(),y:this._parseNumber()},new window.SVGPathSegArcAbs(n,i.x,i.y,i.x1,i.y1,i.arcAngle,i.arcLarge,i.arcSweep);default:throw"Unknown path seg type."}};var r=new e,a=new i(t);if(!a.initialCommandIsMoveTo())return[];for(;a.hasMoreData();){var o=a.parseSegment();if(!o)return[];r.appendSegment(o)}return r.pathSegList}),String.prototype.padEnd||(String.prototype.padEnd=function(t,e){return t>>=0,e=String(void 0!==e?e:" "),this.length>t?String(this):((t-=this.length)>e.length&&(e+=e.repeat(t/e.length)),String(this)+e.slice(0,t))}),(n.prototype.axis=function(){}).labels=function(e){var i=this.internal;arguments.length&&(Object.keys(e).forEach(function(t){i.axis.setLabelText(t,e[t])}),i.axis.updateLabels())},n.prototype.axis.max=function(t){var e=this.internal,i=e.config;if(!arguments.length)return{x:i.axis_x_max,y:i.axis_y_max,y2:i.axis_y2_max};"object"===s(t)?(P(t.x)&&(i.axis_x_max=t.x),P(t.y)&&(i.axis_y_max=t.y),P(t.y2)&&(i.axis_y2_max=t.y2)):i.axis_y_max=i.axis_y2_max=t,e.redraw({withUpdateOrgXDomain:!0,withUpdateXDomain:!0})},n.prototype.axis.min=function(t){var e=this.internal,i=e.config;if(!arguments.length)return{x:i.axis_x_min,y:i.axis_y_min,y2:i.axis_y2_min};"object"===s(t)?(P(t.x)&&(i.axis_x_min=t.x),P(t.y)&&(i.axis_y_min=t.y),P(t.y2)&&(i.axis_y2_min=t.y2)):i.axis_y_min=i.axis_y2_min=t,e.redraw({withUpdateOrgXDomain:!0,withUpdateXDomain:!0})},n.prototype.axis.range=function(t){if(!arguments.length)return{max:this.axis.max(),min:this.axis.min()};k(t.max)&&this.axis.max(t.max),k(t.min)&&this.axis.min(t.min)},n.prototype.category=function(t,e){var i=this.internal,n=i.config;return 1<arguments.length&&(n.axis_x_categories[t]=e,i.redraw()),n.axis_x_categories[t]},n.prototype.categories=function(t){var e=this.internal,i=e.config;return arguments.length&&(i.axis_x_categories=t,e.redraw()),i.axis_x_categories},n.prototype.resize=function(t){var e=this.internal.config;e.size_width=t?t.width:null,e.size_height=t?t.height:null,this.flush()},n.prototype.flush=function(){this.internal.updateAndRedraw({withLegend:!0,withTransition:!1,withTransitionForTransform:!1})},n.prototype.destroy=function(){var e=this.internal;if(window.clearInterval(e.intervalForObserveInserted),void 0!==e.resizeTimeout&&window.clearTimeout(e.resizeTimeout),window.detachEvent)window.detachEvent("onresize",e.resizeIfElementDisplayed);else if(window.removeEventListener)window.removeEventListener("resize",e.resizeIfElementDisplayed);else{var t=window.onresize;t&&t.add&&t.remove&&t.remove(e.resizeFunction)}return e.resizeFunction.remove(),e.unbindWindowFocus(),e.selectChart.classed("c3",!1).html(""),Object.keys(e).forEach(function(t){e[t]=null}),null},n.prototype.color=function(t){return this.internal.color(t)},(n.prototype.data=function(e){var t=this.internal.data.targets;return void 0===e?t:t.filter(function(t){return 0<=[].concat(e).indexOf(t.id)})}).shown=function(t){return this.internal.filterTargetsToShow(this.data(t))},n.prototype.data.values=function(t){var e,i=null;return t&&(i=(e=this.data(t))[0]?e[0].values.map(function(t){return t.value}):null),i},n.prototype.data.names=function(t){return this.internal.clearLegendItemTextBoxCache(),this.internal.updateDataAttributes("names",t)},n.prototype.data.colors=function(t){return this.internal.updateDataAttributes("colors",t)},n.prototype.data.axes=function(t){return this.internal.updateDataAttributes("axes",t)},n.prototype.flow=function(t){var r,e,i,n,a,o,s,c=this.internal,d=[],l=c.getMaxDataCount(),u=0,h=0;if(t.json)e=c.convertJsonToData(t.json,t.keys);else if(t.rows)e=c.convertRowsToData(t.rows);else{if(!t.columns)return;e=c.convertColumnsToData(t.columns)}r=c.convertDataToTargets(e,!0),c.data.targets.forEach(function(t){var e,i,n=!1;for(e=0;e<r.length;e++)if(t.id===r[e].id){for(n=!0,t.values[t.values.length-1]&&(h=t.values[t.values.length-1].index+1),u=r[e].values.length,i=0;i<u;i++)r[e].values[i].index=h+i,c.isTimeSeries()||(r[e].values[i].x=h+i);t.values=t.values.concat(r[e].values),r.splice(e,1);break}n||d.push(t.id)}),c.data.targets.forEach(function(t){var e,i;for(e=0;e<d.length;e++)if(t.id===d[e])for(h=t.values[t.values.length-1].index+1,i=0;i<u;i++)t.values.push({id:t.id,index:h+i,x:c.isTimeSeries()?c.getOtherTargetX(h+i):h+i,value:null})}),c.data.targets.length&&r.forEach(function(t){var e,i=[];for(e=c.data.targets[0].values[0].index;e<h;e++)i.push({id:t.id,index:e,x:c.isTimeSeries()?c.getOtherTargetX(e):e,value:null});t.values.forEach(function(t){t.index+=h,c.isTimeSeries()||(t.x+=h)}),t.values=i.concat(t.values)}),c.data.targets=c.data.targets.concat(r),c.getMaxDataCount(),a=(n=c.data.targets[0]).values[0],k(t.to)?(u=0,s=c.isTimeSeries()?c.parseDate(t.to):t.to,n.values.forEach(function(t){t.x<s&&u++})):k(t.length)&&(u=t.length),l?1===l&&c.isTimeSeries()&&(o=(n.values[n.values.length-1].x-a.x)/2,i=[new Date(+a.x-o),new Date(+a.x+o)],c.updateXDomain(null,!0,!0,!1,i)):(o=c.isTimeSeries()?1<n.values.length?n.values[n.values.length-1].x-a.x:a.x-c.getXDomain(c.data.targets)[0]:1,i=[a.x-o,a.x],c.updateXDomain(null,!0,!0,!1,i)),c.updateTargets(c.data.targets),c.redraw({flow:{index:a.index,length:u,duration:P(t.duration)?t.duration:c.config.transition_duration,done:t.done,orgDataCount:l},withLegend:!0,withTransition:1<l,withTrimXDomain:!1,withUpdateXAxis:!0})},l.prototype.generateFlow=function(G){var E=this,O=E.config,I=E.d3;return function(){var t,e,n,r,a,o,s,c,d,l,i=G.targets,u=G.flow,h=G.drawBar,g=G.drawLine,p=G.drawArea,f=G.cx,_=G.cy,x=G.xv,y=G.xForText,m=G.yForText,S=G.duration,w=u.index,v=u.length,b=E.getValueOnIndex(E.data.targets[0].values,w),T=E.getValueOnIndex(E.data.targets[0].values,w+v),A=E.x.domain(),P=u.duration||S,C=u.done||function(){},L=E.generateWait();E.flowing=!0,E.data.targets.forEach(function(t){t.values.splice(0,v)}),e=E.updateXDomain(i,!0,!0),E.updateXGrid&&E.updateXGrid(!0),n=E.xgrid||I.selectAll([]),r=E.xgridLines||I.selectAll([]),a=E.mainRegion||I.selectAll([]),o=E.mainText||I.selectAll([]),s=E.mainBar||I.selectAll([]),c=E.mainLine||I.selectAll([]),d=E.mainArea||I.selectAll([]),l=E.mainCircle||I.selectAll([]),t="translate("+(u.orgDataCount?1===u.orgDataCount||(b&&b.x)===(T&&T.x)?E.x(A[0])-E.x(e[0]):E.isTimeSeries()?E.x(A[0])-E.x(e[0]):E.x(b.x)-E.x(T.x):1!==E.data.targets[0].values.length?E.x(A[0])-E.x(e[0]):E.isTimeSeries()?(b=E.getValueOnIndex(E.data.targets[0].values,0),T=E.getValueOnIndex(E.data.targets[0].values,E.data.targets[0].values.length-1),E.x(b.x)-E.x(T.x)):R(e)/2)+",0) scale("+R(A)/R(e)+",1)",E.hideXGridFocus();var V=I.transition().ease(I.easeLinear).duration(P);L.add(E.xAxis(E.axes.x,V)),L.add(s.transition(V).attr("transform",t)),L.add(c.transition(V).attr("transform",t)),L.add(d.transition(V).attr("transform",t)),L.add(l.transition(V).attr("transform",t)),L.add(o.transition(V).attr("transform",t)),L.add(a.filter(E.isRegionOnX).transition(V).attr("transform",t)),L.add(n.transition(V).attr("transform",t)),L.add(r.transition(V).attr("transform",t)),L(function(){var t,e=[],i=[];if(v){for(t=0;t<v;t++)e.push("."+N.shape+"-"+(w+t)),i.push("."+N.text+"-"+(w+t));E.svg.selectAll("."+N.shapes).selectAll(e).remove(),E.svg.selectAll("."+N.texts).selectAll(i).remove(),E.svg.select("."+N.xgrid).remove()}n.attr("transform",null).attr("x1",E.xgridAttr.x1).attr("x2",E.xgridAttr.x2).attr("y1",E.xgridAttr.y1).attr("y2",E.xgridAttr.y2).style("opacity",E.xgridAttr.opacity),r.attr("transform",null),r.select("line").attr("x1",O.axis_rotated?0:x).attr("x2",O.axis_rotated?E.width:x),r.select("text").attr("x",O.axis_rotated?E.width:0).attr("y",x),s.attr("transform",null).attr("d",h),c.attr("transform",null).attr("d",g),d.attr("transform",null).attr("d",p),l.attr("transform",null).attr("cx",f).attr("cy",_),o.attr("transform",null).attr("x",y).attr("y",m).style("fill-opacity",E.opacityForText.bind(E)),a.attr("transform",null),a.filter(E.isRegionOnX).attr("x",E.regionX.bind(E)).attr("width",E.regionWidth.bind(E)),C(),E.flowing=!1})}},n.prototype.focus=function(e){var t,i=this.internal;e=i.mapToTargetIds(e),t=i.svg.selectAll(i.selectorTargets(e.filter(i.isTargetToShow,i))),this.revert(),this.defocus(),t.classed(N.focused,!0).classed(N.defocused,!1),i.hasArcType()&&i.expandArc(e),i.toggleFocusLegend(e,!0),i.focusedTargetIds=e,i.defocusedTargetIds=i.defocusedTargetIds.filter(function(t){return e.indexOf(t)<0})},n.prototype.defocus=function(e){var t=this.internal;e=t.mapToTargetIds(e),t.svg.selectAll(t.selectorTargets(e.filter(t.isTargetToShow,t))).classed(N.focused,!1).classed(N.defocused,!0),t.hasArcType()&&t.unexpandArc(e),t.toggleFocusLegend(e,!1),t.focusedTargetIds=t.focusedTargetIds.filter(function(t){return e.indexOf(t)<0}),t.defocusedTargetIds=e},n.prototype.revert=function(t){var e=this.internal;t=e.mapToTargetIds(t),e.svg.selectAll(e.selectorTargets(t)).classed(N.focused,!1).classed(N.defocused,!1),e.hasArcType()&&e.unexpandArc(t),e.config.legend_show&&(e.showLegend(t.filter(e.isLegendToShow.bind(e))),e.legend.selectAll(e.selectorLegends(t)).filter(function(){return e.d3.select(this).classed(N.legendItemFocused)}).classed(N.legendItemFocused,!1)),e.focusedTargetIds=[],e.defocusedTargetIds=[]},(n.prototype.xgrids=function(t){var e=this.internal,i=e.config;return t&&(i.grid_x_lines=t,e.redrawWithoutRescale()),i.grid_x_lines}).add=function(t){var e=this.internal;return this.xgrids(e.config.grid_x_lines.concat(t||[]))},n.prototype.xgrids.remove=function(t){this.internal.removeGridLines(t,!0)},(n.prototype.ygrids=function(t){var e=this.internal,i=e.config;return t&&(i.grid_y_lines=t,e.redrawWithoutRescale()),i.grid_y_lines}).add=function(t){var e=this.internal;return this.ygrids(e.config.grid_y_lines.concat(t||[]))},n.prototype.ygrids.remove=function(t){this.internal.removeGridLines(t,!1)},n.prototype.groups=function(t){var e=this.internal,i=e.config;return v(t)||(i.data_groups=t,e.redraw()),i.data_groups},(n.prototype.legend=function(){}).show=function(t){var e=this.internal;e.showLegend(e.mapToTargetIds(t)),e.updateAndRedraw({withLegend:!0})},n.prototype.legend.hide=function(t){var e=this.internal;e.hideLegend(e.mapToTargetIds(t)),e.updateAndRedraw({withLegend:!1})},n.prototype.load=function(e){var t=this.internal,i=t.config;e.xs&&t.addXs(e.xs),"names"in e&&n.prototype.data.names.bind(this)(e.names),"classes"in e&&Object.keys(e.classes).forEach(function(t){i.data_classes[t]=e.classes[t]}),"categories"in e&&t.isCategorized()&&(i.axis_x_categories=e.categories),"axes"in e&&Object.keys(e.axes).forEach(function(t){i.data_axes[t]=e.axes[t]}),"colors"in e&&Object.keys(e.colors).forEach(function(t){i.data_colors[t]=e.colors[t]}),"cacheIds"in e&&t.hasCaches(e.cacheIds)?t.load(t.getCaches(e.cacheIds),e.done):"unload"in e?t.unload(t.mapToTargetIds("boolean"==typeof e.unload&&e.unload?null:e.unload),function(){t.loadFromArgs(e)}):t.loadFromArgs(e)},n.prototype.unload=function(t){var e=this.internal;(t=t||{})instanceof Array?t={ids:t}:"string"==typeof t&&(t={ids:[t]}),e.unload(e.mapToTargetIds(t.ids),function(){e.redraw({withUpdateOrgXDomain:!0,withUpdateXDomain:!0,withLegend:!0}),t.done&&t.done()})},(n.prototype.regions=function(t){var e=this.internal,i=e.config;return t&&(i.regions=t,e.redrawWithoutRescale()),i.regions}).add=function(t){var e=this.internal,i=e.config;return t&&(i.regions=i.regions.concat(t),e.redrawWithoutRescale()),i.regions},n.prototype.regions.remove=function(t){var e,i,n,r=this.internal,a=r.config;return e=Y(t=t||{},"duration",a.transition_duration),i=Y(t,"classes",[N.region]),n=r.main.select("."+N.regions).selectAll(i.map(function(t){return"."+t})),(e?n.transition().duration(e):n).style("opacity",0).remove(),a.regions=a.regions.filter(function(t){var e=!1;return!t.class||(t.class.split(" ").forEach(function(t){0<=i.indexOf(t)&&(e=!0)}),!e)}),a.regions},n.prototype.selected=function(t){var e=this.internal,i=e.d3;return e.main.selectAll("."+N.shapes+e.getTargetSelectorSuffix(t)).selectAll("."+N.shape).filter(function(){return i.select(this).classed(N.SELECTED)}).nodes().map(function(t){var e=t.__data__;return e.data?e.data:e})},n.prototype.select=function(c,d,l){var u=this.internal,h=u.d3,g=u.config;g.data_selection_enabled&&u.main.selectAll("."+N.shapes).selectAll("."+N.shape).each(function(t,e){var i=h.select(this),n=t.data?t.data.id:t.id,r=u.getToggle(this,t).bind(u),a=g.data_selection_grouped||!c||0<=c.indexOf(n),o=!d||0<=d.indexOf(e),s=i.classed(N.SELECTED);i.classed(N.line)||i.classed(N.area)||(a&&o?g.data_selection_isselectable(t)&&!s&&r(!0,i.classed(N.SELECTED,!0),t,e):k(l)&&l&&s&&r(!1,i.classed(N.SELECTED,!1),t,e))})},n.prototype.unselect=function(c,d){var l=this.internal,u=l.d3,h=l.config;h.data_selection_enabled&&l.main.selectAll("."+N.shapes).selectAll("."+N.shape).each(function(t,e){var i=u.select(this),n=t.data?t.data.id:t.id,r=l.getToggle(this,t).bind(l),a=h.data_selection_grouped||!c||0<=c.indexOf(n),o=!d||0<=d.indexOf(e),s=i.classed(N.SELECTED);i.classed(N.line)||i.classed(N.area)||a&&o&&h.data_selection_isselectable(t)&&s&&r(!1,i.classed(N.SELECTED,!1),t,e)})},n.prototype.show=function(t,e){var i,n=this.internal;t=n.mapToTargetIds(t),e=e||{},n.removeHiddenTargetIds(t),(i=n.svg.selectAll(n.selectorTargets(t))).transition().style("display","initial","important").style("opacity",1,"important").call(n.endall,function(){i.style("opacity",null).style("opacity",1)}),e.withLegend&&n.showLegend(t),n.redraw({withUpdateOrgXDomain:!0,withUpdateXDomain:!0,withLegend:!0})},n.prototype.hide=function(t,e){var i,n=this.internal;t=n.mapToTargetIds(t),e=e||{},n.addHiddenTargetIds(t),(i=n.svg.selectAll(n.selectorTargets(t))).transition().style("opacity",0,"important").call(n.endall,function(){i.style("opacity",null).style("opacity",0),i.style("display","none")}),e.withLegend&&n.hideLegend(t),n.redraw({withUpdateOrgXDomain:!0,withUpdateXDomain:!0,withLegend:!0})},n.prototype.toggle=function(t,e){var i=this,n=this.internal;n.mapToTargetIds(t).forEach(function(t){n.isTargetToShow(t)?i.hide(t,e):i.show(t,e)})},(n.prototype.tooltip=function(){}).show=function(e){var t,i,n=this.internal,r={};r=e.mouse?e.mouse:(e.data?i=e.data:void 0!==e.x&&(t=e.id?n.data.targets.filter(function(t){return t.id===e.id}):n.data.targets,i=n.filterByX(t,e.x).slice(0,1)[0]),i?n.getMousePosition(i):null),n.dispatchEvent("mousemove",r),n.config.tooltip_onshow.call(n,i)},n.prototype.tooltip.hide=function(){this.internal.dispatchEvent("mouseout",0),this.internal.config.tooltip_onhide.call(this)},n.prototype.transform=function(t,e){var i=this.internal,n=0<=["pie","donut"].indexOf(t)?{withTransform:!0}:null;i.transformTo(e,t,n)},l.prototype.transformTo=function(t,e,i){var n=this,r=!n.hasArcType(),a=i||{withTransitionForAxis:r};a.withTransitionForTransform=!1,n.transiting=!1,n.setTargetType(t,e),n.updateTargets(n.data.targets),n.updateAndRedraw(a)},n.prototype.x=function(t){var e=this.internal;return arguments.length&&(e.updateTargetX(e.data.targets,t),e.redraw({withUpdateOrgXDomain:!0,withUpdateXDomain:!0})),e.data.xs},n.prototype.xs=function(t){var e=this.internal;return arguments.length&&(e.updateTargetXs(e.data.targets,t),e.redraw({withUpdateOrgXDomain:!0,withUpdateXDomain:!0})),e.data.xs},(n.prototype.zoom=function(t){var e=this.internal;return t?(e.isTimeSeries()&&(t=t.map(function(t){return e.parseDate(t)})),e.config.subchart_show?e.brush.selectionAsValue(t,!0):(e.updateXDomain(null,!0,!1,!1,t),e.redraw({withY:e.config.zoom_rescale,withSubchart:!1})),e.config.zoom_onzoom.call(this,e.x.orgDomain()),t):e.x.domain()}).enable=function(t){var e=this.internal;e.config.zoom_enabled=t,e.updateAndRedraw()},n.prototype.unzoom=function(){var t=this.internal;t.config.subchart_show?t.brush.clear():(t.updateXDomain(null,!0,!1,!1,t.subX.domain()),t.redraw({withY:t.config.zoom_rescale,withSubchart:!1}))},n.prototype.zoom.max=function(t){var e=this.internal,i=e.config,n=e.d3;if(0!==t&&!t)return i.zoom_x_max;i.zoom_x_max=n.max([e.orgXDomain[1],t])},n.prototype.zoom.min=function(t){var e=this.internal,i=e.config,n=e.d3;if(0!==t&&!t)return i.zoom_x_min;i.zoom_x_min=n.min([e.orgXDomain[0],t])},n.prototype.zoom.range=function(t){if(!arguments.length)return{max:this.domain.max(),min:this.domain.min()};k(t.max)&&this.domain.max(t.max),k(t.min)&&this.domain.min(t.min)},l.prototype.initPie=function(){var t=this,e=t.d3;t.pie=e.pie().value(function(t){return t.values.reduce(function(t,e){return t+e.value},0)});var i=t.getOrderFunction();if(i&&(t.isOrderAsc()||t.isOrderDesc())){var n=i;i=function(t,e){return-1*n(t,e)}}t.pie.sort(i||null)},l.prototype.updateRadius=function(){var t=this,e=t.config,i=e.gauge_width||e.donut_width,n=t.filterTargetsToShow(t.data.targets).length*t.config.gauge_arcs_minWidth;t.radiusExpanded=Math.min(t.arcWidth,t.arcHeight)/2*(t.hasType("gauge")?.85:1),t.radius=.95*t.radiusExpanded,t.innerRadiusRatio=i?(t.radius-i)/t.radius:.6,t.innerRadius=t.hasType("donut")||t.hasType("gauge")?t.radius*t.innerRadiusRatio:0,t.gaugeArcWidth=i||(n<=t.radius-t.innerRadius?t.radius-t.innerRadius:n<=t.radius?n:t.radius)},l.prototype.updateArc=function(){var t=this;t.svgArc=t.getSvgArc(),t.svgArcExpanded=t.getSvgArcExpanded(),t.svgArcExpandedSub=t.getSvgArcExpanded(.98)},l.prototype.updateAngle=function(e){var t,i,n,r,a=this,o=a.config,s=!1,c=0;return o?(a.pie(a.filterTargetsToShow(a.data.targets)).forEach(function(t){s||t.data.id!==e.data.id||(s=!0,(e=t).index=c),c++}),isNaN(e.startAngle)&&(e.startAngle=0),isNaN(e.endAngle)&&(e.endAngle=e.startAngle),a.isGaugeType(e.data)&&(t=o.gauge_min,i=o.gauge_max,n=Math.PI*(o.gauge_fullCircle?2:1)/(i-t),r=e.value<t?0:e.value<i?e.value-t:i-t,e.startAngle=o.gauge_startingAngle,e.endAngle=e.startAngle+n*r),s?e:null):null},l.prototype.getSvgArc=function(){var n=this,e=n.hasType("gauge"),i=n.gaugeArcWidth/n.filterTargetsToShow(n.data.targets).length,r=n.d3.arc().outerRadius(function(t){return e?n.radius-i*t.index:n.radius}).innerRadius(function(t){return e?n.radius-i*(t.index+1):n.innerRadius}),t=function(t,e){var i;return e?r(t):(i=n.updateAngle(t))?r(i):"M 0 0"};return t.centroid=r.centroid,t},l.prototype.getSvgArcExpanded=function(e){e=e||1;var i=this,n=i.hasType("gauge"),r=i.gaugeArcWidth/i.filterTargetsToShow(i.data.targets).length,a=Math.min(i.radiusExpanded*e-i.radius,.8*r-100*(1-e)),o=i.d3.arc().outerRadius(function(t){return n?i.radius-r*t.index+a:i.radiusExpanded*e}).innerRadius(function(t){return n?i.radius-r*(t.index+1):i.innerRadius});return function(t){var e=i.updateAngle(t);return e?o(e):"M 0 0"}},l.prototype.getArc=function(t,e,i){return i||this.isArcType(t.data)?this.svgArc(t,e):"M 0 0"},l.prototype.transformForArcLabel=function(t){var e,i,n,r,a,o=this,s=o.config,c=o.updateAngle(t),d="",l=o.hasType("gauge");if(c&&!l)e=this.svgArc.centroid(c),i=isNaN(e[0])?0:e[0],n=isNaN(e[1])?0:e[1],r=Math.sqrt(i*i+n*n),d="translate("+i*(a=o.hasType("donut")&&s.donut_label_ratio?h(s.donut_label_ratio)?s.donut_label_ratio(t,o.radius,r):s.donut_label_ratio:o.hasType("pie")&&s.pie_label_ratio?h(s.pie_label_ratio)?s.pie_label_ratio(t,o.radius,r):s.pie_label_ratio:o.radius&&r?(.375<36/o.radius?1.175-36/o.radius:.8)*o.radius/r:0)+","+n*a+")";else if(c&&l&&1<o.filterTargetsToShow(o.data.targets).length){var u=Math.sin(c.endAngle-Math.PI/2);d="translate("+(i=Math.cos(c.endAngle-Math.PI/2)*(o.radiusExpanded+25))+","+(n=u*(o.radiusExpanded+15-Math.abs(10*u))+3)+")"}return d},l.prototype.getArcRatio=function(t){var e=this.config,i=Math.PI*(this.hasType("gauge")&&!e.gauge_fullCircle?1:2);return t?(t.endAngle-t.startAngle)/i:null},l.prototype.convertToArcData=function(t){return this.addName({id:t.data.id,value:t.value,ratio:this.getArcRatio(t),index:t.index})},l.prototype.textForArcLabel=function(t){var e,i,n,r,a,o=this;return o.shouldShowArcLabel()?(i=(e=o.updateAngle(t))?e.value:null,n=o.getArcRatio(e),r=t.data.id,o.hasType("gauge")||o.meetsArcLabelThreshold(n)?(a=o.getArcLabelFormat())?a(i,n,r):o.defaultArcValueFormat(i,n):""):""},l.prototype.textForGaugeMinMax=function(t,e){var i=this.getGaugeLabelExtents();return i?i(t,e):t},l.prototype.expandArc=function(t){var e,i=this;i.transiting?e=window.setInterval(function(){i.transiting||(window.clearInterval(e),0<i.legend.selectAll(".c3-legend-item-focused").size()&&i.expandArc(t))},10):(t=i.mapToTargetIds(t),i.svg.selectAll(i.selectorTargets(t,"."+N.chartArc)).each(function(t){i.shouldExpand(t.data.id)&&i.d3.select(this).selectAll("path").transition().duration(i.expandDuration(t.data.id)).attr("d",i.svgArcExpanded).transition().duration(2*i.expandDuration(t.data.id)).attr("d",i.svgArcExpandedSub).each(function(t){i.isDonutType(t.data)})}))},l.prototype.unexpandArc=function(t){var e=this;e.transiting||(t=e.mapToTargetIds(t),e.svg.selectAll(e.selectorTargets(t,"."+N.chartArc)).selectAll("path").transition().duration(function(t){return e.expandDuration(t.data.id)}).attr("d",e.svgArc),e.svg.selectAll("."+N.arc))},l.prototype.expandDuration=function(t){var e=this.config;return this.isDonutType(t)?e.donut_expand_duration:this.isGaugeType(t)?e.gauge_expand_duration:this.isPieType(t)?e.pie_expand_duration:50},l.prototype.shouldExpand=function(t){var e=this.config;return this.isDonutType(t)&&e.donut_expand||this.isGaugeType(t)&&e.gauge_expand||this.isPieType(t)&&e.pie_expand},l.prototype.shouldShowArcLabel=function(){var t=this.config,e=!0;return this.hasType("donut")?e=t.donut_label_show:this.hasType("pie")&&(e=t.pie_label_show),e},l.prototype.meetsArcLabelThreshold=function(t){var e=this.config;return(this.hasType("donut")?e.donut_label_threshold:e.pie_label_threshold)<=t},l.prototype.getArcLabelFormat=function(){var t=this.config,e=t.pie_label_format;return this.hasType("gauge")?e=t.gauge_label_format:this.hasType("donut")&&(e=t.donut_label_format),e},l.prototype.getGaugeLabelExtents=function(){return this.config.gauge_label_extents},l.prototype.getArcTitle=function(){return this.hasType("donut")?this.config.donut_title:""},l.prototype.updateTargetsForArc=function(t){var e,i=this,n=i.main,r=i.classChartArc.bind(i),a=i.classArcs.bind(i),o=i.classFocus.bind(i);(e=n.select("."+N.chartArcs).selectAll("."+N.chartArc).data(i.pie(t)).attr("class",function(t){return r(t)+o(t.data)}).enter().append("g").attr("class",r)).append("g").attr("class",a),e.append("text").attr("dy",i.hasType("gauge")?"-.1em":".35em").style("opacity",0).style("text-anchor","middle").style("pointer-events","none")},l.prototype.initArc=function(){var t=this;t.arcs=t.main.select("."+N.chart).append("g").attr("class",N.chartArcs).attr("transform",t.getTranslate("arc")),t.arcs.append("text").attr("class",N.chartArcsTitle).style("text-anchor","middle").text(t.getArcTitle())},l.prototype.redrawArc=function(t,e,i){var n,r,a,o,l=this,u=l.d3,s=l.config,c=l.main,d=l.hasType("gauge");if(r=(n=c.selectAll("."+N.arcs).selectAll("."+N.arc).data(l.arcData.bind(l))).enter().append("path").attr("class",l.classArc.bind(l)).style("fill",function(t){return l.color(t.data)}).style("cursor",function(t){return s.interaction_enabled&&s.data_selection_isselectable(t)?"pointer":null}).each(function(t){l.isGaugeType(t.data)&&(t.startAngle=t.endAngle=s.gauge_startingAngle),this._current=t}).merge(n),d&&(o=(a=c.selectAll("."+N.arcs).selectAll("."+N.arcLabelLine).data(l.arcData.bind(l))).enter().append("rect").attr("class",function(t){return N.arcLabelLine+" "+N.target+" "+N.target+"-"+t.data.id}).merge(a),1===l.filterTargetsToShow(l.data.targets).length?o.style("display","none"):o.style("fill",function(t){return l.levelColor?l.levelColor(t.data.values[0].value):l.color(t.data)}).style("display",s.gauge_labelLine_show?"":"none").each(function(t){var e=0,i=0,n=0,r="";if(l.hiddenTargetIds.indexOf(t.data.id)<0){var a=l.updateAngle(t),o=l.gaugeArcWidth/l.filterTargetsToShow(l.data.targets).length*(a.index+1),s=a.endAngle-Math.PI/2,c=l.radius-o,d=s-(0==c?0:1/c);e=l.radiusExpanded-l.radius+o,i=Math.cos(d)*c,n=Math.sin(d)*c,r="rotate("+180*s/Math.PI+", "+i+", "+n+")"}u.select(this).attr("x",i).attr("y",n).attr("width",e).attr("height",2).attr("transform",r).style("stroke-dasharray","0, "+(e+2)+", 0")})),r.attr("transform",function(t){return!l.isGaugeType(t.data)&&i?"scale(0)":""}).on("mouseover",s.interaction_enabled?function(t){var e,i;l.transiting||(e=l.updateAngle(t))&&(i=l.convertToArcData(e),l.expandArc(e.data.id),l.api.focus(e.data.id),l.toggleFocusLegend(e.data.id,!0),l.config.data_onmouseover(i,this))}:null).on("mousemove",s.interaction_enabled?function(t){var e,i=l.updateAngle(t);i&&(e=[l.convertToArcData(i)],l.showTooltip(e,this))}:null).on("mouseout",s.interaction_enabled?function(t){var e,i;l.transiting||(e=l.updateAngle(t))&&(i=l.convertToArcData(e),l.unexpandArc(e.data.id),l.api.revert(),l.revertLegend(),l.hideTooltip(),l.config.data_onmouseout(i,this))}:null).on("click",s.interaction_enabled?function(t,e){var i,n=l.updateAngle(t);n&&(i=l.convertToArcData(n),l.toggleShape&&l.toggleShape(this,i,e),l.config.data_onclick.call(l.api,i,this))}:null).each(function(){l.transiting=!0}).transition().duration(t).attrTween("d",function(i){var n,t=l.updateAngle(i);return t?(isNaN(this._current.startAngle)&&(this._current.startAngle=0),isNaN(this._current.endAngle)&&(this._current.endAngle=this._current.startAngle),n=u.interpolate(this._current,t),this._current=n(0),function(t){var e=n(t);return e.data=i.data,l.getArc(e,!0)}):function(){return"M 0 0"}}).attr("transform",i?"scale(1)":"").style("fill",function(t){return l.levelColor?l.levelColor(t.data.values[0].value):l.color(t.data.id)}).call(l.endall,function(){l.transiting=!1}),n.exit().transition().duration(e).style("opacity",0).remove(),c.selectAll("."+N.chartArc).select("text").style("opacity",0).attr("class",function(t){return l.isGaugeType(t.data)?N.gaugeValue:""}).text(l.textForArcLabel.bind(l)).attr("transform",l.transformForArcLabel.bind(l)).style("font-size",function(t){return l.isGaugeType(t.data)&&1===l.filterTargetsToShow(l.data.targets).length?Math.round(l.radius/5)+"px":""}).transition().duration(t).style("opacity",function(t){return l.isTargetToShow(t.data.id)&&l.isArcType(t.data)?1:0}),c.select("."+N.chartArcsTitle).style("opacity",l.hasType("donut")||d?1:0),d){var h=0,g=l.arcs.select("g."+N.chartArcsBackground).selectAll("path."+N.chartArcsBackground).data(l.data.targets);g.enter().append("path").attr("class",function(t,e){return N.chartArcsBackground+" "+N.chartArcsBackground+"-"+e}).merge(g).attr("d",function(t){if(0<=l.hiddenTargetIds.indexOf(t.id))return"M 0 0";var e={data:[{value:s.gauge_max}],startAngle:s.gauge_startingAngle,endAngle:-1*s.gauge_startingAngle*(s.gauge_fullCircle?Math.PI:1),index:h++};return l.getArc(e,!0,!0)}),g.exit().remove(),l.arcs.select("."+N.chartArcsGaugeUnit).attr("dy",".75em").text(s.gauge_label_show?s.gauge_units:""),l.arcs.select("."+N.chartArcsGaugeMin).attr("dx",-1*(l.innerRadius+(l.radius-l.innerRadius)/(s.gauge_fullCircle?1:2))+"px").attr("dy","1.2em").text(s.gauge_label_show?l.textForGaugeMinMax(s.gauge_min,!1):""),l.arcs.select("."+N.chartArcsGaugeMax).attr("dx",l.innerRadius+(l.radius-l.innerRadius)/(s.gauge_fullCircle?1:2)+"px").attr("dy","1.2em").text(s.gauge_label_show?l.textForGaugeMinMax(s.gauge_max,!0):"")}},l.prototype.initGauge=function(){var t=this.arcs;this.hasType("gauge")&&(t.append("g").attr("class",N.chartArcsBackground),t.append("text").attr("class",N.chartArcsGaugeUnit).style("text-anchor","middle").style("pointer-events","none"),t.append("text").attr("class",N.chartArcsGaugeMin).style("text-anchor","middle").style("pointer-events","none"),t.append("text").attr("class",N.chartArcsGaugeMax).style("text-anchor","middle").style("pointer-events","none"))},l.prototype.getGaugeLabelHeight=function(){return this.config.gauge_label_show?20:0},l.prototype.hasCaches=function(t){for(var e=0;e<t.length;e++)if(!(t[e]in this.cache))return!1;return!0},l.prototype.addCache=function(t,e){this.cache[t]=this.cloneTarget(e)},l.prototype.getCaches=function(t){var e,i=[];for(e=0;e<t.length;e++)t[e]in this.cache&&i.push(this.cloneTarget(this.cache[t[e]]));return i},l.prototype.categoryName=function(t){var e=this.config;return t<e.axis_x_categories.length?e.axis_x_categories[t]:t},l.prototype.generateTargetClass=function(t){return t||0===t?("-"+t).replace(/\s/g,"-"):""},l.prototype.generateClass=function(t,e){return" "+t+" "+t+this.generateTargetClass(e)},l.prototype.classText=function(t){return this.generateClass(N.text,t.index)},l.prototype.classTexts=function(t){return this.generateClass(N.texts,t.id)},l.prototype.classShape=function(t){return this.generateClass(N.shape,t.index)},l.prototype.classShapes=function(t){return this.generateClass(N.shapes,t.id)},l.prototype.classLine=function(t){return this.classShape(t)+this.generateClass(N.line,t.id)},l.prototype.classLines=function(t){return this.classShapes(t)+this.generateClass(N.lines,t.id)},l.prototype.classCircle=function(t){return this.classShape(t)+this.generateClass(N.circle,t.index)},l.prototype.classCircles=function(t){return this.classShapes(t)+this.generateClass(N.circles,t.id)},l.prototype.classBar=function(t){return this.classShape(t)+this.generateClass(N.bar,t.index)},l.prototype.classBars=function(t){return this.classShapes(t)+this.generateClass(N.bars,t.id)},l.prototype.classArc=function(t){return this.classShape(t.data)+this.generateClass(N.arc,t.data.id)},l.prototype.classArcs=function(t){return this.classShapes(t.data)+this.generateClass(N.arcs,t.data.id)},l.prototype.classArea=function(t){return this.classShape(t)+this.generateClass(N.area,t.id)},l.prototype.classAreas=function(t){return this.classShapes(t)+this.generateClass(N.areas,t.id)},l.prototype.classRegion=function(t,e){return this.generateClass(N.region,e)+" "+("class"in t?t.class:"")},l.prototype.classEvent=function(t){return this.generateClass(N.eventRect,t.index)},l.prototype.classTarget=function(t){var e=this.config.data_classes[t],i="";return e&&(i=" "+N.target+"-"+e),this.generateClass(N.target,t)+i},l.prototype.classFocus=function(t){return this.classFocused(t)+this.classDefocused(t)},l.prototype.classFocused=function(t){return" "+(0<=this.focusedTargetIds.indexOf(t.id)?N.focused:"")},l.prototype.classDefocused=function(t){return" "+(0<=this.defocusedTargetIds.indexOf(t.id)?N.defocused:"")},l.prototype.classChartText=function(t){return N.chartText+this.classTarget(t.id)},l.prototype.classChartLine=function(t){return N.chartLine+this.classTarget(t.id)},l.prototype.classChartBar=function(t){return N.chartBar+this.classTarget(t.id)},l.prototype.classChartArc=function(t){return N.chartArc+this.classTarget(t.data.id)},l.prototype.getTargetSelectorSuffix=function(t){return this.generateTargetClass(t).replace(/([?!@#$%^&*()_=+,.<>'":;\[\]\/|~`{}\\])/g,"\\$1")},l.prototype.selectorTarget=function(t,e){return(e||"")+"."+N.target+this.getTargetSelectorSuffix(t)},l.prototype.selectorTargets=function(t,e){var i=this;return(t=t||[]).length?t.map(function(t){return i.selectorTarget(t,e)}):null},l.prototype.selectorLegend=function(t){return"."+N.legendItem+this.getTargetSelectorSuffix(t)},l.prototype.selectorLegends=function(t){var e=this;return t&&t.length?t.map(function(t){return e.selectorLegend(t)}):null},l.prototype.getClipPath=function(t){return"url("+(0<=window.navigator.appVersion.toLowerCase().indexOf("msie 9.")?"":document.URL.split("#")[0])+"#"+t+")"},l.prototype.appendClip=function(t,e){return t.append("clipPath").attr("id",e).append("rect")},l.prototype.getAxisClipX=function(t){var e=Math.max(30,this.margin.left);return t?-(1+e):-(e-1)},l.prototype.getAxisClipY=function(t){return t?-20:-this.margin.top},l.prototype.getXAxisClipX=function(){return this.getAxisClipX(!this.config.axis_rotated)},l.prototype.getXAxisClipY=function(){return this.getAxisClipY(!this.config.axis_rotated)},l.prototype.getYAxisClipX=function(){return this.config.axis_y_inner?-1:this.getAxisClipX(this.config.axis_rotated)},l.prototype.getYAxisClipY=function(){return this.getAxisClipY(this.config.axis_rotated)},l.prototype.getAxisClipWidth=function(t){var e=Math.max(30,this.margin.left),i=Math.max(30,this.margin.right);return t?this.width+2+e+i:this.margin.left+20},l.prototype.getAxisClipHeight=function(t){return(t?this.margin.bottom:this.margin.top+this.height)+20},l.prototype.getXAxisClipWidth=function(){return this.getAxisClipWidth(!this.config.axis_rotated)},l.prototype.getXAxisClipHeight=function(){return this.getAxisClipHeight(!this.config.axis_rotated)},l.prototype.getYAxisClipWidth=function(){return this.getAxisClipWidth(this.config.axis_rotated)+(this.config.axis_y_inner?20:0)},l.prototype.getYAxisClipHeight=function(){return this.getAxisClipHeight(this.config.axis_rotated)},l.prototype.generateColor=function(){var t=this.config,e=this.d3,n=t.data_colors,r=C(t.color_pattern)?t.color_pattern:e.schemeCategory10,a=t.data_color,o=[];return function(t){var e,i=t.id||t.data&&t.data.id||t;return n[i]instanceof Function?e=n[i](t):n[i]?e=n[i]:(o.indexOf(i)<0&&o.push(i),e=r[o.indexOf(i)%r.length],n[i]=e),a instanceof Function?a(e,t):e}},l.prototype.generateLevelColor=function(){var t=this.config,n=t.color_pattern,e=t.color_threshold,r="value"===e.unit,a=e.values&&e.values.length?e.values:[],o=e.max||100;return C(e)&&C(n)?function(t){var e,i=n[n.length-1];for(e=0;e<a.length;e++)if((r?t:100*t/o)<a[e]){i=n[e];break}return i}:null},l.prototype.getDefaultConfig=function(){var e={bindto:"#chart",svg_classname:void 0,size_width:void 0,size_height:void 0,padding_left:void 0,padding_right:void 0,padding_top:void 0,padding_bottom:void 0,resize_auto:!0,zoom_enabled:!1,zoom_initialRange:void 0,zoom_type:"scroll",zoom_disableDefaultBehavior:!1,zoom_privileged:!1,zoom_rescale:!1,zoom_onzoom:function(){},zoom_onzoomstart:function(){},zoom_onzoomend:function(){},zoom_x_min:void 0,zoom_x_max:void 0,interaction_brighten:!0,interaction_enabled:!0,onmouseover:function(){},onmouseout:function(){},onresize:function(){},onresized:function(){},oninit:function(){},onrendered:function(){},transition_duration:350,data_epochs:"epochs",data_x:void 0,data_xs:{},data_xFormat:"%Y-%m-%d",data_xLocaltime:!0,data_xSort:!0,data_idConverter:function(t){return t},data_names:{},data_classes:{},data_groups:[],data_axes:{},data_type:void 0,data_types:{},data_labels:{},data_order:"desc",data_regions:{},data_color:void 0,data_colors:{},data_hide:!1,data_filter:void 0,data_selection_enabled:!1,data_selection_grouped:!1,data_selection_isselectable:function(){return!0},data_selection_multiple:!0,data_selection_draggable:!1,data_onclick:function(){},data_onmouseover:function(){},data_onmouseout:function(){},data_onselected:function(){},data_onunselected:function(){},data_url:void 0,data_headers:void 0,data_json:void 0,data_rows:void 0,data_columns:void 0,data_mimeType:void 0,data_keys:void 0,data_empty_label_text:"",subchart_show:!1,subchart_size_height:60,subchart_axis_x_show:!0,subchart_onbrush:function(){},color_pattern:[],color_threshold:{},legend_show:!0,legend_hide:!1,legend_position:"bottom",legend_inset_anchor:"top-left",legend_inset_x:10,legend_inset_y:0,legend_inset_step:void 0,legend_item_onclick:void 0,legend_item_onmouseover:void 0,legend_item_onmouseout:void 0,legend_equally:!1,legend_padding:0,legend_item_tile_width:10,legend_item_tile_height:10,axis_rotated:!1,axis_x_show:!0,axis_x_type:"indexed",axis_x_localtime:!0,axis_x_categories:[],axis_x_tick_centered:!1,axis_x_tick_format:void 0,axis_x_tick_culling:{},axis_x_tick_culling_max:10,axis_x_tick_count:void 0,axis_x_tick_fit:!0,axis_x_tick_values:null,axis_x_tick_rotate:0,axis_x_tick_outer:!0,axis_x_tick_multiline:!0,axis_x_tick_multilineMax:0,axis_x_tick_width:null,axis_x_max:void 0,axis_x_min:void 0,axis_x_padding:{},axis_x_height:void 0,axis_x_selection:void 0,axis_x_label:{},axis_x_inner:void 0,axis_y_show:!0,axis_y_type:void 0,axis_y_max:void 0,axis_y_min:void 0,axis_y_inverted:!1,axis_y_center:void 0,axis_y_inner:void 0,axis_y_label:{},axis_y_tick_format:void 0,axis_y_tick_outer:!0,axis_y_tick_values:null,axis_y_tick_rotate:0,axis_y_tick_count:void 0,axis_y_tick_time_type:void 0,axis_y_tick_time_interval:void 0,axis_y_padding:{},axis_y_default:void 0,axis_y2_show:!1,axis_y2_max:void 0,axis_y2_min:void 0,axis_y2_inverted:!1,axis_y2_center:void 0,axis_y2_inner:void 0,axis_y2_label:{},axis_y2_tick_format:void 0,axis_y2_tick_outer:!0,axis_y2_tick_values:null,axis_y2_tick_count:void 0,axis_y2_padding:{},axis_y2_default:void 0,grid_x_show:!1,grid_x_type:"tick",grid_x_lines:[],grid_y_show:!1,grid_y_lines:[],grid_y_ticks:10,grid_focus_show:!0,grid_lines_front:!0,point_show:!0,point_r:2.5,point_sensitivity:10,point_focus_expand_enabled:!0,point_focus_expand_r:void 0,point_select_r:void 0,line_connectNull:!1,line_step_type:"step",bar_width:void 0,bar_width_ratio:.6,bar_width_max:void 0,bar_zerobased:!0,bar_space:0,area_zerobased:!0,area_above:!1,pie_label_show:!0,pie_label_format:void 0,pie_label_threshold:.05,pie_label_ratio:void 0,pie_expand:{},pie_expand_duration:50,gauge_fullCircle:!1,gauge_label_show:!0,gauge_labelLine_show:!0,gauge_label_format:void 0,gauge_min:0,gauge_max:100,gauge_startingAngle:-1*Math.PI/2,gauge_label_extents:void 0,gauge_units:void 0,gauge_width:void 0,gauge_arcs_minWidth:5,gauge_expand:{},gauge_expand_duration:50,donut_label_show:!0,donut_label_format:void 0,donut_label_threshold:.05,donut_label_ratio:void 0,donut_width:void 0,donut_title:"",donut_expand:{},donut_expand_duration:50,spline_interpolation_type:"cardinal",stanford_lines:[],stanford_regions:[],stanford_texts:[],stanford_scaleMin:void 0,stanford_scaleMax:void 0,stanford_scaleWidth:void 0,stanford_scaleFormat:void 0,stanford_colors:void 0,stanford_padding:{top:0,right:0,bottom:0,left:0},regions:[],tooltip_show:!0,tooltip_grouped:!0,tooltip_order:void 0,tooltip_format_title:void 0,tooltip_format_name:void 0,tooltip_format_value:void 0,tooltip_horizontal:void 0,tooltip_position:void 0,tooltip_contents:function(t,e,i,n){return this.getTooltipContent?this.getTooltipContent(t,e,i,n):""},tooltip_init_show:!1,tooltip_init_x:0,tooltip_init_position:{top:"0px",left:"50px"},tooltip_onshow:function(){},tooltip_onhide:function(){},title_text:void 0,title_padding:{top:0,right:0,bottom:0,left:0},title_position:"top-center"};return Object.keys(this.additionalConfig).forEach(function(t){e[t]=this.additionalConfig[t]},this),e},l.prototype.additionalConfig={},l.prototype.loadConfig=function(e){var i,n,r,a=this.config;Object.keys(a).forEach(function(t){i=e,n=t.split("_"),r=function t(){var e=n.shift();return e&&i&&"object"===s(i)&&e in i?(i=i[e],t()):e?void 0:i}(),k(r)&&(a[t]=r)})},l.prototype.convertUrlToData=function(t,e,i,n,r){var a,o,s=this,c=e||"csv";o="json"===c?(a=s.d3.json,s.convertJsonToData):(a="tsv"===c?s.d3.tsv:s.d3.csv,s.convertXsvToData),a(t,i).then(function(t){r.call(s,o.call(s,t,n))}).catch(function(t){throw t})},l.prototype.convertXsvToData=function(t){var e=t.columns;return 0===t.length?{keys:e,rows:[e.reduce(function(t,e){return Object.assign(t,function(t,e,i){return e in t?Object.defineProperty(t,e,{value:i,enumerable:!0,configurable:!0,writable:!0}):t[e]=i,t}({},e,null))},{})]}:{keys:e,rows:[].concat(t)}},l.prototype.convertJsonToData=function(e,t){var r,a=this,o=[];return t?(t.x?(r=t.value.concat(t.x),a.config.data_x=t.x):r=t.value,o.push(r),e.forEach(function(i){var n=[];r.forEach(function(t){var e=a.findValueInJson(i,t);v(e)&&(e=null),n.push(e)}),o.push(n)}),a.convertRowsToData(o)):(Object.keys(e).forEach(function(t){o.push([t].concat(e[t]))}),a.convertColumnsToData(o))},l.prototype.findValueInJson=function(t,e){for(var i=(e=(e=e.replace(/\[(\w+)\]/g,".$1")).replace(/^\./,"")).split("."),n=0;n<i.length;++n){var r=i[n];if(!(r in t))return;t=t[r]}return t},l.prototype.convertRowsToData=function(t){for(var e=[],i=t[0],n=1;n<t.length;n++){for(var r={},a=0;a<t[n].length;a++){if(v(t[n][a]))throw new Error("Source data is missing a component at ("+n+","+a+")!");r[i[a]]=t[n][a]}e.push(r)}return{keys:i,rows:e}},l.prototype.convertColumnsToData=function(t){for(var e=[],i=[],n=0;n<t.length;n++){for(var r=t[n][0],a=1;a<t[n].length;a++){if(v(e[a-1])&&(e[a-1]={}),v(t[n][a]))throw new Error("Source data is missing a component at ("+n+","+a+")!");e[a-1][r]=t[n][a]}i.push(r)}return{keys:i,rows:e}},l.prototype.convertDataToTargets=function(t,n){var e,i,r,a,d,l=this,u=l.config;if(o(t)?a=Object.keys(t[0]):(a=t.keys,t=t.rows),r=a.filter(l.isX,l),l.isStanfordGraphType()){if(d=a.filter(l.isEpochs,l),i=a.filter(l.isNotXAndNotEpochs,l),1!==r.length||1!==d.length||1!==i.length)throw new Error("You must define the 'x' key name and the 'epochs' for Stanford Diagrams")}else i=a.filter(l.isNotX,l);return i.forEach(function(i){var e=l.getXKey(i);l.isCustomX()||l.isTimeSeries()?0<=r.indexOf(e)?l.data.xs[i]=(n&&l.data.xs[i]?l.data.xs[i]:[]).concat(t.map(function(t){return t[e]}).filter(P).map(function(t,e){return l.generateTargetX(t,i,e)})):u.data_x?l.data.xs[i]=l.getOtherTargetXs():C(u.data_xs)&&(l.data.xs[i]=l.getXValuesOfXKey(e,l.data.targets)):l.data.xs[i]=t.map(function(t,e){return e})}),i.forEach(function(t){if(!l.data.xs[t])throw new Error('x is not defined for id = "'+t+'".')}),(e=i.map(function(o,s){var c=u.data_idConverter(o);return{id:c,id_org:o,values:t.map(function(t,e){var i,n,r=t[l.getXKey(o)],a=null===t[o]||isNaN(t[o])?null:+t[o];return l.isCustomX()&&l.isCategorized()&&!v(r)?(0===s&&0===e&&(u.axis_x_categories=[]),-1===(i=u.axis_x_categories.indexOf(r))&&(i=u.axis_x_categories.length,u.axis_x_categories.push(r))):i=l.generateTargetX(r,o,e),(v(t[o])||l.data.xs[o].length<=e)&&(i=void 0),n={x:i,value:a,id:c},l.isStanfordGraphType()&&(n.epochs=t[d]),n}).filter(function(t){return k(t.x)})}})).forEach(function(t){var e;u.data_xSort&&(t.values=t.values.sort(function(t,e){return(t.x||0===t.x?t.x:1/0)-(e.x||0===e.x?e.x:1/0)})),e=0,t.values.forEach(function(t){t.index=e++}),l.data.xs[t.id].sort(function(t,e){return t-e})}),l.hasNegativeValue=l.hasNegativeValueInTargets(e),l.hasPositiveValue=l.hasPositiveValueInTargets(e),u.data_type&&l.setTargetType(l.mapToIds(e).filter(function(t){return!(t in u.data_types)}),u.data_type),e.forEach(function(t){l.addCache(t.id_org,t)}),e},l.prototype.isEpochs=function(t){var e=this.config;return e.data_epochs&&t===e.data_epochs},l.prototype.isX=function(t){var e=this.config;return e.data_x&&t===e.data_x||C(e.data_xs)&&function(e,i){var n=!1;return Object.keys(e).forEach(function(t){e[t]===i&&(n=!0)}),n}(e.data_xs,t)},l.prototype.isNotX=function(t){return!this.isX(t)},l.prototype.isNotXAndNotEpochs=function(t){return!this.isX(t)&&!this.isEpochs(t)},l.prototype.getXKey=function(t){var e=this.config;return e.data_x?e.data_x:C(e.data_xs)?e.data_xs[t]:null},l.prototype.getXValuesOfXKey=function(e,t){var i,n=this;return(t&&C(t)?n.mapToIds(t):[]).forEach(function(t){n.getXKey(t)===e&&(i=n.data.xs[t])}),i},l.prototype.getXValue=function(t,e){return t in this.data.xs&&this.data.xs[t]&&P(this.data.xs[t][e])?this.data.xs[t][e]:e},l.prototype.getOtherTargetXs=function(){var t=Object.keys(this.data.xs);return t.length?this.data.xs[t[0]]:null},l.prototype.getOtherTargetX=function(t){var e=this.getOtherTargetXs();return e&&t<e.length?e[t]:null},l.prototype.addXs=function(e){var i=this;Object.keys(e).forEach(function(t){i.config.data_xs[t]=e[t]})},l.prototype.addName=function(t){var e;return t&&(e=this.config.data_names[t.id],t.name=void 0!==e?e:t.id),t},l.prototype.getValueOnIndex=function(t,e){var i=t.filter(function(t){return t.index===e});return i.length?i[0]:null},l.prototype.updateTargetX=function(t,n){var r=this;t.forEach(function(i){i.values.forEach(function(t,e){t.x=r.generateTargetX(n[e],i.id,e)}),r.data.xs[i.id]=n})},l.prototype.updateTargetXs=function(t,e){var i=this;t.forEach(function(t){e[t.id]&&i.updateTargetX([t],e[t.id])})},l.prototype.generateTargetX=function(t,e,i){var n=this;return n.isTimeSeries()?t?n.parseDate(t):n.parseDate(n.getXValue(e,i)):n.isCustomX()&&!n.isCategorized()?P(t)?+t:n.getXValue(e,i):i},l.prototype.cloneTarget=function(t){return{id:t.id,id_org:t.id_org,values:t.values.map(function(t){return{x:t.x,value:t.value,id:t.id}})}},l.prototype.getMaxDataCount=function(){return this.d3.max(this.data.targets,function(t){return t.values.length})},l.prototype.mapToIds=function(t){return t.map(function(t){return t.id})},l.prototype.mapToTargetIds=function(t){return t?[].concat(t):this.mapToIds(this.data.targets)},l.prototype.hasTarget=function(t,e){var i,n=this.mapToIds(t);for(i=0;i<n.length;i++)if(n[i]===e)return!0;return!1},l.prototype.isTargetToShow=function(t){return this.hiddenTargetIds.indexOf(t)<0},l.prototype.isLegendToShow=function(t){return this.hiddenLegendIds.indexOf(t)<0},l.prototype.filterTargetsToShow=function(t){var e=this;return t.filter(function(t){return e.isTargetToShow(t.id)})},l.prototype.mapTargetsToUniqueXs=function(t){var e=this.d3.set(this.d3.merge(t.map(function(t){return t.values.map(function(t){return+t.x})}))).values();return(e=this.isTimeSeries()?e.map(function(t){return new Date(+t)}):e.map(function(t){return+t})).sort(function(t,e){return t<e?-1:e<t?1:e<=t?0:NaN})},l.prototype.addHiddenTargetIds=function(t){t=t instanceof Array?t:new Array(t);for(var e=0;e<t.length;e++)this.hiddenTargetIds.indexOf(t[e])<0&&(this.hiddenTargetIds=this.hiddenTargetIds.concat(t[e]))},l.prototype.removeHiddenTargetIds=function(e){this.hiddenTargetIds=this.hiddenTargetIds.filter(function(t){return e.indexOf(t)<0})},l.prototype.addHiddenLegendIds=function(t){t=t instanceof Array?t:new Array(t);for(var e=0;e<t.length;e++)this.hiddenLegendIds.indexOf(t[e])<0&&(this.hiddenLegendIds=this.hiddenLegendIds.concat(t[e]))},l.prototype.removeHiddenLegendIds=function(e){this.hiddenLegendIds=this.hiddenLegendIds.filter(function(t){return e.indexOf(t)<0})},l.prototype.getValuesAsIdKeyed=function(t){var i={};return t.forEach(function(e){i[e.id]=[],e.values.forEach(function(t){i[e.id].push(t.value)})}),i},l.prototype.checkValueInTargets=function(t,e){var i,n,r,a=Object.keys(t);for(i=0;i<a.length;i++)for(r=t[a[i]].values,n=0;n<r.length;n++)if(e(r[n].value))return!0;return!1},l.prototype.hasNegativeValueInTargets=function(t){return this.checkValueInTargets(t,function(t){return t<0})},l.prototype.hasPositiveValueInTargets=function(t){return this.checkValueInTargets(t,function(t){return 0<t})},l.prototype.isOrderDesc=function(){var t=this.config;return"string"==typeof t.data_order&&"desc"===t.data_order.toLowerCase()},l.prototype.isOrderAsc=function(){var t=this.config;return"string"==typeof t.data_order&&"asc"===t.data_order.toLowerCase()},l.prototype.getOrderFunction=function(){var t=this.config,r=this.isOrderAsc(),e=this.isOrderDesc();if(r||e){var a=function(t,e){return t+Math.abs(e.value)};return function(t,e){var i=t.values.reduce(a,0),n=e.values.reduce(a,0);return r?n-i:i-n}}if(h(t.data_order))return t.data_order;if(o(t.data_order)){var i=t.data_order;return function(t,e){return i.indexOf(t.id)-i.indexOf(e.id)}}},l.prototype.orderTargets=function(t){var e=this.getOrderFunction();return e&&t.sort(e),t},l.prototype.filterByX=function(t,e){return this.d3.merge(t.map(function(t){return t.values})).filter(function(t){return t.x-e==0})},l.prototype.filterRemoveNull=function(t){return t.filter(function(t){return P(t.value)})},l.prototype.filterByXDomain=function(t,e){return t.map(function(t){return{id:t.id,id_org:t.id_org,values:t.values.filter(function(t){return e[0]<=t.x&&t.x<=e[1]})}})},l.prototype.hasDataLabel=function(){var t=this.config;return!("boolean"!=typeof t.data_labels||!t.data_labels)||!("object"!==s(t.data_labels)||!C(t.data_labels))},l.prototype.getDataLabelLength=function(t,e,i){var n=this,r=[0,0];return n.selectChart.select("svg").selectAll(".dummy").data([t,e]).enter().append("text").text(function(t){return n.dataLabelFormat(t.id)(t)}).each(function(t,e){r[e]=1.3*this.getBoundingClientRect()[i]}).remove(),r},l.prototype.isNoneArc=function(t){return this.hasTarget(this.data.targets,t.id)},l.prototype.isArc=function(t){return"data"in t&&this.hasTarget(this.data.targets,t.data.id)},l.prototype.findClosestFromTargets=function(t,e){var i,n=this;return i=t.map(function(t){return n.findClosest(t.values,e)}),n.findClosest(i,e)},l.prototype.findClosest=function(t,i){var n,r=this,a=r.config.point_sensitivity;return t.filter(function(t){return t&&r.isBarType(t.id)}).forEach(function(t){var e=r.main.select("."+N.bars+r.getTargetSelectorSuffix(t.id)+" ."+N.bar+"-"+t.index).node();!n&&r.isWithinBar(r.d3.mouse(e),e)&&(n=t)}),t.filter(function(t){return t&&!r.isBarType(t.id)}).forEach(function(t){var e=r.config.tooltip_horizontal?r.horizontalDistance(t,i):r.dist(t,i);e<a&&(a=e,n=t)}),n},l.prototype.dist=function(t,e){var i=this.config,n=i.axis_rotated?1:0,r=i.axis_rotated?0:1,a=this.circleY(t,t.index),o=this.x(t.x);return Math.sqrt(Math.pow(o-e[n],2)+Math.pow(a-e[r],2))},l.prototype.horizontalDistance=function(t,e){var i=this.config.axis_rotated?1:0,n=this.x(t.x);return Math.abs(n-e[i])},l.prototype.convertValuesToStep=function(t){var e,i=[].concat(t);if(!this.isCategorized())return t;for(e=t.length+1;0<e;e--)i[e]=i[e-1];return i[0]={x:i[0].x-1,value:i[0].value,id:i[0].id},i[t.length+1]={x:i[t.length].x+1,value:i[t.length].value,id:i[t.length].id},i},l.prototype.updateDataAttributes=function(t,e){var i=this.config["data_"+t];return void 0===e||(Object.keys(e).forEach(function(t){i[t]=e[t]}),this.redraw({withLegend:!0})),i},l.prototype.load=function(i,n){var r=this;i&&(n.filter&&(i=i.filter(n.filter)),(n.type||n.types)&&i.forEach(function(t){var e=n.types&&n.types[t.id]?n.types[t.id]:n.type;r.setTargetType(t.id,e)}),r.data.targets.forEach(function(t){for(var e=0;e<i.length;e++)if(t.id===i[e].id){t.values=i[e].values,i.splice(e,1);break}}),r.data.targets=r.data.targets.concat(i)),r.updateTargets(r.data.targets),r.redraw({withUpdateOrgXDomain:!0,withUpdateXDomain:!0,withLegend:!0}),n.done&&n.done()},l.prototype.loadFromArgs=function(e){var i=this;e.data?i.load(i.convertDataToTargets(e.data),e):e.url?i.convertUrlToData(e.url,e.mimeType,e.headers,e.keys,function(t){i.load(i.convertDataToTargets(t),e)}):e.json?i.load(i.convertDataToTargets(i.convertJsonToData(e.json,e.keys)),e):e.rows?i.load(i.convertDataToTargets(i.convertRowsToData(e.rows)),e):e.columns?i.load(i.convertDataToTargets(i.convertColumnsToData(e.columns)),e):i.load(null,e)},l.prototype.unload=function(t,e){var i=this;e||(e=function(){}),(t=t.filter(function(t){return i.hasTarget(i.data.targets,t)}))&&0!==t.length?(i.svg.selectAll(t.map(function(t){return i.selectorTarget(t)})).transition().style("opacity",0).remove().call(i.endall,e),t.forEach(function(e){i.withoutFadeIn[e]=!1,i.legend&&i.legend.selectAll("."+N.legendItem+i.getTargetSelectorSuffix(e)).remove(),i.data.targets=i.data.targets.filter(function(t){return t.id!==e})})):e()},l.prototype.getYDomainMin=function(t){var e,i,n,r,a,o,s=this,c=s.config,d=s.mapToIds(t),l=s.getValuesAsIdKeyed(t);if(0<c.data_groups.length)for(o=s.hasNegativeValueInTargets(t),e=0;e<c.data_groups.length;e++)if(0!==(r=c.data_groups[e].filter(function(t){return 0<=d.indexOf(t)})).length)for(n=r[0],o&&l[n]&&l[n].forEach(function(t,e){l[n][e]=t<0?t:0}),i=1;i<r.length;i++)a=r[i],l[a]&&l[a].forEach(function(t,e){s.axis.getId(a)!==s.axis.getId(n)||!l[n]||o&&0<+t||(l[n][e]+=+t)});return s.d3.min(Object.keys(l).map(function(t){return s.d3.min(l[t])}))},l.prototype.getYDomainMax=function(t){var e,i,n,r,a,o,s=this,c=s.config,d=s.mapToIds(t),l=s.getValuesAsIdKeyed(t);if(0<c.data_groups.length)for(o=s.hasPositiveValueInTargets(t),e=0;e<c.data_groups.length;e++)if(0!==(r=c.data_groups[e].filter(function(t){return 0<=d.indexOf(t)})).length)for(n=r[0],o&&l[n]&&l[n].forEach(function(t,e){l[n][e]=0<t?t:0}),i=1;i<r.length;i++)a=r[i],l[a]&&l[a].forEach(function(t,e){s.axis.getId(a)!==s.axis.getId(n)||!l[n]||o&&+t<0||(l[n][e]+=+t)});return s.d3.max(Object.keys(l).map(function(t){return s.d3.max(l[t])}))},l.prototype.getYDomain=function(t,e,i){var n,r,a,o,s,c,d,l,u,h,g=this,p=g.config,f=t.filter(function(t){return g.axis.getId(t.id)===e}),_=i?g.filterByXDomain(f,i):f,x="y2"===e?p.axis_y2_min:p.axis_y_min,y="y2"===e?p.axis_y2_max:p.axis_y_max,m=g.getYDomainMin(_),S=g.getYDomainMax(_),w="y2"===e?p.axis_y2_center:p.axis_y_center,v=g.hasType("bar",_)&&p.bar_zerobased||g.hasType("area",_)&&p.area_zerobased,b="y2"===e?p.axis_y2_inverted:p.axis_y_inverted,T=g.hasDataLabel()&&p.axis_rotated,A=g.hasDataLabel()&&!p.axis_rotated;return m=P(x)?x:P(y)?m<y?m:y-10:m,S=P(y)?y:P(x)?x<S?S:x+10:S,0===_.length?"y2"===e?g.y2.domain():g.y.domain():(isNaN(m)&&(m=0),isNaN(S)&&(S=m),m===S&&(m<0?S=0:m=0),u=0<=m&&0<=S,h=m<=0&&S<=0,(P(x)&&u||P(y)&&h)&&(v=!1),v&&(u&&(m=0),h&&(S=0)),a=o=.1*(r=Math.abs(S-m)),void 0!==w&&(S=w+(s=Math.max(Math.abs(m),Math.abs(S))),m=w-s),T?(c=g.getDataLabelLength(m,S,"width"),d=R(g.y.range()),a+=r*((l=[c[0]/d,c[1]/d])[1]/(1-l[0]-l[1])),o+=r*(l[0]/(1-l[0]-l[1]))):A&&(c=g.getDataLabelLength(m,S,"height"),a+=g.axis.convertPixelsToAxisPadding(c[1],r),o+=g.axis.convertPixelsToAxisPadding(c[0],r)),"y"===e&&C(p.axis_y_padding)&&(a=g.axis.getPadding(p.axis_y_padding,"top",a,r),o=g.axis.getPadding(p.axis_y_padding,"bottom",o,r)),"y2"===e&&C(p.axis_y2_padding)&&(a=g.axis.getPadding(p.axis_y2_padding,"top",a,r),o=g.axis.getPadding(p.axis_y2_padding,"bottom",o,r)),v&&(u&&(o=m),h&&(a=-S)),n=[m-o,S+a],b?n.reverse():n)},l.prototype.getXDomainMin=function(t){var e=this,i=e.config;return k(i.axis_x_min)?e.isTimeSeries()?this.parseDate(i.axis_x_min):i.axis_x_min:e.d3.min(t,function(t){return e.d3.min(t.values,function(t){return t.x})})},l.prototype.getXDomainMax=function(t){var e=this,i=e.config;return k(i.axis_x_max)?e.isTimeSeries()?this.parseDate(i.axis_x_max):i.axis_x_max:e.d3.max(t,function(t){return e.d3.max(t.values,function(t){return t.x})})},l.prototype.getXDomainPadding=function(t){var e,i,n,r,a=this.config,o=t[1]-t[0];return i=this.isCategorized()?0:this.hasType("bar")?1<(e=this.getMaxDataCount())?o/(e-1)/2:.5:.01*o,"object"===s(a.axis_x_padding)&&C(a.axis_x_padding)?(n=P(a.axis_x_padding.left)?a.axis_x_padding.left:i,r=P(a.axis_x_padding.right)?a.axis_x_padding.right:i):n=r="number"==typeof a.axis_x_padding?a.axis_x_padding:i,{left:n,right:r}},l.prototype.getXDomain=function(t){var e=this,i=[e.getXDomainMin(t),e.getXDomainMax(t)],n=i[0],r=i[1],a=e.getXDomainPadding(i),o=0,s=0;return n-r!=0||e.isCategorized()||(r=e.isTimeSeries()?(n=new Date(.5*n.getTime()),new Date(1.5*r.getTime())):(n=0===n?1:.5*n,0===r?-1:1.5*r)),(n||0===n)&&(o=e.isTimeSeries()?new Date(n.getTime()-a.left):n-a.left),(r||0===r)&&(s=e.isTimeSeries()?new Date(r.getTime()+a.right):r+a.right),[o,s]},l.prototype.updateXDomain=function(t,e,i,n,r){var a=this,o=a.config;return i&&(a.x.domain(r||a.d3.extent(a.getXDomain(t))),a.orgXDomain=a.x.domain(),o.zoom_enabled&&a.zoom.update(),a.subX.domain(a.x.domain()),a.brush&&a.brush.updateScale(a.subX)),e&&a.x.domain(r||(!a.brush||a.brush.empty()?a.orgXDomain:a.brush.selectionAsValue())),n&&a.x.domain(a.trimXDomain(a.x.orgDomain())),a.x.domain()},l.prototype.trimXDomain=function(t){var e=this.getZoomDomain(),i=e[0],n=e[1];return t[0]<=i&&(t[1]=+t[1]+(i-t[0]),t[0]=i),n<=t[1]&&(t[0]=+t[0]-(t[1]-n),t[1]=n),t},l.prototype.drag=function(t){var e,i,n,r,h,g,p,f,_=this,a=_.config,o=_.main,x=_.d3;_.hasArcType()||a.data_selection_enabled&&a.data_selection_multiple&&(e=_.dragStart[0],i=_.dragStart[1],n=t[0],r=t[1],h=Math.min(e,n),g=Math.max(e,n),p=a.data_selection_grouped?_.margin.top:Math.min(i,r),f=a.data_selection_grouped?_.height:Math.max(i,r),o.select("."+N.dragarea).attr("x",h).attr("y",p).attr("width",g-h).attr("height",f-p),o.selectAll("."+N.shapes).selectAll("."+N.shape).filter(function(t){return a.data_selection_isselectable(t)}).each(function(t,e){var i,n,r,a,o,s,c=x.select(this),d=c.classed(N.SELECTED),l=c.classed(N.INCLUDED),u=!1;if(c.classed(N.circle))i=1*c.attr("cx"),n=1*c.attr("cy"),o=_.togglePoint,u=h<i&&i<g&&p<n&&n<f;else{if(!c.classed(N.bar))return;i=(s=y(this)).x,n=s.y,r=s.width,a=s.height,o=_.togglePath,u=!(g<i||i+r<h||f<n||n+a<p)}u^l&&(c.classed(N.INCLUDED,!l),c.classed(N.SELECTED,!d),o.call(_,!d,c,t,e))}))},l.prototype.dragstart=function(t){var e=this,i=e.config;e.hasArcType()||i.data_selection_enabled&&(e.dragStart=t,e.main.select("."+N.chart).append("rect").attr("class",N.dragarea).style("opacity",.1),e.dragging=!0)},l.prototype.dragend=function(){var t=this,e=t.config;t.hasArcType()||e.data_selection_enabled&&(t.main.select("."+N.dragarea).transition().duration(100).style("opacity",0).remove(),t.main.selectAll("."+N.shape).classed(N.INCLUDED,!1),t.dragging=!1)},l.prototype.getYFormat=function(t){var n=this,r=t&&!n.hasType("gauge")?n.defaultArcValueFormat:n.yFormat,a=t&&!n.hasType("gauge")?n.defaultArcValueFormat:n.y2Format;return function(t,e,i){return("y2"===n.axis.getId(i)?a:r).call(n,t,e)}},l.prototype.yFormat=function(t){var e=this.config;return(e.axis_y_tick_format?e.axis_y_tick_format:this.defaultValueFormat)(t)},l.prototype.y2Format=function(t){var e=this.config;return(e.axis_y2_tick_format?e.axis_y2_tick_format:this.defaultValueFormat)(t)},l.prototype.defaultValueFormat=function(t){return P(t)?+t:""},l.prototype.defaultArcValueFormat=function(t,e){return(100*e).toFixed(1)+"%"},l.prototype.dataLabelFormat=function(t){var e=this.config.data_labels,i=function(t){return P(t)?+t:""};return"function"==typeof e.format?e.format:"object"===s(e.format)?e.format[t]?!0===e.format[t]?i:e.format[t]:function(){return""}:i},l.prototype.initGrid=function(){var t=this,e=t.config,i=t.d3;t.grid=t.main.append("g").attr("clip-path",t.clipPathForGrid).attr("class",N.grid),e.grid_x_show&&t.grid.append("g").attr("class",N.xgrids),e.grid_y_show&&t.grid.append("g").attr("class",N.ygrids),e.grid_focus_show&&t.grid.append("g").attr("class",N.xgridFocus).append("line").attr("class",N.xgridFocus),t.xgrid=i.selectAll([]),e.grid_lines_front||t.initGridLines()},l.prototype.initGridLines=function(){var t=this,e=t.d3;t.gridLines=t.main.append("g").attr("clip-path",t.clipPathForGrid).attr("class",N.grid+" "+N.gridLines),t.gridLines.append("g").attr("class",N.xgridLines),t.gridLines.append("g").attr("class",N.ygridLines),t.xgridLines=e.selectAll([])},l.prototype.updateXGrid=function(t){var e=this,i=e.config,n=e.d3,r=e.generateGridData(i.grid_x_type,e.x),a=e.isCategorized()?e.xAxis.tickOffset():0;e.xgridAttr=i.axis_rotated?{x1:0,x2:e.width,y1:function(t){return e.x(t)-a},y2:function(t){return e.x(t)-a}}:{x1:function(t){return e.x(t)+a},x2:function(t){return e.x(t)+a},y1:0,y2:e.height},e.xgridAttr.opacity=function(){return+n.select(this).attr(i.axis_rotated?"y1":"x1")===(i.axis_rotated?e.height:0)?0:1};var o=e.main.select("."+N.xgrids).selectAll("."+N.xgrid).data(r),s=o.enter().append("line").attr("class",N.xgrid).attr("x1",e.xgridAttr.x1).attr("x2",e.xgridAttr.x2).attr("y1",e.xgridAttr.y1).attr("y2",e.xgridAttr.y2).style("opacity",0);e.xgrid=s.merge(o),t||e.xgrid.attr("x1",e.xgridAttr.x1).attr("x2",e.xgridAttr.x2).attr("y1",e.xgridAttr.y1).attr("y2",e.xgridAttr.y2).style("opacity",e.xgridAttr.opacity),o.exit().remove()},l.prototype.updateYGrid=function(){var t=this,e=t.config,i=t.yAxis.tickValues()||t.y.ticks(e.grid_y_ticks),n=t.main.select("."+N.ygrids).selectAll("."+N.ygrid).data(i),r=n.enter().append("line").attr("class",N.ygrid);t.ygrid=r.merge(n),t.ygrid.attr("x1",e.axis_rotated?t.y:0).attr("x2",e.axis_rotated?t.y:t.width).attr("y1",e.axis_rotated?0:t.y).attr("y2",e.axis_rotated?t.height:t.y),n.exit().remove(),t.smoothLines(t.ygrid,"grid")},l.prototype.gridTextAnchor=function(t){return t.position?t.position:"end"},l.prototype.gridTextDx=function(t){return"start"===t.position?4:"middle"===t.position?0:-4},l.prototype.xGridTextX=function(t){return"start"===t.position?-this.height:"middle"===t.position?-this.height/2:0},l.prototype.yGridTextX=function(t){return"start"===t.position?0:"middle"===t.position?this.width/2:this.width},l.prototype.updateGrid=function(t){var e,i,n,r,a=this,o=a.main,s=a.config,c=a.xv.bind(a),d=a.yv.bind(a),l=a.xGridTextX.bind(a),u=a.yGridTextX.bind(a);a.grid.style("visibility",a.hasArcType()?"hidden":"visible"),o.select("line."+N.xgridFocus).style("visibility","hidden"),s.grid_x_show&&a.updateXGrid(),(i=(e=o.select("."+N.xgridLines).selectAll("."+N.xgridLine).data(s.grid_x_lines)).enter().append("g").attr("class",function(t){return N.xgridLine+(t.class?" "+t.class:"")})).append("line").attr("x1",s.axis_rotated?0:c).attr("x2",s.axis_rotated?a.width:c).attr("y1",s.axis_rotated?c:0).attr("y2",s.axis_rotated?c:a.height).style("opacity",0),i.append("text").attr("text-anchor",a.gridTextAnchor).attr("transform",s.axis_rotated?"":"rotate(-90)").attr("x",s.axis_rotated?u:l).attr("y",c).attr("dx",a.gridTextDx).attr("dy",-5).style("opacity",0),a.xgridLines=i.merge(e),e.exit().transition().duration(t).style("opacity",0).remove(),s.grid_y_show&&a.updateYGrid(),(r=(n=o.select("."+N.ygridLines).selectAll("."+N.ygridLine).data(s.grid_y_lines)).enter().append("g").attr("class",function(t){return N.ygridLine+(t.class?" "+t.class:"")})).append("line").attr("x1",s.axis_rotated?d:0).attr("x2",s.axis_rotated?d:a.width).attr("y1",s.axis_rotated?0:d).attr("y2",s.axis_rotated?a.height:d).style("opacity",0),r.append("text").attr("text-anchor",a.gridTextAnchor).attr("transform",s.axis_rotated?"rotate(-90)":"").attr("x",s.axis_rotated?l:u).attr("y",d).attr("dx",a.gridTextDx).attr("dy",-5).style("opacity",0),a.ygridLines=r.merge(n),a.ygridLines.select("line").transition().duration(t).attr("x1",s.axis_rotated?d:0).attr("x2",s.axis_rotated?d:a.width).attr("y1",s.axis_rotated?0:d).attr("y2",s.axis_rotated?a.height:d).style("opacity",1),a.ygridLines.select("text").transition().duration(t).attr("x",s.axis_rotated?a.xGridTextX.bind(a):a.yGridTextX.bind(a)).attr("y",d).text(function(t){return t.text}).style("opacity",1),n.exit().transition().duration(t).style("opacity",0).remove()},l.prototype.redrawGrid=function(t,e){var i=this,n=i.config,r=i.xv.bind(i),a=i.xgridLines.select("line"),o=i.xgridLines.select("text");return[(t?a.transition(e):a).attr("x1",n.axis_rotated?0:r).attr("x2",n.axis_rotated?i.width:r).attr("y1",n.axis_rotated?r:0).attr("y2",n.axis_rotated?r:i.height).style("opacity",1),(t?o.transition(e):o).attr("x",n.axis_rotated?i.yGridTextX.bind(i):i.xGridTextX.bind(i)).attr("y",r).text(function(t){return t.text}).style("opacity",1)]},l.prototype.showXGridFocus=function(t){var e=this,i=e.config,n=t.filter(function(t){return t&&P(t.value)}),r=e.main.selectAll("line."+N.xgridFocus),a=e.xx.bind(e);i.tooltip_show&&(e.hasType("scatter")||e.hasType("stanford")||e.hasArcType()||(r.style("visibility","visible").data([n[0]]).attr(i.axis_rotated?"y1":"x1",a).attr(i.axis_rotated?"y2":"x2",a),e.smoothLines(r,"grid")))},l.prototype.hideXGridFocus=function(){this.main.select("line."+N.xgridFocus).style("visibility","hidden")},l.prototype.updateXgridFocus=function(){var t=this.config;this.main.select("line."+N.xgridFocus).attr("x1",t.axis_rotated?0:-10).attr("x2",t.axis_rotated?this.width:-10).attr("y1",t.axis_rotated?-10:0).attr("y2",t.axis_rotated?-10:this.height)},l.prototype.generateGridData=function(t,e){var i,n,r,a,o=[],s=this.main.select("."+N.axisX).selectAll(".tick").size();if("year"===t)for(n=(i=this.getXDomain())[0].getFullYear(),r=i[1].getFullYear(),a=n;a<=r;a++)o.push(new Date(a+"-01-01 00:00:00"));else(o=e.ticks(10)).length>s&&(o=o.filter(function(t){return(""+t).indexOf(".")<0}));return o},l.prototype.getGridFilterToRemove=function(t){return t?function(e){var i=!1;return[].concat(t).forEach(function(t){("value"in t&&e.value===t.value||"class"in t&&e.class===t.class)&&(i=!0)}),i}:function(){return!0}},l.prototype.removeGridLines=function(t,e){var i=this.config,n=this.getGridFilterToRemove(t),r=function(t){return!n(t)},a=e?N.xgridLines:N.ygridLines,o=e?N.xgridLine:N.ygridLine;this.main.select("."+a).selectAll("."+o).filter(n).transition().duration(i.transition_duration).style("opacity",0).remove(),e?i.grid_x_lines=i.grid_x_lines.filter(r):i.grid_y_lines=i.grid_y_lines.filter(r)},l.prototype.initEventRect=function(){var t=this,e=t.config;t.main.select("."+N.chart).append("g").attr("class",N.eventRects).style("fill-opacity",0),t.eventRect=t.main.select("."+N.eventRects).append("rect").attr("class",N.eventRect),e.zoom_enabled&&t.zoom&&(t.eventRect.call(t.zoom).on("dblclick.zoom",null),e.zoom_initialRange&&t.eventRect.transition().duration(0).call(t.zoom.transform,t.zoomTransform(e.zoom_initialRange)))},l.prototype.redrawEventRect=function(){var t,e,r=this,a=r.d3,o=r.config;function s(){r.svg.select("."+N.eventRect).style("cursor",null),r.hideXGridFocus(),r.hideTooltip(),r.unexpandCircles(),r.unexpandBars()}t=r.width,e=r.height,r.main.select("."+N.eventRects).style("cursor",o.zoom_enabled?o.axis_rotated?"ns-resize":"ew-resize":null),r.eventRect.attr("x",0).attr("y",0).attr("width",t).attr("height",e).on("mouseout",o.interaction_enabled?function(){o&&(r.hasArcType()||s())}:null).on("mousemove",o.interaction_enabled?function(){var t,e,i,n;r.dragging||r.hasArcType(t)||(t=r.filterTargetsToShow(r.data.targets),e=a.mouse(this),i=r.findClosestFromTargets(t,e),!r.mouseover||i&&i.id===r.mouseover.id||(o.data_onmouseout.call(r.api,r.mouseover),r.mouseover=void 0),i?(n=(r.isScatterOrStanfordType(i)||!o.tooltip_grouped?[i]:r.filterByX(t,i.x)).map(function(t){return r.addName(t)}),r.showTooltip(n,this),o.point_focus_expand_enabled&&(r.unexpandCircles(),n.forEach(function(t){r.expandCircles(t.index,t.id,!1)})),r.expandBars(i.index,i.id,!0),r.showXGridFocus(n),(r.isBarType(i.id)||r.dist(i,e)<o.point_sensitivity)&&(r.svg.select("."+N.eventRect).style("cursor","pointer"),r.mouseover||(o.data_onmouseover.call(r.api,i),r.mouseover=i))):s())}:null).on("click",o.interaction_enabled?function(){var t,e,i;r.hasArcType(t)||(t=r.filterTargetsToShow(r.data.targets),e=a.mouse(this),(i=r.findClosestFromTargets(t,e))&&(r.isBarType(i.id)||r.dist(i,e)<o.point_sensitivity)&&(r.isScatterOrStanfordType(i)||!o.data_selection_grouped?[i]:r.filterByX(t,i.x)).forEach(function(t){r.main.selectAll("."+N.shapes+r.getTargetSelectorSuffix(t.id)).selectAll("."+N.shape+"-"+t.index).each(function(){(o.data_selection_grouped||r.isWithinShape(this,t))&&(r.toggleShape(this,t,t.index),o.data_onclick.call(r.api,t,this))})}))}:null).call(o.interaction_enabled&&o.data_selection_draggable&&r.drag?a.drag().on("drag",function(){r.drag(a.mouse(this))}).on("start",function(){r.dragstart(a.mouse(this))}).on("end",function(){r.dragend()}):function(){})},l.prototype.getMousePosition=function(t){return[this.x(t.x),this.getYScale(t.id)(t.value)]},l.prototype.dispatchEvent=function(t,e){var i="."+N.eventRect,n=this.main.select(i).node(),r=n.getBoundingClientRect(),a=r.left+(e?e[0]:0),o=r.top+(e?e[1]:0),s=document.createEvent("MouseEvents");s.initMouseEvent(t,!0,!0,window,0,a,o,a,o,!1,!1,!1,!1,0,null),n.dispatchEvent(s)},l.prototype.initLegend=function(){var t=this;if(t.legendItemTextBox={},t.legendHasRendered=!1,t.legend=t.svg.append("g").attr("transform",t.getTranslate("legend")),!t.config.legend_show)return t.legend.style("visibility","hidden"),void(t.hiddenLegendIds=t.mapToIds(t.data.targets));t.updateLegendWithDefaults()},l.prototype.updateLegendWithDefaults=function(){this.updateLegend(this.mapToIds(this.data.targets),{withTransform:!1,withTransitionForTransform:!1,withTransition:!1})},l.prototype.updateSizeForLegend=function(t,e){var i=this,n=i.config,r={top:i.isLegendTop?i.getCurrentPaddingTop()+n.legend_inset_y+5.5:i.currentHeight-t-i.getCurrentPaddingBottom()-n.legend_inset_y,left:i.isLegendLeft?i.getCurrentPaddingLeft()+n.legend_inset_x+.5:i.currentWidth-e-i.getCurrentPaddingRight()-n.legend_inset_x+.5};i.margin3={top:i.isLegendRight?0:i.isLegendInset?r.top:i.currentHeight-t,right:NaN,bottom:0,left:i.isLegendRight?i.currentWidth-e:i.isLegendInset?r.left:0}},l.prototype.transformLegend=function(t){(t?this.legend.transition():this.legend).attr("transform",this.getTranslate("legend"))},l.prototype.updateLegendStep=function(t){this.legendStep=t},l.prototype.updateLegendItemWidth=function(t){this.legendItemWidth=t},l.prototype.updateLegendItemHeight=function(t){this.legendItemHeight=t},l.prototype.getLegendWidth=function(){var t=this;return t.config.legend_show?t.isLegendRight||t.isLegendInset?t.legendItemWidth*(t.legendStep+1):t.currentWidth:0},l.prototype.getLegendHeight=function(){var t=this,e=0;return t.config.legend_show&&(e=t.isLegendRight?t.currentHeight:Math.max(20,t.legendItemHeight)*(t.legendStep+1)),e},l.prototype.opacityForLegend=function(t){return t.classed(N.legendItemHidden)?null:1},l.prototype.opacityForUnfocusedLegend=function(t){return t.classed(N.legendItemHidden)?null:.3},l.prototype.toggleFocusLegend=function(e,t){var i=this;e=i.mapToTargetIds(e),i.legend.selectAll("."+N.legendItem).filter(function(t){return 0<=e.indexOf(t)}).classed(N.legendItemFocused,t).transition().duration(100).style("opacity",function(){return(t?i.opacityForLegend:i.opacityForUnfocusedLegend).call(i,i.d3.select(this))})},l.prototype.revertLegend=function(){var t=this,e=t.d3;t.legend.selectAll("."+N.legendItem).classed(N.legendItemFocused,!1).transition().duration(100).style("opacity",function(){return t.opacityForLegend(e.select(this))})},l.prototype.showLegend=function(t){var e=this,i=e.config;i.legend_show||(i.legend_show=!0,e.legend.style("visibility","visible"),e.legendHasRendered||e.updateLegendWithDefaults()),e.removeHiddenLegendIds(t),e.legend.selectAll(e.selectorLegends(t)).style("visibility","visible").transition().style("opacity",function(){return e.opacityForLegend(e.d3.select(this))})},l.prototype.hideLegend=function(t){var e=this,i=e.config;i.legend_show&&u(t)&&(i.legend_show=!1,e.legend.style("visibility","hidden")),e.addHiddenLegendIds(t),e.legend.selectAll(e.selectorLegends(t)).style("opacity",0).style("visibility","hidden")},l.prototype.clearLegendItemTextBoxCache=function(){this.legendItemTextBox={}},l.prototype.updateLegend=function(g,t,e){var i,n,r,a,o,s,c,d,l,u,h,p,f,_,x,y,m=this,S=m.config,w=4,v=10,b=0,T=0,A=10,P=S.legend_item_tile_width+5,C=0,L={},V={},G={},E=[0],O={},I=0;function R(t,e,i){var n,r,a=0===i,o=i===g.length-1,s=function(t,e){return m.legendItemTextBox[e]||(m.legendItemTextBox[e]=m.getTextRect(t.textContent,N.legendItem,t)),m.legendItemTextBox[e]}(t,e),c=s.width+P+(!o||m.isLegendRight||m.isLegendInset?v:0)+S.legend_padding,d=s.height+w,l=m.isLegendRight||m.isLegendInset?d:c,u=m.isLegendRight||m.isLegendInset?m.getLegendHeight():m.getLegendWidth();function h(t,e){e||(n=(u-C-l)/2)<A&&(n=(u-l)/2,C=0,I++),O[t]=I,E[I]=m.isLegendInset?10:n,L[t]=C,C+=l}a&&(T=b=I=C=0),!S.legend_show||m.isLegendToShow(e)?(V[e]=c,G[e]=d,(!b||b<=c)&&(b=c),(!T||T<=d)&&(T=d),r=m.isLegendRight||m.isLegendInset?T:b,S.legend_equally?(Object.keys(V).forEach(function(t){V[t]=b}),Object.keys(G).forEach(function(t){G[t]=T}),(n=(u-r*g.length)/2)<A?(I=C=0,g.forEach(function(t){h(t)})):h(e,!0)):h(e)):V[e]=G[e]=O[e]=L[e]=0}g=g.filter(function(t){return!k(S.data_names[t])||null!==S.data_names[t]}),h=Y(t=t||{},"withTransition",!0),p=Y(t,"withTransitionForTransform",!0),m.isLegendInset&&(I=S.legend_inset_step?S.legend_inset_step:g.length,m.updateLegendStep(I)),a=m.isLegendRight?(i=function(t){return b*O[t]},function(t){return E[O[t]]+L[t]}):m.isLegendInset?(i=function(t){return b*O[t]+10},function(t){return E[O[t]]+L[t]}):(i=function(t){return E[O[t]]+L[t]},function(t){return T*O[t]}),n=function(t,e){return i(t,e)+4+S.legend_item_tile_width},o=function(t,e){return a(t,e)+9},r=function(t,e){return i(t,e)},s=function(t,e){return a(t,e)-5},c=function(t,e){return i(t,e)-2},d=function(t,e){return i(t,e)-2+S.legend_item_tile_width},l=function(t,e){return a(t,e)+4},(u=m.legend.selectAll("."+N.legendItem).data(g).enter().append("g").attr("class",function(t){return m.generateClass(N.legendItem,t)}).style("visibility",function(t){return m.isLegendToShow(t)?"visible":"hidden"}).style("cursor","pointer").on("click",function(t){S.legend_item_onclick?S.legend_item_onclick.call(m,t):m.d3.event.altKey?(m.api.hide(),m.api.show(t)):(m.api.toggle(t),m.isTargetToShow(t)?m.api.focus(t):m.api.revert())}).on("mouseover",function(t){S.legend_item_onmouseover?S.legend_item_onmouseover.call(m,t):(m.d3.select(this).classed(N.legendItemFocused,!0),!m.transiting&&m.isTargetToShow(t)&&m.api.focus(t))}).on("mouseout",function(t){S.legend_item_onmouseout?S.legend_item_onmouseout.call(m,t):(m.d3.select(this).classed(N.legendItemFocused,!1),m.api.revert())})).append("text").text(function(t){return k(S.data_names[t])?S.data_names[t]:t}).each(function(t,e){R(this,t,e)}).style("pointer-events","none").attr("x",m.isLegendRight||m.isLegendInset?n:-200).attr("y",m.isLegendRight||m.isLegendInset?-200:o),u.append("rect").attr("class",N.legendItemEvent).style("fill-opacity",0).attr("x",m.isLegendRight||m.isLegendInset?r:-200).attr("y",m.isLegendRight||m.isLegendInset?-200:s),u.append("line").attr("class",N.legendItemTile).style("stroke",m.color).style("pointer-events","none").attr("x1",m.isLegendRight||m.isLegendInset?c:-200).attr("y1",m.isLegendRight||m.isLegendInset?-200:l).attr("x2",m.isLegendRight||m.isLegendInset?d:-200).attr("y2",m.isLegendRight||m.isLegendInset?-200:l).attr("stroke-width",S.legend_item_tile_height),y=m.legend.select("."+N.legendBackground+" rect"),m.isLegendInset&&0<b&&0===y.size()&&(y=m.legend.insert("g","."+N.legendItem).attr("class",N.legendBackground).append("rect")),f=m.legend.selectAll("text").data(g).text(function(t){return k(S.data_names[t])?S.data_names[t]:t}).each(function(t,e){R(this,t,e)}),(h?f.transition():f).attr("x",n).attr("y",o),_=m.legend.selectAll("rect."+N.legendItemEvent).data(g),(h?_.transition():_).attr("width",function(t){return V[t]}).attr("height",function(t){return G[t]}).attr("x",r).attr("y",s),x=m.legend.selectAll("line."+N.legendItemTile).data(g),(h?x.transition():x).style("stroke",m.levelColor?function(t){return m.levelColor(m.cache[t].values[0].value)}:m.color).attr("x1",c).attr("y1",l).attr("x2",d).attr("y2",l),y&&(h?y.transition():y).attr("height",m.getLegendHeight()-12).attr("width",b*(I+1)+10),m.legend.selectAll("."+N.legendItem).classed(N.legendItemHidden,function(t){return!m.isTargetToShow(t)}),m.updateLegendItemWidth(b),m.updateLegendItemHeight(T),m.updateLegendStep(I),m.updateSizes(),m.updateScales(),m.updateSvgSize(),m.transformAll(p,e),m.legendHasRendered=!0},l.prototype.initRegion=function(){this.region=this.main.append("g").attr("clip-path",this.clipPath).attr("class",N.regions)},l.prototype.updateRegion=function(t){var e=this,i=e.config;e.region.style("visibility",e.hasArcType()?"hidden":"visible");var n=e.main.select("."+N.regions).selectAll("."+N.region).data(i.regions),r=n.enter().append("rect").attr("x",e.regionX.bind(e)).attr("y",e.regionY.bind(e)).attr("width",e.regionWidth.bind(e)).attr("height",e.regionHeight.bind(e)).style("fill-opacity",0);e.mainRegion=r.merge(n).attr("class",e.classRegion.bind(e)),n.exit().transition().duration(t).style("opacity",0).remove()},l.prototype.redrawRegion=function(t,e){var i=this,n=i.mainRegion;return[(t?n.transition(e):n).attr("x",i.regionX.bind(i)).attr("y",i.regionY.bind(i)).attr("width",i.regionWidth.bind(i)).attr("height",i.regionHeight.bind(i)).style("fill-opacity",function(t){return P(t.opacity)?t.opacity:.1})]},l.prototype.regionX=function(t){var e=this,i=e.config,n="y"===t.axis?e.y:e.y2;return"y"===t.axis||"y2"===t.axis?i.axis_rotated&&"start"in t?n(t.start):0:i.axis_rotated?0:"start"in t?e.x(e.isTimeSeries()?e.parseDate(t.start):t.start):0},l.prototype.regionY=function(t){var e=this,i=e.config,n="y"===t.axis?e.y:e.y2;return"y"===t.axis||"y2"===t.axis?i.axis_rotated?0:"end"in t?n(t.end):0:i.axis_rotated&&"start"in t?e.x(e.isTimeSeries()?e.parseDate(t.start):t.start):0},l.prototype.regionWidth=function(t){var e,i=this,n=i.config,r=i.regionX(t),a="y"===t.axis?i.y:i.y2;return(e="y"===t.axis||"y2"===t.axis?n.axis_rotated&&"end"in t?a(t.end):i.width:n.axis_rotated?i.width:"end"in t?i.x(i.isTimeSeries()?i.parseDate(t.end):t.end):i.width)<r?0:e-r},l.prototype.regionHeight=function(t){var e,i=this,n=i.config,r=this.regionY(t),a="y"===t.axis?i.y:i.y2;return(e="y"===t.axis||"y2"===t.axis?n.axis_rotated?i.height:"start"in t?a(t.start):i.height:n.axis_rotated&&"end"in t?i.x(i.isTimeSeries()?i.parseDate(t.end):t.end):i.height)<r?0:e-r},l.prototype.isRegionOnX=function(t){return!t.axis||"x"===t.axis},l.prototype.getScale=function(t,e,i){return(i?this.d3.scaleTime():this.d3.scaleLinear()).range([t,e])},l.prototype.getX=function(t,e,i,n){var r,a=this.getScale(t,e,this.isTimeSeries()),o=i?a.domain(i):a;for(r in a=this.isCategorized()?(n=n||function(){return 0},function(t,e){var i=o(t)+n(t);return e?i:Math.ceil(i)}):function(t,e){var i=o(t);return e?i:Math.ceil(i)},o)a[r]=o[r];return a.orgDomain=function(){return o.domain()},this.isCategorized()&&(a.domain=function(t){return arguments.length?(o.domain(t),a):[(t=this.orgDomain())[0],t[1]+1]}),a},l.prototype.getY=function(t,e,i){var n=this.getScale(t,e,this.isTimeSeriesY());return i&&n.domain(i),n},l.prototype.getYScale=function(t){return"y2"===this.axis.getId(t)?this.y2:this.y},l.prototype.getSubYScale=function(t){return"y2"===this.axis.getId(t)?this.subY2:this.subY},l.prototype.updateScales=function(){var e=this,t=e.config,i=!e.x;e.xMin=t.axis_rotated?1:0,e.xMax=t.axis_rotated?e.height:e.width,e.yMin=t.axis_rotated?0:e.height,e.yMax=t.axis_rotated?e.width:1,e.subXMin=e.xMin,e.subXMax=e.xMax,e.subYMin=t.axis_rotated?0:e.height2,e.subYMax=t.axis_rotated?e.width2:1,e.x=e.getX(e.xMin,e.xMax,i?void 0:e.x.orgDomain(),function(){return e.xAxis.tickOffset()}),e.y=e.getY(e.yMin,e.yMax,i?t.axis_y_default:e.y.domain()),e.y2=e.getY(e.yMin,e.yMax,i?t.axis_y2_default:e.y2.domain()),e.subX=e.getX(e.xMin,e.xMax,e.orgXDomain,function(t){return t%1?0:e.subXAxis.tickOffset()}),e.subY=e.getY(e.subYMin,e.subYMax,i?t.axis_y_default:e.subY.domain()),e.subY2=e.getY(e.subYMin,e.subYMax,i?t.axis_y2_default:e.subY2.domain()),e.xAxisTickFormat=e.axis.getXAxisTickFormat(),e.xAxisTickValues=e.axis.getXAxisTickValues(),e.yAxisTickValues=e.axis.getYAxisTickValues(),e.y2AxisTickValues=e.axis.getY2AxisTickValues(),e.xAxis=e.axis.getXAxis(e.x,e.xOrient,e.xAxisTickFormat,e.xAxisTickValues,t.axis_x_tick_outer),e.subXAxis=e.axis.getXAxis(e.subX,e.subXOrient,e.xAxisTickFormat,e.xAxisTickValues,t.axis_x_tick_outer),e.yAxis=e.axis.getYAxis(e.y,e.yOrient,t.axis_y_tick_format,e.yAxisTickValues,t.axis_y_tick_outer),e.y2Axis=e.axis.getYAxis(e.y2,e.y2Orient,t.axis_y2_tick_format,e.y2AxisTickValues,t.axis_y2_tick_outer),i||e.brush&&e.brush.updateScale(e.subX),e.updateArc&&e.updateArc()},l.prototype.selectPoint=function(t,e,i){var n=this,r=n.config,a=(r.axis_rotated?n.circleY:n.circleX).bind(n),o=(r.axis_rotated?n.circleX:n.circleY).bind(n),s=n.pointSelectR.bind(n);r.data_onselected.call(n.api,e,t.node()),n.main.select("."+N.selectedCircles+n.getTargetSelectorSuffix(e.id)).selectAll("."+N.selectedCircle+"-"+i).data([e]).enter().append("circle").attr("class",function(){return n.generateClass(N.selectedCircle,i)}).attr("cx",a).attr("cy",o).attr("stroke",function(){return n.color(e)}).attr("r",function(t){return 1.4*n.pointSelectR(t)}).transition().duration(100).attr("r",s)},l.prototype.unselectPoint=function(t,e,i){this.config.data_onunselected.call(this.api,e,t.node()),this.main.select("."+N.selectedCircles+this.getTargetSelectorSuffix(e.id)).selectAll("."+N.selectedCircle+"-"+i).transition().duration(100).attr("r",0).remove()},l.prototype.togglePoint=function(t,e,i,n){t?this.selectPoint(e,i,n):this.unselectPoint(e,i,n)},l.prototype.selectPath=function(t,e){var i=this;i.config.data_onselected.call(i,e,t.node()),i.config.interaction_brighten&&t.transition().duration(100).style("fill",function(){return i.d3.rgb(i.color(e)).brighter(.75)})},l.prototype.unselectPath=function(t,e){var i=this;i.config.data_onunselected.call(i,e,t.node()),i.config.interaction_brighten&&t.transition().duration(100).style("fill",function(){return i.color(e)})},l.prototype.togglePath=function(t,e,i,n){t?this.selectPath(e,i,n):this.unselectPath(e,i,n)},l.prototype.getToggle=function(t,e){var i;return"circle"===t.nodeName?i=this.isStepType(e)?function(){}:this.togglePoint:"path"===t.nodeName&&(i=this.togglePath),i},l.prototype.toggleShape=function(t,e,i){var n=this,r=n.d3,a=n.config,o=r.select(t),s=o.classed(N.SELECTED),c=n.getToggle(t,e).bind(n);a.data_selection_enabled&&a.data_selection_isselectable(e)&&(a.data_selection_multiple||n.main.selectAll("."+N.shapes+(a.data_selection_grouped?n.getTargetSelectorSuffix(e.id):"")).selectAll("."+N.shape).each(function(t,e){var i=r.select(this);i.classed(N.SELECTED)&&c(!1,i.classed(N.SELECTED,!1),t,e)}),o.classed(N.SELECTED,!s),c(!s,o,e,i))},l.prototype.initBar=function(){this.main.select("."+N.chart).append("g").attr("class",N.chartBars)},l.prototype.updateTargetsForBar=function(t){var e=this,i=e.config,n=e.classChartBar.bind(e),r=e.classBars.bind(e),a=e.classFocus.bind(e);e.main.select("."+N.chartBars).selectAll("."+N.chartBar).data(t).attr("class",function(t){return n(t)+a(t)}).enter().append("g").attr("class",n).style("pointer-events","none").append("g").attr("class",r).style("cursor",function(t){return i.data_selection_isselectable(t)?"pointer":null})},l.prototype.updateBar=function(t){var e=this,i=e.barData.bind(e),n=e.classBar.bind(e),r=e.initialOpacity.bind(e),a=function(t){return e.color(t.id)},o=e.main.selectAll("."+N.bars).selectAll("."+N.bar).data(i),s=o.enter().append("path").attr("class",n).style("stroke",a).style("fill",a);e.mainBar=s.merge(o).style("opacity",r),o.exit().transition().duration(t).style("opacity",0)},l.prototype.redrawBar=function(t,e,i){return[(e?this.mainBar.transition(i):this.mainBar).attr("d",t).style("stroke",this.color).style("fill",this.color).style("opacity",1)]},l.prototype.getBarW=function(t,e){var i=this.config,n="number"==typeof i.bar_width?i.bar_width:e?t.tickInterval()*i.bar_width_ratio/e:0;return i.bar_width_max&&n>i.bar_width_max?i.bar_width_max:n},l.prototype.getBars=function(t,e){return(e?this.main.selectAll("."+N.bars+this.getTargetSelectorSuffix(e)):this.main).selectAll("."+N.bar+(P(t)?"-"+t:""))},l.prototype.expandBars=function(t,e,i){i&&this.unexpandBars(),this.getBars(t,e).classed(N.EXPANDED,!0)},l.prototype.unexpandBars=function(t){this.getBars(t).classed(N.EXPANDED,!1)},l.prototype.generateDrawBar=function(t,e){var a=this.config,o=this.generateGetBarPoints(t,e);return function(t,e){var i=o(t,e),n=a.axis_rotated?1:0,r=a.axis_rotated?0:1;return"M "+i[0][n]+","+i[0][r]+" L"+i[1][n]+","+i[1][r]+" L"+i[2][n]+","+i[2][r]+" L"+i[3][n]+","+i[3][r]+" z"}},l.prototype.generateGetBarPoints=function(t,e){var o=this,i=e?o.subXAxis:o.xAxis,n=t.__max__+1,s=o.getBarW(i,n),c=o.getShapeX(s,n,t,!!e),d=o.getShapeY(!!e),l=o.getShapeOffset(o.isBarType,t,!!e),u=s*(o.config.bar_space/2),h=e?o.getSubYScale:o.getYScale;return function(t,e){var i=h.call(o,t.id)(0),n=l(t,e)||i,r=c(t),a=d(t);return o.config.axis_rotated&&(0<t.value&&a<i||t.value<0&&i<a)&&(a=i),[[r+u,n],[r+u,a-(i-n)],[r+s-u,a-(i-n)],[r+s-u,n]]}},l.prototype.isWithinBar=function(t,e){var i=e.getBoundingClientRect(),n=e.pathSegList.getItem(0),r=e.pathSegList.getItem(1),a=Math.min(n.x,r.x),o=Math.min(n.y,r.y),s=a+i.width+2,c=o+i.height+2,d=o-2;return a-2<t[0]&&t[0]<s&&d<t[1]&&t[1]<c},l.prototype.getShapeIndices=function(t){var e,i,n=this.config,r={},a=0;return this.filterTargetsToShow(this.data.targets.filter(t,this)).forEach(function(t){for(e=0;e<n.data_groups.length;e++)if(!(n.data_groups[e].indexOf(t.id)<0))for(i=0;i<n.data_groups[e].length;i++)if(n.data_groups[e][i]in r){r[t.id]=r[n.data_groups[e][i]];break}v(r[t.id])&&(r[t.id]=a++)}),r.__max__=a-1,r},l.prototype.getShapeX=function(i,n,r,t){var a=t?this.subX:this.x;return function(t){var e=t.id in r?r[t.id]:0;return t.x||0===t.x?a(t.x)-i*(n/2-e):0}},l.prototype.getShapeY=function(e){var i=this;return function(t){return(e?i.getSubYScale(t.id):i.getYScale(t.id))(t.value)}},l.prototype.getShapeOffset=function(t,s,e){var c=this,d=c.orderTargets(c.filterTargetsToShow(c.data.targets.filter(t,c))),l=d.map(function(t){return t.id});return function(i,n){var r=e?c.getSubYScale(i.id):c.getYScale(i.id),a=r(0),o=a;return d.forEach(function(t){var e=c.isStepType(i)?c.convertValuesToStep(t.values):t.values;t.id!==i.id&&s[t.id]===s[i.id]&&l.indexOf(t.id)<l.indexOf(i.id)&&(void 0!==e[n]&&+e[n].x==+i.x||(n=-1,e.forEach(function(t,e){t.x===i.x&&(n=e)})),n in e&&0<=e[n].value*i.value&&(o+=r(e[n].value)-a))}),o}},l.prototype.isWithinShape=function(t,e){var i,n=this,r=n.d3.select(t);return n.isTargetToShow(e.id)?"circle"===t.nodeName?i=n.isStepType(e)?n.isWithinStep(t,n.getYScale(e.id)(e.value)):n.isWithinCircle(t,1.5*n.pointSelectR(e)):"path"===t.nodeName&&(i=!r.classed(N.bar)||n.isWithinBar(n.d3.mouse(t),t)):i=!1,i},l.prototype.getInterpolate=function(t){var e=this,i=e.d3,n={linear:i.curveLinear,"linear-closed":i.curveLinearClosed,basis:i.curveBasis,"basis-open":i.curveBasisOpen,"basis-closed":i.curveBasisClosed,bundle:i.curveBundle,cardinal:i.curveCardinal,"cardinal-open":i.curveCardinalOpen,"cardinal-closed":i.curveCardinalClosed,monotone:i.curveMonotoneX,step:i.curveStep,"step-before":i.curveStepBefore,"step-after":i.curveStepAfter};return e.isSplineType(t)?n[e.config.spline_interpolation_type]||n.cardinal:e.isStepType(t)?n[e.config.line_step_type]:n.linear},l.prototype.initLine=function(){this.main.select("."+N.chart).append("g").attr("class",N.chartLines)},l.prototype.updateTargetsForLine=function(t){var e,i=this,n=i.config,r=i.classChartLine.bind(i),a=i.classLines.bind(i),o=i.classAreas.bind(i),s=i.classCircles.bind(i),c=i.classFocus.bind(i);(e=i.main.select("."+N.chartLines).selectAll("."+N.chartLine).data(t).attr("class",function(t){return r(t)+c(t)}).enter().append("g").attr("class",r).style("opacity",0).style("pointer-events","none")).append("g").attr("class",a),e.append("g").attr("class",o),e.append("g").attr("class",function(t){return i.generateClass(N.selectedCircles,t.id)}),e.append("g").attr("class",s).style("cursor",function(t){return n.data_selection_isselectable(t)?"pointer":null}),t.forEach(function(e){i.main.selectAll("."+N.selectedCircles+i.getTargetSelectorSuffix(e.id)).selectAll("."+N.selectedCircle).each(function(t){t.value=e.values[t.index].value})})},l.prototype.updateLine=function(t){var e=this,i=e.main.selectAll("."+N.lines).selectAll("."+N.line).data(e.lineData.bind(e)),n=i.enter().append("path").attr("class",e.classLine.bind(e)).style("stroke",e.color);e.mainLine=n.merge(i).style("opacity",e.initialOpacity.bind(e)).style("shape-rendering",function(t){return e.isStepType(t)?"crispEdges":""}).attr("transform",null),i.exit().transition().duration(t).style("opacity",0)},l.prototype.redrawLine=function(t,e,i){return[(e?this.mainLine.transition(i):this.mainLine).attr("d",t).style("stroke",this.color).style("opacity",1)]},l.prototype.generateDrawLine=function(t,o){var s=this,c=s.config,d=s.d3.line(),i=s.generateGetLinePoints(t,o),l=o?s.getSubYScale:s.getYScale,e=function(t){return(o?s.subxx:s.xx).call(s,t)},n=function(t,e){return 0<c.data_groups.length?i(t,e)[0][1]:l.call(s,t.id)(t.value)};return d=c.axis_rotated?d.x(n).y(e):d.x(e).y(n),c.line_connectNull||(d=d.defined(function(t){return null!=t.value})),function(t){var e=c.line_connectNull?s.filterRemoveNull(t.values):t.values,i=o?s.subX:s.x,n=l.call(s,t.id),r=0,a=0;return(s.isLineType(t)?c.data_regions[t.id]?s.lineWithRegions(e,i,n,c.data_regions[t.id]):(s.isStepType(t)&&(e=s.convertValuesToStep(e)),d.curve(s.getInterpolate(t))(e)):(e[0]&&(r=i(e[0].x),a=n(e[0].value)),c.axis_rotated?"M "+a+" "+r:"M "+r+" "+a))||"M 0 0"}},l.prototype.generateGetLinePoints=function(t,e){var o=this,s=o.config,i=t.__max__+1,c=o.getShapeX(0,i,t,!!e),d=o.getShapeY(!!e),l=o.getShapeOffset(o.isLineType,t,!!e),u=e?o.getSubYScale:o.getYScale;return function(t,e){var i=u.call(o,t.id)(0),n=l(t,e)||i,r=c(t),a=d(t);return s.axis_rotated&&(0<t.value&&a<i||t.value<0&&i<a)&&(a=i),[[r,a-(i-n)],[r,a-(i-n)],[r,a-(i-n)],[r,a-(i-n)]]}},l.prototype.lineWithRegions=function(t,c,d,e){var i,n,r,a,l,o,s,u,h,g,p,f=this,_=f.config,x="M",y=f.isCategorized()?.5:0,m=[];function S(t,e){var i;for(i=0;i<e.length;i++)if(e[i].start<t&&t<=e[i].end)return!0;return!1}if(k(e))for(i=0;i<e.length;i++)m[i]={},v(e[i].start)?m[i].start=t[0].x:m[i].start=f.isTimeSeries()?f.parseDate(e[i].start):e[i].start,v(e[i].end)?m[i].end=t[t.length-1].x:m[i].end=f.isTimeSeries()?f.parseDate(e[i].end):e[i].end;function w(t){return"M"+t[0][0]+" "+t[0][1]+" "+t[1][0]+" "+t[1][1]}for(g=_.axis_rotated?function(t){return d(t.value)}:function(t){return c(t.x)},p=_.axis_rotated?function(t){return c(t.x)}:function(t){return d(t.value)},r=f.isTimeSeries()?function(t,e,i,n){var r=t.x.getTime(),a=e.x-t.x,o=new Date(r+a*i),s=new Date(r+a*(i+n));return w(_.axis_rotated?[[d(l(i)),c(o)],[d(l(i+n)),c(s)]]:[[c(o),d(l(i))],[c(s),d(l(i+n))]])}:function(t,e,i,n){return w(_.axis_rotated?[[d(l(i),!0),c(a(i))],[d(l(i+n),!0),c(a(i+n))]]:[[c(a(i),!0),d(l(i))],[c(a(i+n),!0),d(l(i+n))]])},i=0;i<t.length;i++){if(v(m)||!S(t[i].x,m))x+=" "+g(t[i])+" "+p(t[i]);else for(a=f.getScale(t[i-1].x+y,t[i].x+y,f.isTimeSeries()),l=f.getScale(t[i-1].value,t[i].value),o=c(t[i].x)-c(t[i-1].x),s=d(t[i].value)-d(t[i-1].value),h=2*(u=2/Math.sqrt(Math.pow(o,2)+Math.pow(s,2))),n=u;n<=1;n+=h)x+=r(t[i-1],t[i],n,u);t[i].x}return x},l.prototype.updateArea=function(t){var e=this,i=e.d3,n=e.main.selectAll("."+N.areas).selectAll("."+N.area).data(e.lineData.bind(e)),r=n.enter().append("path").attr("class",e.classArea.bind(e)).style("fill",e.color).style("opacity",function(){return e.orgAreaOpacity=+i.select(this).style("opacity"),0});e.mainArea=r.merge(n).style("opacity",e.orgAreaOpacity),n.exit().transition().duration(t).style("opacity",0)},l.prototype.redrawArea=function(t,e,i){return[(e?this.mainArea.transition(i):this.mainArea).attr("d",t).style("fill",this.color).style("opacity",this.orgAreaOpacity)]},l.prototype.generateDrawArea=function(t,e){var r=this,a=r.config,o=r.d3.area(),i=r.generateGetAreaPoints(t,e),n=e?r.getSubYScale:r.getYScale,s=function(t){return(e?r.subxx:r.xx).call(r,t)},c=function(t,e){return 0<a.data_groups.length?i(t,e)[0][1]:n.call(r,t.id)(r.getAreaBaseValue(t.id))},d=function(t,e){return 0<a.data_groups.length?i(t,e)[1][1]:n.call(r,t.id)(t.value)};return o=a.axis_rotated?o.x0(c).x1(d).y(s):o.x(s).y0(a.area_above?0:c).y1(d),a.line_connectNull||(o=o.defined(function(t){return null!==t.value})),function(t){var e=a.line_connectNull?r.filterRemoveNull(t.values):t.values,i=0,n=0;return(r.isAreaType(t)?(r.isStepType(t)&&(e=r.convertValuesToStep(e)),o.curve(r.getInterpolate(t))(e)):(e[0]&&(i=r.x(e[0].x),n=r.getYScale(t.id)(e[0].value)),a.axis_rotated?"M "+n+" "+i:"M "+i+" "+n))||"M 0 0"}},l.prototype.getAreaBaseValue=function(){return 0},l.prototype.generateGetAreaPoints=function(t,e){var o=this,s=o.config,i=t.__max__+1,c=o.getShapeX(0,i,t,!!e),d=o.getShapeY(!!e),l=o.getShapeOffset(o.isAreaType,t,!!e),u=e?o.getSubYScale:o.getYScale;return function(t,e){var i=u.call(o,t.id)(0),n=l(t,e)||i,r=c(t),a=d(t);return s.axis_rotated&&(0<t.value&&a<i||t.value<0&&i<a)&&(a=i),[[r,n],[r,a-(i-n)],[r,a-(i-n)],[r,n]]}},l.prototype.updateCircle=function(t,e){var i=this,n=i.main.selectAll("."+N.circles).selectAll("."+N.circle).data(i.lineOrScatterOrStanfordData.bind(i)),r=n.enter().append("circle").attr("shape-rendering","crispEdges").attr("class",i.classCircle.bind(i)).attr("cx",t).attr("cy",e).attr("r",i.pointR.bind(i)).style("fill",i.isStanfordGraphType()?i.getStanfordPointColor.bind(i):i.color);i.mainCircle=r.merge(n).style("opacity",i.isStanfordGraphType()?1:i.initialOpacityForCircle.bind(i)),n.exit().style("opacity",0)},l.prototype.redrawCircle=function(t,e,i,n){var r=this,a=r.main.selectAll("."+N.selectedCircle);return[(i?r.mainCircle.transition(n):r.mainCircle).style("opacity",this.opacityForCircle.bind(r)).style("fill",r.isStanfordGraphType()?r.getStanfordPointColor.bind(r):r.color).attr("cx",t).attr("cy",e),(i?a.transition(n):a).attr("cx",t).attr("cy",e)]},l.prototype.circleX=function(t){return t.x||0===t.x?this.x(t.x):null},l.prototype.updateCircleY=function(){var t,i,e=this;0<e.config.data_groups.length?(t=e.getShapeIndices(e.isLineType),i=e.generateGetLinePoints(t),e.circleY=function(t,e){return i(t,e)[0][1]}):e.circleY=function(t){return e.getYScale(t.id)(t.value)}},l.prototype.getCircles=function(t,e){return(e?this.main.selectAll("."+N.circles+this.getTargetSelectorSuffix(e)):this.main).selectAll("."+N.circle+(P(t)?"-"+t:""))},l.prototype.expandCircles=function(t,e,i){var n=this.pointExpandedR.bind(this);i&&this.unexpandCircles(),this.getCircles(t,e).classed(N.EXPANDED,!0).attr("r",n)},l.prototype.unexpandCircles=function(t){var e=this,i=e.pointR.bind(e);e.getCircles(t).filter(function(){return e.d3.select(this).classed(N.EXPANDED)}).classed(N.EXPANDED,!1).attr("r",i)},l.prototype.pointR=function(t){var e=this.config;return this.isStepType(t)?0:h(e.point_r)?e.point_r(t):e.point_r},l.prototype.pointExpandedR=function(t){var e=this.config;return e.point_focus_expand_enabled?h(e.point_focus_expand_r)?e.point_focus_expand_r(t):e.point_focus_expand_r?e.point_focus_expand_r:1.75*this.pointR(t):this.pointR(t)},l.prototype.pointSelectR=function(t){var e=this.config;return h(e.point_select_r)?e.point_select_r(t):e.point_select_r?e.point_select_r:4*this.pointR(t)},l.prototype.isWithinCircle=function(t,e){var i=this.d3,n=i.mouse(t),r=i.select(t),a=+r.attr("cx"),o=+r.attr("cy");return Math.sqrt(Math.pow(a-n[0],2)+Math.pow(o-n[1],2))<e},l.prototype.isWithinStep=function(t,e){return Math.abs(e-this.d3.mouse(t)[1])<30},l.prototype.getCurrentWidth=function(){var t=this.config;return t.size_width?t.size_width:this.getParentWidth()},l.prototype.getCurrentHeight=function(){var t=this.config,e=t.size_height?t.size_height:this.getParentHeight();return 0<e?e:320/(this.hasType("gauge")&&!t.gauge_fullCircle?2:1)},l.prototype.getCurrentPaddingTop=function(){var t=this.config,e=P(t.padding_top)?t.padding_top:0;return this.title&&this.title.node()&&(e+=this.getTitlePadding()),e},l.prototype.getCurrentPaddingBottom=function(){var t=this.config;return P(t.padding_bottom)?t.padding_bottom:0},l.prototype.getCurrentPaddingLeft=function(t){var e=this.config;return P(e.padding_left)?e.padding_left:e.axis_rotated?!e.axis_x_show||e.axis_x_inner?1:Math.max(r(this.getAxisWidthByAxisId("x",t)),40):!e.axis_y_show||e.axis_y_inner?this.axis.getYAxisLabelPosition().isOuter?30:1:r(this.getAxisWidthByAxisId("y",t))},l.prototype.getCurrentPaddingRight=function(){var t=this,e=t.config,i=0,n=t.isLegendRight?t.getLegendWidth()+20:0;return i=P(e.padding_right)?e.padding_right+1:e.axis_rotated?10+n:!e.axis_y2_show||e.axis_y2_inner?2+n+(t.axis.getY2AxisLabelPosition().isOuter?20:0):r(t.getAxisWidthByAxisId("y2"))+n,t.colorScale&&t.colorScale.node()&&(i+=t.getColorScalePadding()),i},l.prototype.getParentRectValue=function(e){for(var i,n=this.selectChart.node();n&&"BODY"!==n.tagName;){try{i=n.getBoundingClientRect()[e]}catch(t){"width"===e&&(i=n.offsetWidth)}if(i)break;n=n.parentNode}return i},l.prototype.getParentWidth=function(){return this.getParentRectValue("width")},l.prototype.getParentHeight=function(){var t=this.selectChart.style("height");return 0<t.indexOf("px")?+t.replace("px",""):0},l.prototype.getSvgLeft=function(t){var e=this,i=e.config,n=i.axis_rotated||!i.axis_rotated&&!i.axis_y_inner,r=i.axis_rotated?N.axisX:N.axisY,a=e.main.select("."+r).node(),o=a&&n?a.getBoundingClientRect():{right:0},s=e.selectChart.node().getBoundingClientRect(),c=e.hasArcType(),d=o.right-s.left-(c?0:e.getCurrentPaddingLeft(t));return 0<d?d:0},l.prototype.getAxisWidthByAxisId=function(t,e){var i=this.axis.getLabelPositionById(t);return this.axis.getMaxTickWidth(t,e)+(i.isInner?20:40)},l.prototype.getHorizontalAxisHeight=function(t){var e=this,i=e.config,n=30;return"x"!==t||i.axis_x_show?"x"===t&&i.axis_x_height?i.axis_x_height:"y"!==t||i.axis_y_show?"y2"!==t||i.axis_y2_show?("x"===t&&!i.axis_rotated&&i.axis_x_tick_rotate&&(n=30+e.axis.getMaxTickWidth(t)*Math.cos(Math.PI*(90-Math.abs(i.axis_x_tick_rotate))/180)),"y"===t&&i.axis_rotated&&i.axis_y_tick_rotate&&(n=30+e.axis.getMaxTickWidth(t)*Math.cos(Math.PI*(90-Math.abs(i.axis_y_tick_rotate))/180)),n+(e.axis.getLabelPositionById(t).isInner?0:10)+("y2"===t?-10:0)):e.rotated_padding_top:!i.legend_show||e.isLegendRight||e.isLegendInset?1:10:8},l.prototype.initBrush=function(t){var r=this,e=r.d3;return r.brush=(r.config.axis_rotated?e.brushY():e.brushX()).on("brush",function(){var t=e.event.sourceEvent;t&&"zoom"===t.type||r.redrawForBrush()}).on("end",function(){var t=e.event.sourceEvent;t&&"zoom"===t.type||r.brush.empty()&&t&&"end"!==t.type&&r.brush.clear()}),r.brush.updateExtent=function(){var t,e=this.scale.range();return t=r.config.axis_rotated?[[0,e[0]],[r.width2,e[1]]]:[[e[0],0],[e[1],r.height2]],this.extent(t),this},r.brush.updateScale=function(t){return this.scale=t,this},r.brush.update=function(t){this.updateScale(t||r.subX).updateExtent(),r.context.select("."+N.brush).call(this)},r.brush.clear=function(){r.context.select("."+N.brush).call(r.brush.move,null)},r.brush.selection=function(){return e.brushSelection(r.context.select("."+N.brush).node())},r.brush.selectionAsValue=function(t,e){var i,n;return t?(r.context&&(i=[this.scale(t[0]),this.scale(t[1])],n=r.context.select("."+N.brush),e&&(n=n.transition()),r.brush.move(n,i)),[]):(i=r.brush.selection()||[0,0],[this.scale.invert(i[0]),this.scale.invert(i[1])])},r.brush.empty=function(){var t=r.brush.selection();return!t||t[0]===t[1]},r.brush.updateScale(t)},l.prototype.initSubchart=function(){var t=this,e=t.config,i=t.context=t.svg.append("g").attr("transform",t.getTranslate("context")),n=e.subchart_show?"visible":"hidden";i.style("visibility",n),i.append("g").attr("clip-path",t.clipPathForSubchart).attr("class",N.chart),i.select("."+N.chart).append("g").attr("class",N.chartBars),i.select("."+N.chart).append("g").attr("class",N.chartLines),i.append("g").attr("clip-path",t.clipPath).attr("class",N.brush),t.axes.subx=i.append("g").attr("class",N.axisX).attr("transform",t.getTranslate("subx")).attr("clip-path",e.axis_rotated?"":t.clipPathForXAxis)},l.prototype.initSubchartBrush=function(){this.initBrush(this.subX).updateExtent(),this.context.select("."+N.brush).call(this.brush)},l.prototype.updateTargetsForSubchart=function(t){var e,i,n,r,a=this,o=a.context,s=a.config,c=a.classChartBar.bind(a),d=a.classBars.bind(a),l=a.classChartLine.bind(a),u=a.classLines.bind(a),h=a.classAreas.bind(a);s.subchart_show&&((n=(r=o.select("."+N.chartBars).selectAll("."+N.chartBar).data(t)).enter().append("g").style("opacity",0)).merge(r).attr("class",c),n.append("g").attr("class",d),(e=(i=o.select("."+N.chartLines).selectAll("."+N.chartLine).data(t)).enter().append("g").style("opacity",0)).merge(i).attr("class",l),e.append("g").attr("class",u),e.append("g").attr("class",h),o.selectAll("."+N.brush+" rect").attr(s.axis_rotated?"width":"height",s.axis_rotated?a.width2:a.height2))},l.prototype.updateBarForSubchart=function(t){var e=this,i=e.context.selectAll("."+N.bars).selectAll("."+N.bar).data(e.barData.bind(e)),n=i.enter().append("path").attr("class",e.classBar.bind(e)).style("stroke","none").style("fill",e.color);i.exit().transition().duration(t).style("opacity",0).remove(),e.contextBar=n.merge(i).style("opacity",e.initialOpacity.bind(e))},l.prototype.redrawBarForSubchart=function(t,e,i){(e?this.contextBar.transition(Math.random().toString()).duration(i):this.contextBar).attr("d",t).style("opacity",1)},l.prototype.updateLineForSubchart=function(t){var e=this,i=e.context.selectAll("."+N.lines).selectAll("."+N.line).data(e.lineData.bind(e)),n=i.enter().append("path").attr("class",e.classLine.bind(e)).style("stroke",e.color);i.exit().transition().duration(t).style("opacity",0).remove(),e.contextLine=n.merge(i).style("opacity",e.initialOpacity.bind(e))},l.prototype.redrawLineForSubchart=function(t,e,i){(e?this.contextLine.transition(Math.random().toString()).duration(i):this.contextLine).attr("d",t).style("opacity",1)},l.prototype.updateAreaForSubchart=function(t){var e=this,i=e.d3,n=e.context.selectAll("."+N.areas).selectAll("."+N.area).data(e.lineData.bind(e)),r=n.enter().append("path").attr("class",e.classArea.bind(e)).style("fill",e.color).style("opacity",function(){return e.orgAreaOpacity=+i.select(this).style("opacity"),0});n.exit().transition().duration(t).style("opacity",0).remove(),e.contextArea=r.merge(n).style("opacity",0)},l.prototype.redrawAreaForSubchart=function(t,e,i){(e?this.contextArea.transition(Math.random().toString()).duration(i):this.contextArea).attr("d",t).style("fill",this.color).style("opacity",this.orgAreaOpacity)},l.prototype.redrawSubchart=function(t,e,i,n,r,a,o){var s,c,d,l=this,u=l.d3,h=l.config;l.context.style("visibility",h.subchart_show?"visible":"hidden"),h.subchart_show&&(u.event&&"zoom"===u.event.type&&l.brush.selectionAsValue(l.x.orgDomain()),t&&(l.brush.empty()||l.brush.selectionAsValue(l.x.orgDomain()),s=l.generateDrawArea(r,!0),c=l.generateDrawBar(a,!0),d=l.generateDrawLine(o,!0),l.updateBarForSubchart(i),l.updateLineForSubchart(i),l.updateAreaForSubchart(i),l.redrawBarForSubchart(c,i,i),l.redrawLineForSubchart(d,i,i),l.redrawAreaForSubchart(s,i,i)))},l.prototype.redrawForBrush=function(){var t,e=this,i=e.x,n=e.d3;e.redraw({withTransition:!1,withY:e.config.zoom_rescale,withSubchart:!1,withUpdateXDomain:!0,withEventRect:!1,withDimension:!1}),t=n.event.selection||e.brush.scale.range(),e.main.select("."+N.eventRect).call(e.zoom.transform,n.zoomIdentity.scale(e.width/(t[1]-t[0])).translate(-t[0],0)),e.config.subchart_onbrush.call(e.api,i.orgDomain())},l.prototype.transformContext=function(t,e){var i;e&&e.axisSubX?i=e.axisSubX:(i=this.context.select("."+N.axisX),t&&(i=i.transition())),this.context.attr("transform",this.getTranslate("context")),i.attr("transform",this.getTranslate("subx"))},l.prototype.getDefaultSelection=function(){var t=this,e=t.config,i=h(e.axis_x_selection)?e.axis_x_selection(t.getXDomain(t.data.targets)):e.axis_x_selection;return t.isTimeSeries()&&(i=[t.parseDate(i[0]),t.parseDate(i[1])]),i},l.prototype.initText=function(){this.main.select("."+N.chart).append("g").attr("class",N.chartTexts),this.mainText=this.d3.selectAll([])},l.prototype.updateTargetsForText=function(t){var e=this,i=e.classChartText.bind(e),n=e.classTexts.bind(e),r=e.classFocus.bind(e),a=e.main.select("."+N.chartTexts).selectAll("."+N.chartText).data(t),o=a.enter().append("g").attr("class",i).style("opacity",0).style("pointer-events","none");o.append("g").attr("class",n),o.merge(a).attr("class",function(t){return i(t)+r(t)})},l.prototype.updateText=function(t,e,i){var n=this,r=n.config,a=n.barOrLineData.bind(n),o=n.classText.bind(n),s=n.main.selectAll("."+N.texts).selectAll("."+N.text).data(a),c=s.enter().append("text").attr("class",o).attr("text-anchor",function(t){return r.axis_rotated?t.value<0?"end":"start":"middle"}).style("stroke","none").attr("x",t).attr("y",e).style("fill",function(t){return n.color(t)}).style("fill-opacity",0);n.mainText=c.merge(s).text(function(t,e,i){return n.dataLabelFormat(t.id)(t.value,t.id,e,i)}),s.exit().transition().duration(i).style("fill-opacity",0).remove()},l.prototype.redrawText=function(t,e,i,n,r){return[(n?this.mainText.transition(r):this.mainText).attr("x",t).attr("y",e).style("fill",this.color).style("fill-opacity",i?0:this.opacityForText.bind(this))]},l.prototype.getTextRect=function(t,e,i){var n,r=this.d3.select("body").append("div").classed("c3",!0),a=r.append("svg").style("visibility","hidden").style("position","fixed").style("top",0).style("left",0),o=this.d3.select(i).style("font");return a.selectAll(".dummy").data([t]).enter().append("text").classed(e||"",!0).style("font",o).text(t).each(function(){n=this.getBoundingClientRect()}),r.remove(),n},l.prototype.generateXYForText=function(t,e,i,n){var r=this,a=r.generateGetAreaPoints(t,!1),o=r.generateGetBarPoints(e,!1),s=r.generateGetLinePoints(i,!1),c=n?r.getXForText:r.getYForText;return function(t,e){var i=r.isAreaType(t)?a:r.isBarType(t)?o:s;return c.call(r,i(t,e),t,this)}},l.prototype.getXForText=function(t,e,i){var n,r,a=this,o=i.getBoundingClientRect();return n=a.config.axis_rotated?(r=a.isBarType(e)?4:6,t[2][1]+r*(e.value<0?-1:1)):a.hasType("bar")?(t[2][0]+t[0][0])/2:t[0][0],null===e.value&&(n>a.width?n=a.width-o.width:n<0&&(n=4)),n},l.prototype.getYForText=function(t,e,i){var n,r=this,a=i.getBoundingClientRect();return r.config.axis_rotated?n=(t[0][0]+t[2][0]+.6*a.height)/2:(n=t[2][1],e.value<0||0===e.value&&!r.hasPositiveValue?(n+=a.height,r.isBarType(e)&&r.isSafari()?n-=3:!r.isBarType(e)&&r.isChrome()&&(n+=3)):n+=r.isBarType(e)?-3:-6),null!==e.value||r.config.axis_rotated||(n<a.height?n=a.height:n>this.height&&(n=this.height-4)),n},l.prototype.initTitle=function(){this.title=this.svg.append("text").text(this.config.title_text).attr("class",this.CLASS.title)},l.prototype.redrawTitle=function(){var t=this;t.title.attr("x",t.xForTitle.bind(t)).attr("y",t.yForTitle.bind(t))},l.prototype.xForTitle=function(){var t=this,e=t.config,i=e.title_position||"left";return 0<=i.indexOf("right")?t.currentWidth-t.getTextRect(t.title.node().textContent,t.CLASS.title,t.title.node()).width-e.title_padding.right:0<=i.indexOf("center")?(t.currentWidth-t.getTextRect(t.title.node().textContent,t.CLASS.title,t.title.node()).width)/2:e.title_padding.left},l.prototype.yForTitle=function(){var t=this;return t.config.title_padding.top+t.getTextRect(t.title.node().textContent,t.CLASS.title,t.title.node()).height},l.prototype.getTitlePadding=function(){return this.yForTitle()+this.config.title_padding.bottom},l.prototype.drawColorScale=function(){var t,e,i,n,r,a,o,s=this,c=s.d3,d=s.config,l=s.data.targets[0];if(t=isNaN(d.stanford_scaleWidth)?20:d.stanford_scaleWidth,5,t<0)throw Error("Colorscale's barheight and barwidth must be greater than 0.");o=s.height-d.stanford_padding.bottom-d.stanford_padding.top,i=c.range(d.stanford_padding.bottom,o,5),a=c.scaleSequential(l.colors).domain([i[i.length-1],i[0]]),s.colorScale&&s.colorScale.remove(),s.colorScale=s.svg.append("g").attr("width",50).attr("height",o).attr("class",N.colorScale),s.colorScale.append("g").attr("transform","translate(0, ".concat(d.stanford_padding.top,")")).selectAll("bars").data(i).enter().append("rect").attr("y",function(t,e){return 5*e}).attr("x",0).attr("width",t).attr("height",5).attr("fill",function(t){return a(t)}),r=c.scaleLog().domain([l.minEpochs,l.maxEpochs]).domain([l.minEpochs,l.maxEpochs]).range([i[0]+d.stanford_padding.top+i[i.length-1]+5-1,i[0]+d.stanford_padding.top]),n=c.axisRight(r),"pow10"===d.stanford_scaleFormat?n.tickValues([1,10,100,1e3,1e4,1e5,1e6,1e7]):h(d.stanford_scaleFormat)?n.tickFormat(d.stanford_scaleFormat):n.tickFormat(c.format("d")),e=s.colorScale.append("g").attr("class","legend axis").attr("transform","translate(".concat(t,",0)")).call(n),"pow10"===d.stanford_scaleFormat&&e.selectAll(".tick text").text(null).filter(g).text(10).append("tspan").attr("dy","-.7em").text(function(t){return Math.round(Math.log(t)/Math.LN10)}),s.colorScale.attr("transform","translate(".concat(s.currentWidth-s.xForColorScale(),", 0)"))},l.prototype.xForColorScale=function(){return this.config.stanford_padding.right+this.colorScale.node().getBBox().width},l.prototype.getColorScalePadding=function(){return this.xForColorScale()+this.config.stanford_padding.left+20},l.prototype.isStanfordGraphType=function(){return"stanford"===this.config.data_type},l.prototype.initStanfordData=function(){var t,e,i,n=this.d3,r=this.config,a=this.data.targets[0];if(a.values.sort(x),t=a.values.map(function(t){return t.epochs}),i=isNaN(r.stanford_scaleMin)?n.min(t):r.stanford_scaleMin,(e=isNaN(r.stanford_scaleMax)?n.max(t):r.stanford_scaleMax)<i)throw Error("Number of minEpochs has to be smaller than maxEpochs");a.colors=h(r.stanford_colors)?r.stanford_colors:n.interpolateHslLong(n.hsl(250,1,.5),n.hsl(0,1,.5)),a.colorscale=n.scaleSequentialLog(a.colors).domain([i,e]),a.minEpochs=i,a.maxEpochs=e},l.prototype.getStanfordPointColor=function(t){return this.data.targets[0].colorscale(t.epochs)},l.prototype.getCentroid=function(t){var e,i,n,r,a,o=p(t),s=0,c=0;for(e=0,i=t.length-1;e<t.length;i=e,e+=1)r=t[e],a=t[i],n=r.x*a.y-a.x*r.y,s+=(r.x+a.x)*n,c+=(r.y+a.y)*n;return{x:s/(n=6*o),y:c/n}},l.prototype.getStanfordTooltipTitle=function(t){var e=this.axis.getLabelText("x"),i=this.axis.getLabelText("y");return"\n      <tr><th>".concat(e?_(e):"x","</th><th class='value'>").concat(t.x,"</th></tr>\n      <tr><th>").concat(i?_(i):"y","</th><th class='value'>").concat(t.value,"</th></tr>\n    ")},l.prototype.countEpochsInRegion=function(i){var t,e,n=this.data.targets[0];return t=n.values.reduce(function(t,e){return t+Number(e.epochs)},0),{value:e=n.values.reduce(function(t,e){return f(e,i)?t+Number(e.epochs):t},0),percentage:0!==e?(e/t*100).toFixed(1):0}};var p=function(t){var e,i,n,r,a=0;for(e=0,i=t.length-1;e<t.length;i=e,e+=1)n=t[e],r=t[i],a+=n.x*r.y,a-=n.y*r.x;return a/=2},f=function(t,e){for(var i,n,r,a,o=t.x,s=t.value,c=!1,d=0,l=e.length-1;d<e.length;l=d++)i=e[d].x,n=e[d].y,a=e[l].x,s<n!=s<(r=e[l].y)&&o<(a-i)*(s-n)/(r-n)+i&&(c=!c);return c},x=function(t,e){return t.epochs<e.epochs?-1:t.epochs>e.epochs?1:0};return l.prototype.initStanfordElements=function(){var t=this;t.stanfordElements=t.main.select("."+N.chart).append("g").attr("class",N.stanfordElements),t.stanfordElements.append("g").attr("class",N.stanfordLines),t.stanfordElements.append("g").attr("class",N.stanfordTexts),t.stanfordElements.append("g").attr("class",N.stanfordRegions)},l.prototype.updateStanfordElements=function(t){var e,i,n,r,a,o,s=this,c=s.main,d=s.config,l=s.xvCustom.bind(s),u=s.yvCustom.bind(s),h=s.countEpochsInRegion.bind(s);(i=(e=c.select("."+N.stanfordLines).style("shape-rendering","geometricprecision").selectAll("."+N.stanfordLine).data(d.stanford_lines)).enter().append("g").attr("class",function(t){return N.stanfordLine+(t.class?" "+t.class:"")})).append("line").attr("x1",function(t){return d.axis_rotated?u(t,"value_y1"):l(t,"value_x1")}).attr("x2",function(t){return d.axis_rotated?u(t,"value_y2"):l(t,"value_x2")}).attr("y1",function(t){return d.axis_rotated?l(t,"value_x1"):u(t,"value_y1")}).attr("y2",function(t){return d.axis_rotated?l(t,"value_x2"):u(t,"value_y2")}).style("opacity",0),s.stanfordLines=i.merge(e),s.stanfordLines.select("line").transition().duration(t).attr("x1",function(t){return d.axis_rotated?u(t,"value_y1"):l(t,"value_x1")}).attr("x2",function(t){return d.axis_rotated?u(t,"value_y2"):l(t,"value_x2")}).attr("y1",function(t){return d.axis_rotated?l(t,"value_x1"):u(t,"value_y1")}).attr("y2",function(t){return d.axis_rotated?l(t,"value_x2"):u(t,"value_y2")}).style("opacity",1),e.exit().transition().duration(t).style("opacity",0).remove(),(o=(a=c.select("."+N.stanfordTexts).selectAll("."+N.stanfordText).data(d.stanford_texts)).enter().append("g").attr("class",function(t){return N.stanfordText+(t.class?" "+t.class:"")})).append("text").attr("x",function(t){return d.axis_rotated?u(t,"y"):l(t,"x")}).attr("y",function(t){return d.axis_rotated?l(t,"x"):u(t,"y")}).style("opacity",0),s.stanfordTexts=o.merge(a),s.stanfordTexts.select("text").transition().duration(t).attr("x",function(t){return d.axis_rotated?u(t,"y"):l(t,"x")}).attr("y",function(t){return d.axis_rotated?l(t,"x"):u(t,"y")}).text(function(t){return t.content}).style("opacity",1),a.exit().transition().duration(t).style("opacity",0).remove(),(r=(n=c.select("."+N.stanfordRegions).selectAll("."+N.stanfordRegion).data(d.stanford_regions)).enter().append("g").attr("class",function(t){return N.stanfordRegion+(t.class?" "+t.class:"")})).append("polygon").attr("points",function(t){return t.points.map(function(t){return[d.axis_rotated?u(t,"y"):l(t,"x"),d.axis_rotated?l(t,"x"):u(t,"y")].join(",")}).join(" ")}).style("opacity",0),r.append("text").attr("x",function(t){return s.getCentroid(t.points).x}).attr("y",function(t){return s.getCentroid(t.points).y}).style("opacity",0),s.stanfordRegions=r.merge(n),s.stanfordRegions.select("polygon").transition().duration(t).attr("points",function(t){return t.points.map(function(t){return[d.axis_rotated?u(t,"y"):l(t,"x"),d.axis_rotated?l(t,"x"):u(t,"y")].join(",")}).join(" ")}).style("opacity",function(t){return t.opacity?t.opacity:.2}),s.stanfordRegions.select("text").transition().duration(t).attr("x",function(t){return d.axis_rotated?u(s.getCentroid(t.points),"y"):l(s.getCentroid(t.points),"x")}).attr("y",function(t){return d.axis_rotated?l(s.getCentroid(t.points),"x"):u(s.getCentroid(t.points),"y")}).text(function(t){var e,i,n;return t.text?(s.isStanfordGraphType()&&(e=(n=h(t.points)).value,i=n.percentage),t.text(e,i)):""}).attr("text-anchor","middle").attr("dominant-baseline","middle").style("opacity",1),n.exit().transition().duration(t).style("opacity",0).remove()},l.prototype.initTooltip=function(){var t,e=this,i=e.config;if(e.tooltip=e.selectChart.style("position","relative").append("div").attr("class",N.tooltipContainer).style("position","absolute").style("pointer-events","none").style("display","none"),i.tooltip_init_show){if(e.isTimeSeries()&&c(i.tooltip_init_x)){for(i.tooltip_init_x=e.parseDate(i.tooltip_init_x),t=0;t<e.data.targets[0].values.length&&e.data.targets[0].values[t].x-i.tooltip_init_x!=0;t++);i.tooltip_init_x=t}e.tooltip.html(i.tooltip_contents.call(e,e.data.targets.map(function(t){return e.addName(t.values[i.tooltip_init_x])}),e.axis.getXAxisTickFormat(),e.getYFormat(e.hasArcType()),e.color)),e.tooltip.style("top",i.tooltip_init_position.top).style("left",i.tooltip_init_position.left).style("display","block")}},l.prototype.getTooltipSortFunction=function(){var t=this,e=t.config;if(0!==e.data_groups.length&&void 0===e.tooltip_order){var i=t.orderTargets(t.data.targets).map(function(t){return t.id});return(t.isOrderAsc()||t.isOrderDesc())&&(i=i.reverse()),function(t,e){return i.indexOf(t.id)-i.indexOf(e.id)}}var n=e.tooltip_order;void 0===n&&(n=e.data_order);var r=function(t){return t?t.value:null};if(c(n)&&"asc"===n.toLowerCase())return function(t,e){return r(t)-r(e)};if(c(n)&&"desc"===n.toLowerCase())return function(t,e){return r(e)-r(t)};if(h(n)){var a=n;return void 0===e.tooltip_order&&(a=function(t,e){return n(t?{id:t.id,values:[t]}:null,e?{id:e.id,values:[e]}:null)}),a}return o(n)?function(t,e){return n.indexOf(t.id)-n.indexOf(e.id)}:void 0},l.prototype.getTooltipContent=function(t,e,i,n){var r,a,o,s,c,d,l=this,u=l.config,h=u.tooltip_format_title||e,g=u.tooltip_format_name||function(t){return t},p=u.tooltip_format_value||i,f=this.getTooltipSortFunction();for(f&&t.sort(f),a=0;a<t.length;a++)if(t[a]&&(t[a].value||0===t[a].value)){if(l.isStanfordGraphType())r||(o=l.getStanfordTooltipTitle(t[a]),r="<table class='"+l.CLASS.tooltip+"'>"+o),d=l.getStanfordPointColor(t[a]),c=_(u.data_epochs),s=t[a].epochs;else if(r||(o=_(h?h(t[a].x,t[a].index):t[a].x),r="<table class='"+l.CLASS.tooltip+"'>"+(o||0===o?"<tr><th colspan='2'>"+o+"</th></tr>":"")),void 0!==(s=_(p(t[a].value,t[a].ratio,t[a].id,t[a].index,t)))){if(null===t[a].name)continue;c=_(g(t[a].name,t[a].ratio,t[a].id,t[a].index)),d=l.levelColor?l.levelColor(t[a].value):n(t[a].id)}void 0!==s&&(r+="<tr class='"+l.CLASS.tooltipName+"-"+l.getTargetSelectorSuffix(t[a].id)+"'>",r+="<td class='name'><span style='background-color:"+d+"'></span>"+c+"</td>",r+="<td class='value'>"+s+"</td>",r+="</tr>")}return r+"</table>"},l.prototype.tooltipPosition=function(t,e,i,n){var r,a,o,s,c,d=this,l=d.config,u=d.d3,h=d.hasArcType(),g=u.mouse(n);return h?(a=(d.width-(d.isLegendRight?d.getLegendWidth():0))/2+g[0],s=(d.hasType("gauge")?d.height:d.height/2)+g[1]+20):(r=d.getSvgLeft(!0),s=l.axis_rotated?(o=(a=r+g[0]+100)+e,c=d.currentWidth-d.getCurrentPaddingRight(),d.x(t[0].x)+20):(o=(a=r+d.getCurrentPaddingLeft(!0)+d.x(t[0].x)+20)+e,c=r+d.currentWidth-d.getCurrentPaddingRight(),g[1]+15),c<o&&(a-=o-c+20),s+i>d.currentHeight&&(s-=i+30)),s<0&&(s=0),{top:s,left:a}},l.prototype.showTooltip=function(t,e){var i,n,r,a=this,o=a.config,s=a.hasArcType(),c=t.filter(function(t){return t&&P(t.value)}),d=o.tooltip_position||l.prototype.tooltipPosition;0!==c.length&&o.tooltip_show&&(a.tooltip.html(o.tooltip_contents.call(a,t,a.axis.getXAxisTickFormat(),a.getYFormat(s),a.color)).style("display","block"),i=a.tooltip.property("offsetWidth"),n=a.tooltip.property("offsetHeight"),r=d.call(this,c,i,n,e),a.tooltip.style("top",r.top+"px").style("left",r.left+"px"))},l.prototype.hideTooltip=function(){this.tooltip.style("display","none")},l.prototype.setTargetType=function(t,e){var i=this,n=i.config;i.mapToTargetIds(t).forEach(function(t){i.withoutFadeIn[t]=e===n.data_types[t],n.data_types[t]=e}),t||(n.data_type=e)},l.prototype.hasType=function(i,t){var n=this.config.data_types,r=!1;return(t=t||this.data.targets)&&t.length?t.forEach(function(t){var e=n[t.id];(e&&0<=e.indexOf(i)||!e&&"line"===i)&&(r=!0)}):Object.keys(n).length?Object.keys(n).forEach(function(t){n[t]===i&&(r=!0)}):r=this.config.data_type===i,r},l.prototype.hasArcType=function(t){return this.hasType("pie",t)||this.hasType("donut",t)||this.hasType("gauge",t)},l.prototype.isLineType=function(t){var e=this.config,i=c(t)?t:t.id;return!e.data_types[i]||0<=["line","spline","area","area-spline","step","area-step"].indexOf(e.data_types[i])},l.prototype.isStepType=function(t){var e=c(t)?t:t.id;return 0<=["step","area-step"].indexOf(this.config.data_types[e])},l.prototype.isSplineType=function(t){var e=c(t)?t:t.id;return 0<=["spline","area-spline"].indexOf(this.config.data_types[e])},l.prototype.isAreaType=function(t){var e=c(t)?t:t.id;return 0<=["area","area-spline","area-step"].indexOf(this.config.data_types[e])},l.prototype.isBarType=function(t){var e=c(t)?t:t.id;return"bar"===this.config.data_types[e]},l.prototype.isScatterType=function(t){var e=c(t)?t:t.id;return"scatter"===this.config.data_types[e]},l.prototype.isStanfordType=function(t){var e=c(t)?t:t.id;return"stanford"===this.config.data_types[e]},l.prototype.isScatterOrStanfordType=function(t){return this.isScatterType(t)||this.isStanfordType(t)},l.prototype.isPieType=function(t){var e=c(t)?t:t.id;return"pie"===this.config.data_types[e]},l.prototype.isGaugeType=function(t){var e=c(t)?t:t.id;return"gauge"===this.config.data_types[e]},l.prototype.isDonutType=function(t){var e=c(t)?t:t.id;return"donut"===this.config.data_types[e]},l.prototype.isArcType=function(t){return this.isPieType(t)||this.isDonutType(t)||this.isGaugeType(t)},l.prototype.lineData=function(t){return this.isLineType(t)?[t]:[]},l.prototype.arcData=function(t){return this.isArcType(t.data)?[t]:[]},l.prototype.barData=function(t){return this.isBarType(t)?t.values:[]},l.prototype.lineOrScatterOrStanfordData=function(t){return this.isLineType(t)||this.isScatterType(t)||this.isStanfordType(t)?t.values:[]},l.prototype.barOrLineData=function(t){return this.isBarType(t)||this.isLineType(t)?t.values:[]},l.prototype.isSafari=function(){var t=window.navigator.userAgent;return 0<=t.indexOf("Safari")&&t.indexOf("Chrome")<0},l.prototype.isChrome=function(){return 0<=window.navigator.userAgent.indexOf("Chrome")},l.prototype.initZoom=function(){var e,i=this,n=i.d3,r=i.config;return i.zoom=n.zoom().on("start",function(){if("scroll"===r.zoom_type){var t=n.event.sourceEvent;t&&"brush"===t.type||(e=t,r.zoom_onzoomstart.call(i.api,t))}}).on("zoom",function(){if("scroll"===r.zoom_type){var t=n.event.sourceEvent;t&&"brush"===t.type||(i.redrawForZoom(),r.zoom_onzoom.call(i.api,i.x.orgDomain()))}}).on("end",function(){if("scroll"===r.zoom_type){var t=n.event.sourceEvent;t&&"brush"===t.type||t&&e.clientX===t.clientX&&e.clientY===t.clientY||r.zoom_onzoomend.call(i.api,i.x.orgDomain())}}),i.zoom.updateDomain=function(){return n.event&&n.event.transform&&i.x.domain(n.event.transform.rescaleX(i.subX).domain()),this},i.zoom.updateExtent=function(){return this.scaleExtent([1,1/0]).translateExtent([[0,0],[i.width,i.height]]).extent([[0,0],[i.width,i.height]]),this},i.zoom.update=function(){return this.updateExtent().updateDomain()},i.zoom.updateExtent()},l.prototype.zoomTransform=function(t){var e=[this.x(t[0]),this.x(t[1])];return this.d3.zoomIdentity.scale(this.width/(e[1]-e[0])).translate(-e[0],0)},l.prototype.initDragZoom=function(){var e=this,i=e.d3,n=e.config,t=e.context=e.svg,r=e.margin.left+20.5,a=e.margin.top+.5;if("drag"===n.zoom_type&&n.zoom_enabled){var o=function(t){return t&&t.map(function(t){return e.x.invert(t)})},s=e.dragZoomBrush=i.brushX().on("start",function(){e.api.unzoom(),e.svg.select("."+N.dragZoom).classed("disabled",!1),n.zoom_onzoomstart.call(e.api,i.event.sourceEvent)}).on("brush",function(){n.zoom_onzoom.call(e.api,o(i.event.selection))}).on("end",function(){if(null!=i.event.selection){var t=o(i.event.selection);n.zoom_disableDefaultBehavior||e.api.zoom(t),e.svg.select("."+N.dragZoom).classed("disabled",!0),n.zoom_onzoomend.call(e.api,t)}});t.append("g").classed(N.dragZoom,!0).attr("clip-path",e.clipPath).attr("transform","translate("+r+","+a+")").call(s)}},l.prototype.getZoomDomain=function(){var t=this.config,e=this.d3;return[e.min([this.orgXDomain[0],t.zoom_x_min]),e.max([this.orgXDomain[1],t.zoom_x_max])]},l.prototype.redrawForZoom=function(){var t=this,e=t.d3,i=t.config,n=t.zoom,r=t.x;i.zoom_enabled&&0!==t.filterTargetsToShow(t.data.targets).length&&(n.update(),i.zoom_disableDefaultBehavior||(t.isCategorized()&&r.orgDomain()[0]===t.orgXDomain[0]&&r.domain([t.orgXDomain[0]-1e-10,r.orgDomain()[1]]),t.redraw({withTransition:!1,withY:i.zoom_rescale,withSubchart:!1,withEventRect:!1,withDimension:!1}),e.event.sourceEvent&&"mousemove"===e.event.sourceEvent.type&&(t.cancelClick=!0)))},t});
// Source: public/lib/d3/d3.min.js
// https://d3js.org v5.9.7 Copyright 2019 Mike Bostock
!function(t,n){"object"==typeof exports&&"undefined"!=typeof module?n(exports):"function"==typeof define&&define.amd?define(["exports"],n):n(t.d3=t.d3||{})}(this,function(t){"use strict";function n(t,n){return t<n?-1:t>n?1:t>=n?0:NaN}function e(t){var e;return 1===t.length&&(e=t,t=function(t,r){return n(e(t),r)}),{left:function(n,e,r,i){for(null==r&&(r=0),null==i&&(i=n.length);r<i;){var o=r+i>>>1;t(n[o],e)<0?r=o+1:i=o}return r},right:function(n,e,r,i){for(null==r&&(r=0),null==i&&(i=n.length);r<i;){var o=r+i>>>1;t(n[o],e)>0?i=o:r=o+1}return r}}}var r=e(n),i=r.right,o=r.left;function a(t,n){return[t,n]}function u(t){return null===t?NaN:+t}function c(t,n){var e,r,i=t.length,o=0,a=-1,c=0,f=0;if(null==n)for(;++a<i;)isNaN(e=u(t[a]))||(f+=(r=e-c)*(e-(c+=r/++o)));else for(;++a<i;)isNaN(e=u(n(t[a],a,t)))||(f+=(r=e-c)*(e-(c+=r/++o)));if(o>1)return f/(o-1)}function f(t,n){var e=c(t,n);return e?Math.sqrt(e):e}function s(t,n){var e,r,i,o=t.length,a=-1;if(null==n){for(;++a<o;)if(null!=(e=t[a])&&e>=e)for(r=i=e;++a<o;)null!=(e=t[a])&&(r>e&&(r=e),i<e&&(i=e))}else for(;++a<o;)if(null!=(e=n(t[a],a,t))&&e>=e)for(r=i=e;++a<o;)null!=(e=n(t[a],a,t))&&(r>e&&(r=e),i<e&&(i=e));return[r,i]}var l=Array.prototype,h=l.slice,d=l.map;function p(t){return function(){return t}}function v(t){return t}function g(t,n,e){t=+t,n=+n,e=(i=arguments.length)<2?(n=t,t=0,1):i<3?1:+e;for(var r=-1,i=0|Math.max(0,Math.ceil((n-t)/e)),o=new Array(i);++r<i;)o[r]=t+r*e;return o}var y=Math.sqrt(50),_=Math.sqrt(10),b=Math.sqrt(2);function m(t,n,e){var r,i,o,a,u=-1;if(e=+e,(t=+t)===(n=+n)&&e>0)return[t];if((r=n<t)&&(i=t,t=n,n=i),0===(a=x(t,n,e))||!isFinite(a))return[];if(a>0)for(t=Math.ceil(t/a),n=Math.floor(n/a),o=new Array(i=Math.ceil(n-t+1));++u<i;)o[u]=(t+u)*a;else for(t=Math.floor(t*a),n=Math.ceil(n*a),o=new Array(i=Math.ceil(t-n+1));++u<i;)o[u]=(t-u)/a;return r&&o.reverse(),o}function x(t,n,e){var r=(n-t)/Math.max(0,e),i=Math.floor(Math.log(r)/Math.LN10),o=r/Math.pow(10,i);return i>=0?(o>=y?10:o>=_?5:o>=b?2:1)*Math.pow(10,i):-Math.pow(10,-i)/(o>=y?10:o>=_?5:o>=b?2:1)}function w(t,n,e){var r=Math.abs(n-t)/Math.max(0,e),i=Math.pow(10,Math.floor(Math.log(r)/Math.LN10)),o=r/i;return o>=y?i*=10:o>=_?i*=5:o>=b&&(i*=2),n<t?-i:i}function M(t){return Math.ceil(Math.log(t.length)/Math.LN2)+1}function N(t,n,e){if(null==e&&(e=u),r=t.length){if((n=+n)<=0||r<2)return+e(t[0],0,t);if(n>=1)return+e(t[r-1],r-1,t);var r,i=(r-1)*n,o=Math.floor(i),a=+e(t[o],o,t);return a+(+e(t[o+1],o+1,t)-a)*(i-o)}}function A(t,n){var e,r,i=t.length,o=-1;if(null==n){for(;++o<i;)if(null!=(e=t[o])&&e>=e)for(r=e;++o<i;)null!=(e=t[o])&&e>r&&(r=e)}else for(;++o<i;)if(null!=(e=n(t[o],o,t))&&e>=e)for(r=e;++o<i;)null!=(e=n(t[o],o,t))&&e>r&&(r=e);return r}function T(t){for(var n,e,r,i=t.length,o=-1,a=0;++o<i;)a+=t[o].length;for(e=new Array(a);--i>=0;)for(n=(r=t[i]).length;--n>=0;)e[--a]=r[n];return e}function S(t,n){var e,r,i=t.length,o=-1;if(null==n){for(;++o<i;)if(null!=(e=t[o])&&e>=e)for(r=e;++o<i;)null!=(e=t[o])&&r>e&&(r=e)}else for(;++o<i;)if(null!=(e=n(t[o],o,t))&&e>=e)for(r=e;++o<i;)null!=(e=n(t[o],o,t))&&r>e&&(r=e);return r}function k(t){if(!(i=t.length))return[];for(var n=-1,e=S(t,E),r=new Array(e);++n<e;)for(var i,o=-1,a=r[n]=new Array(i);++o<i;)a[o]=t[o][n];return r}function E(t){return t.length}var C=Array.prototype.slice;function P(t){return t}var z=1,R=2,D=3,q=4,L=1e-6;function U(t){return"translate("+(t+.5)+",0)"}function O(t){return"translate(0,"+(t+.5)+")"}function B(){return!this.__axis}function Y(t,n){var e=[],r=null,i=null,o=6,a=6,u=3,c=t===z||t===q?-1:1,f=t===q||t===R?"x":"y",s=t===z||t===D?U:O;function l(l){var h=null==r?n.ticks?n.ticks.apply(n,e):n.domain():r,d=null==i?n.tickFormat?n.tickFormat.apply(n,e):P:i,p=Math.max(o,0)+u,v=n.range(),g=+v[0]+.5,y=+v[v.length-1]+.5,_=(n.bandwidth?function(t){var n=Math.max(0,t.bandwidth()-1)/2;return t.round()&&(n=Math.round(n)),function(e){return+t(e)+n}}:function(t){return function(n){return+t(n)}})(n.copy()),b=l.selection?l.selection():l,m=b.selectAll(".domain").data([null]),x=b.selectAll(".tick").data(h,n).order(),w=x.exit(),M=x.enter().append("g").attr("class","tick"),N=x.select("line"),A=x.select("text");m=m.merge(m.enter().insert("path",".tick").attr("class","domain").attr("stroke","currentColor")),x=x.merge(M),N=N.merge(M.append("line").attr("stroke","currentColor").attr(f+"2",c*o)),A=A.merge(M.append("text").attr("fill","currentColor").attr(f,c*p).attr("dy",t===z?"0em":t===D?"0.71em":"0.32em")),l!==b&&(m=m.transition(l),x=x.transition(l),N=N.transition(l),A=A.transition(l),w=w.transition(l).attr("opacity",L).attr("transform",function(t){return isFinite(t=_(t))?s(t):this.getAttribute("transform")}),M.attr("opacity",L).attr("transform",function(t){var n=this.parentNode.__axis;return s(n&&isFinite(n=n(t))?n:_(t))})),w.remove(),m.attr("d",t===q||t==R?a?"M"+c*a+","+g+"H0.5V"+y+"H"+c*a:"M0.5,"+g+"V"+y:a?"M"+g+","+c*a+"V0.5H"+y+"V"+c*a:"M"+g+",0.5H"+y),x.attr("opacity",1).attr("transform",function(t){return s(_(t))}),N.attr(f+"2",c*o),A.attr(f,c*p).text(d),b.filter(B).attr("fill","none").attr("font-size",10).attr("font-family","sans-serif").attr("text-anchor",t===R?"start":t===q?"end":"middle"),b.each(function(){this.__axis=_})}return l.scale=function(t){return arguments.length?(n=t,l):n},l.ticks=function(){return e=C.call(arguments),l},l.tickArguments=function(t){return arguments.length?(e=null==t?[]:C.call(t),l):e.slice()},l.tickValues=function(t){return arguments.length?(r=null==t?null:C.call(t),l):r&&r.slice()},l.tickFormat=function(t){return arguments.length?(i=t,l):i},l.tickSize=function(t){return arguments.length?(o=a=+t,l):o},l.tickSizeInner=function(t){return arguments.length?(o=+t,l):o},l.tickSizeOuter=function(t){return arguments.length?(a=+t,l):a},l.tickPadding=function(t){return arguments.length?(u=+t,l):u},l}var F={value:function(){}};function I(){for(var t,n=0,e=arguments.length,r={};n<e;++n){if(!(t=arguments[n]+"")||t in r)throw new Error("illegal type: "+t);r[t]=[]}return new j(r)}function j(t){this._=t}function H(t,n){for(var e,r=0,i=t.length;r<i;++r)if((e=t[r]).name===n)return e.value}function X(t,n,e){for(var r=0,i=t.length;r<i;++r)if(t[r].name===n){t[r]=F,t=t.slice(0,r).concat(t.slice(r+1));break}return null!=e&&t.push({name:n,value:e}),t}j.prototype=I.prototype={constructor:j,on:function(t,n){var e,r,i=this._,o=(r=i,(t+"").trim().split(/^|\s+/).map(function(t){var n="",e=t.indexOf(".");if(e>=0&&(n=t.slice(e+1),t=t.slice(0,e)),t&&!r.hasOwnProperty(t))throw new Error("unknown type: "+t);return{type:t,name:n}})),a=-1,u=o.length;if(!(arguments.length<2)){if(null!=n&&"function"!=typeof n)throw new Error("invalid callback: "+n);for(;++a<u;)if(e=(t=o[a]).type)i[e]=X(i[e],t.name,n);else if(null==n)for(e in i)i[e]=X(i[e],t.name,null);return this}for(;++a<u;)if((e=(t=o[a]).type)&&(e=H(i[e],t.name)))return e},copy:function(){var t={},n=this._;for(var e in n)t[e]=n[e].slice();return new j(t)},call:function(t,n){if((e=arguments.length-2)>0)for(var e,r,i=new Array(e),o=0;o<e;++o)i[o]=arguments[o+2];if(!this._.hasOwnProperty(t))throw new Error("unknown type: "+t);for(o=0,e=(r=this._[t]).length;o<e;++o)r[o].value.apply(n,i)},apply:function(t,n,e){if(!this._.hasOwnProperty(t))throw new Error("unknown type: "+t);for(var r=this._[t],i=0,o=r.length;i<o;++i)r[i].value.apply(n,e)}};var G="http://www.w3.org/1999/xhtml",V={svg:"http://www.w3.org/2000/svg",xhtml:G,xlink:"http://www.w3.org/1999/xlink",xml:"http://www.w3.org/XML/1998/namespace",xmlns:"http://www.w3.org/2000/xmlns/"};function $(t){var n=t+="",e=n.indexOf(":");return e>=0&&"xmlns"!==(n=t.slice(0,e))&&(t=t.slice(e+1)),V.hasOwnProperty(n)?{space:V[n],local:t}:t}function W(t){var n=$(t);return(n.local?function(t){return function(){return this.ownerDocument.createElementNS(t.space,t.local)}}:function(t){return function(){var n=this.ownerDocument,e=this.namespaceURI;return e===G&&n.documentElement.namespaceURI===G?n.createElement(t):n.createElementNS(e,t)}})(n)}function Z(){}function Q(t){return null==t?Z:function(){return this.querySelector(t)}}function J(){return[]}function K(t){return null==t?J:function(){return this.querySelectorAll(t)}}function tt(t){return function(){return this.matches(t)}}function nt(t){return new Array(t.length)}function et(t,n){this.ownerDocument=t.ownerDocument,this.namespaceURI=t.namespaceURI,this._next=null,this._parent=t,this.__data__=n}et.prototype={constructor:et,appendChild:function(t){return this._parent.insertBefore(t,this._next)},insertBefore:function(t,n){return this._parent.insertBefore(t,n)},querySelector:function(t){return this._parent.querySelector(t)},querySelectorAll:function(t){return this._parent.querySelectorAll(t)}};var rt="$";function it(t,n,e,r,i,o){for(var a,u=0,c=n.length,f=o.length;u<f;++u)(a=n[u])?(a.__data__=o[u],r[u]=a):e[u]=new et(t,o[u]);for(;u<c;++u)(a=n[u])&&(i[u]=a)}function ot(t,n,e,r,i,o,a){var u,c,f,s={},l=n.length,h=o.length,d=new Array(l);for(u=0;u<l;++u)(c=n[u])&&(d[u]=f=rt+a.call(c,c.__data__,u,n),f in s?i[u]=c:s[f]=c);for(u=0;u<h;++u)(c=s[f=rt+a.call(t,o[u],u,o)])?(r[u]=c,c.__data__=o[u],s[f]=null):e[u]=new et(t,o[u]);for(u=0;u<l;++u)(c=n[u])&&s[d[u]]===c&&(i[u]=c)}function at(t,n){return t<n?-1:t>n?1:t>=n?0:NaN}function ut(t){return t.ownerDocument&&t.ownerDocument.defaultView||t.document&&t||t.defaultView}function ct(t,n){return t.style.getPropertyValue(n)||ut(t).getComputedStyle(t,null).getPropertyValue(n)}function ft(t){return t.trim().split(/^|\s+/)}function st(t){return t.classList||new lt(t)}function lt(t){this._node=t,this._names=ft(t.getAttribute("class")||"")}function ht(t,n){for(var e=st(t),r=-1,i=n.length;++r<i;)e.add(n[r])}function dt(t,n){for(var e=st(t),r=-1,i=n.length;++r<i;)e.remove(n[r])}function pt(){this.textContent=""}function vt(){this.innerHTML=""}function gt(){this.nextSibling&&this.parentNode.appendChild(this)}function yt(){this.previousSibling&&this.parentNode.insertBefore(this,this.parentNode.firstChild)}function _t(){return null}function bt(){var t=this.parentNode;t&&t.removeChild(this)}function mt(){return this.parentNode.insertBefore(this.cloneNode(!1),this.nextSibling)}function xt(){return this.parentNode.insertBefore(this.cloneNode(!0),this.nextSibling)}lt.prototype={add:function(t){this._names.indexOf(t)<0&&(this._names.push(t),this._node.setAttribute("class",this._names.join(" ")))},remove:function(t){var n=this._names.indexOf(t);n>=0&&(this._names.splice(n,1),this._node.setAttribute("class",this._names.join(" ")))},contains:function(t){return this._names.indexOf(t)>=0}};var wt={};(t.event=null,"undefined"!=typeof document)&&("onmouseenter"in document.documentElement||(wt={mouseenter:"mouseover",mouseleave:"mouseout"}));function Mt(t,n,e){return t=Nt(t,n,e),function(n){var e=n.relatedTarget;e&&(e===this||8&e.compareDocumentPosition(this))||t.call(this,n)}}function Nt(n,e,r){return function(i){var o=t.event;t.event=i;try{n.call(this,this.__data__,e,r)}finally{t.event=o}}}function At(t){return function(){var n=this.__on;if(n){for(var e,r=0,i=-1,o=n.length;r<o;++r)e=n[r],t.type&&e.type!==t.type||e.name!==t.name?n[++i]=e:this.removeEventListener(e.type,e.listener,e.capture);++i?n.length=i:delete this.__on}}}function Tt(t,n,e){var r=wt.hasOwnProperty(t.type)?Mt:Nt;return function(i,o,a){var u,c=this.__on,f=r(n,o,a);if(c)for(var s=0,l=c.length;s<l;++s)if((u=c[s]).type===t.type&&u.name===t.name)return this.removeEventListener(u.type,u.listener,u.capture),this.addEventListener(u.type,u.listener=f,u.capture=e),void(u.value=n);this.addEventListener(t.type,f,e),u={type:t.type,name:t.name,value:n,listener:f,capture:e},c?c.push(u):this.__on=[u]}}function St(n,e,r,i){var o=t.event;n.sourceEvent=t.event,t.event=n;try{return e.apply(r,i)}finally{t.event=o}}function kt(t,n,e){var r=ut(t),i=r.CustomEvent;"function"==typeof i?i=new i(n,e):(i=r.document.createEvent("Event"),e?(i.initEvent(n,e.bubbles,e.cancelable),i.detail=e.detail):i.initEvent(n,!1,!1)),t.dispatchEvent(i)}var Et=[null];function Ct(t,n){this._groups=t,this._parents=n}function Pt(){return new Ct([[document.documentElement]],Et)}function zt(t){return"string"==typeof t?new Ct([[document.querySelector(t)]],[document.documentElement]):new Ct([[t]],Et)}Ct.prototype=Pt.prototype={constructor:Ct,select:function(t){"function"!=typeof t&&(t=Q(t));for(var n=this._groups,e=n.length,r=new Array(e),i=0;i<e;++i)for(var o,a,u=n[i],c=u.length,f=r[i]=new Array(c),s=0;s<c;++s)(o=u[s])&&(a=t.call(o,o.__data__,s,u))&&("__data__"in o&&(a.__data__=o.__data__),f[s]=a);return new Ct(r,this._parents)},selectAll:function(t){"function"!=typeof t&&(t=K(t));for(var n=this._groups,e=n.length,r=[],i=[],o=0;o<e;++o)for(var a,u=n[o],c=u.length,f=0;f<c;++f)(a=u[f])&&(r.push(t.call(a,a.__data__,f,u)),i.push(a));return new Ct(r,i)},filter:function(t){"function"!=typeof t&&(t=tt(t));for(var n=this._groups,e=n.length,r=new Array(e),i=0;i<e;++i)for(var o,a=n[i],u=a.length,c=r[i]=[],f=0;f<u;++f)(o=a[f])&&t.call(o,o.__data__,f,a)&&c.push(o);return new Ct(r,this._parents)},data:function(t,n){if(!t)return p=new Array(this.size()),s=-1,this.each(function(t){p[++s]=t}),p;var e,r=n?ot:it,i=this._parents,o=this._groups;"function"!=typeof t&&(e=t,t=function(){return e});for(var a=o.length,u=new Array(a),c=new Array(a),f=new Array(a),s=0;s<a;++s){var l=i[s],h=o[s],d=h.length,p=t.call(l,l&&l.__data__,s,i),v=p.length,g=c[s]=new Array(v),y=u[s]=new Array(v);r(l,h,g,y,f[s]=new Array(d),p,n);for(var _,b,m=0,x=0;m<v;++m)if(_=g[m]){for(m>=x&&(x=m+1);!(b=y[x])&&++x<v;);_._next=b||null}}return(u=new Ct(u,i))._enter=c,u._exit=f,u},enter:function(){return new Ct(this._enter||this._groups.map(nt),this._parents)},exit:function(){return new Ct(this._exit||this._groups.map(nt),this._parents)},join:function(t,n,e){var r=this.enter(),i=this,o=this.exit();return r="function"==typeof t?t(r):r.append(t+""),null!=n&&(i=n(i)),null==e?o.remove():e(o),r&&i?r.merge(i).order():i},merge:function(t){for(var n=this._groups,e=t._groups,r=n.length,i=e.length,o=Math.min(r,i),a=new Array(r),u=0;u<o;++u)for(var c,f=n[u],s=e[u],l=f.length,h=a[u]=new Array(l),d=0;d<l;++d)(c=f[d]||s[d])&&(h[d]=c);for(;u<r;++u)a[u]=n[u];return new Ct(a,this._parents)},order:function(){for(var t=this._groups,n=-1,e=t.length;++n<e;)for(var r,i=t[n],o=i.length-1,a=i[o];--o>=0;)(r=i[o])&&(a&&4^r.compareDocumentPosition(a)&&a.parentNode.insertBefore(r,a),a=r);return this},sort:function(t){function n(n,e){return n&&e?t(n.__data__,e.__data__):!n-!e}t||(t=at);for(var e=this._groups,r=e.length,i=new Array(r),o=0;o<r;++o){for(var a,u=e[o],c=u.length,f=i[o]=new Array(c),s=0;s<c;++s)(a=u[s])&&(f[s]=a);f.sort(n)}return new Ct(i,this._parents).order()},call:function(){var t=arguments[0];return arguments[0]=this,t.apply(null,arguments),this},nodes:function(){var t=new Array(this.size()),n=-1;return this.each(function(){t[++n]=this}),t},node:function(){for(var t=this._groups,n=0,e=t.length;n<e;++n)for(var r=t[n],i=0,o=r.length;i<o;++i){var a=r[i];if(a)return a}return null},size:function(){var t=0;return this.each(function(){++t}),t},empty:function(){return!this.node()},each:function(t){for(var n=this._groups,e=0,r=n.length;e<r;++e)for(var i,o=n[e],a=0,u=o.length;a<u;++a)(i=o[a])&&t.call(i,i.__data__,a,o);return this},attr:function(t,n){var e=$(t);if(arguments.length<2){var r=this.node();return e.local?r.getAttributeNS(e.space,e.local):r.getAttribute(e)}return this.each((null==n?e.local?function(t){return function(){this.removeAttributeNS(t.space,t.local)}}:function(t){return function(){this.removeAttribute(t)}}:"function"==typeof n?e.local?function(t,n){return function(){var e=n.apply(this,arguments);null==e?this.removeAttributeNS(t.space,t.local):this.setAttributeNS(t.space,t.local,e)}}:function(t,n){return function(){var e=n.apply(this,arguments);null==e?this.removeAttribute(t):this.setAttribute(t,e)}}:e.local?function(t,n){return function(){this.setAttributeNS(t.space,t.local,n)}}:function(t,n){return function(){this.setAttribute(t,n)}})(e,n))},style:function(t,n,e){return arguments.length>1?this.each((null==n?function(t){return function(){this.style.removeProperty(t)}}:"function"==typeof n?function(t,n,e){return function(){var r=n.apply(this,arguments);null==r?this.style.removeProperty(t):this.style.setProperty(t,r,e)}}:function(t,n,e){return function(){this.style.setProperty(t,n,e)}})(t,n,null==e?"":e)):ct(this.node(),t)},property:function(t,n){return arguments.length>1?this.each((null==n?function(t){return function(){delete this[t]}}:"function"==typeof n?function(t,n){return function(){var e=n.apply(this,arguments);null==e?delete this[t]:this[t]=e}}:function(t,n){return function(){this[t]=n}})(t,n)):this.node()[t]},classed:function(t,n){var e=ft(t+"");if(arguments.length<2){for(var r=st(this.node()),i=-1,o=e.length;++i<o;)if(!r.contains(e[i]))return!1;return!0}return this.each(("function"==typeof n?function(t,n){return function(){(n.apply(this,arguments)?ht:dt)(this,t)}}:n?function(t){return function(){ht(this,t)}}:function(t){return function(){dt(this,t)}})(e,n))},text:function(t){return arguments.length?this.each(null==t?pt:("function"==typeof t?function(t){return function(){var n=t.apply(this,arguments);this.textContent=null==n?"":n}}:function(t){return function(){this.textContent=t}})(t)):this.node().textContent},html:function(t){return arguments.length?this.each(null==t?vt:("function"==typeof t?function(t){return function(){var n=t.apply(this,arguments);this.innerHTML=null==n?"":n}}:function(t){return function(){this.innerHTML=t}})(t)):this.node().innerHTML},raise:function(){return this.each(gt)},lower:function(){return this.each(yt)},append:function(t){var n="function"==typeof t?t:W(t);return this.select(function(){return this.appendChild(n.apply(this,arguments))})},insert:function(t,n){var e="function"==typeof t?t:W(t),r=null==n?_t:"function"==typeof n?n:Q(n);return this.select(function(){return this.insertBefore(e.apply(this,arguments),r.apply(this,arguments)||null)})},remove:function(){return this.each(bt)},clone:function(t){return this.select(t?xt:mt)},datum:function(t){return arguments.length?this.property("__data__",t):this.node().__data__},on:function(t,n,e){var r,i,o=function(t){return t.trim().split(/^|\s+/).map(function(t){var n="",e=t.indexOf(".");return e>=0&&(n=t.slice(e+1),t=t.slice(0,e)),{type:t,name:n}})}(t+""),a=o.length;if(!(arguments.length<2)){for(u=n?Tt:At,null==e&&(e=!1),r=0;r<a;++r)this.each(u(o[r],n,e));return this}var u=this.node().__on;if(u)for(var c,f=0,s=u.length;f<s;++f)for(r=0,c=u[f];r<a;++r)if((i=o[r]).type===c.type&&i.name===c.name)return c.value},dispatch:function(t,n){return this.each(("function"==typeof n?function(t,n){return function(){return kt(this,t,n.apply(this,arguments))}}:function(t,n){return function(){return kt(this,t,n)}})(t,n))}};var Rt=0;function Dt(){return new qt}function qt(){this._="@"+(++Rt).toString(36)}function Lt(){for(var n,e=t.event;n=e.sourceEvent;)e=n;return e}function Ut(t,n){var e=t.ownerSVGElement||t;if(e.createSVGPoint){var r=e.createSVGPoint();return r.x=n.clientX,r.y=n.clientY,[(r=r.matrixTransform(t.getScreenCTM().inverse())).x,r.y]}var i=t.getBoundingClientRect();return[n.clientX-i.left-t.clientLeft,n.clientY-i.top-t.clientTop]}function Ot(t){var n=Lt();return n.changedTouches&&(n=n.changedTouches[0]),Ut(t,n)}function Bt(t,n,e){arguments.length<3&&(e=n,n=Lt().changedTouches);for(var r,i=0,o=n?n.length:0;i<o;++i)if((r=n[i]).identifier===e)return Ut(t,r);return null}function Yt(){t.event.stopImmediatePropagation()}function Ft(){t.event.preventDefault(),t.event.stopImmediatePropagation()}function It(t){var n=t.document.documentElement,e=zt(t).on("dragstart.drag",Ft,!0);"onselectstart"in n?e.on("selectstart.drag",Ft,!0):(n.__noselect=n.style.MozUserSelect,n.style.MozUserSelect="none")}function jt(t,n){var e=t.document.documentElement,r=zt(t).on("dragstart.drag",null);n&&(r.on("click.drag",Ft,!0),setTimeout(function(){r.on("click.drag",null)},0)),"onselectstart"in e?r.on("selectstart.drag",null):(e.style.MozUserSelect=e.__noselect,delete e.__noselect)}function Ht(t){return function(){return t}}function Xt(t,n,e,r,i,o,a,u,c,f){this.target=t,this.type=n,this.subject=e,this.identifier=r,this.active=i,this.x=o,this.y=a,this.dx=u,this.dy=c,this._=f}function Gt(){return!t.event.button}function Vt(){return this.parentNode}function $t(n){return null==n?{x:t.event.x,y:t.event.y}:n}function Wt(){return"ontouchstart"in this}function Zt(t,n,e){t.prototype=n.prototype=e,e.constructor=t}function Qt(t,n){var e=Object.create(t.prototype);for(var r in n)e[r]=n[r];return e}function Jt(){}qt.prototype=Dt.prototype={constructor:qt,get:function(t){for(var n=this._;!(n in t);)if(!(t=t.parentNode))return;return t[n]},set:function(t,n){return t[this._]=n},remove:function(t){return this._ in t&&delete t[this._]},toString:function(){return this._}},Xt.prototype.on=function(){var t=this._.on.apply(this._,arguments);return t===this._?this:t};var Kt="\\s*([+-]?\\d+)\\s*",tn="\\s*([+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?)\\s*",nn="\\s*([+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?)%\\s*",en=/^#([0-9a-f]{3})$/,rn=/^#([0-9a-f]{6})$/,on=new RegExp("^rgb\\("+[Kt,Kt,Kt]+"\\)$"),an=new RegExp("^rgb\\("+[nn,nn,nn]+"\\)$"),un=new RegExp("^rgba\\("+[Kt,Kt,Kt,tn]+"\\)$"),cn=new RegExp("^rgba\\("+[nn,nn,nn,tn]+"\\)$"),fn=new RegExp("^hsl\\("+[tn,nn,nn]+"\\)$"),sn=new RegExp("^hsla\\("+[tn,nn,nn,tn]+"\\)$"),ln={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074};function hn(t){var n;return t=(t+"").trim().toLowerCase(),(n=en.exec(t))?new yn((n=parseInt(n[1],16))>>8&15|n>>4&240,n>>4&15|240&n,(15&n)<<4|15&n,1):(n=rn.exec(t))?dn(parseInt(n[1],16)):(n=on.exec(t))?new yn(n[1],n[2],n[3],1):(n=an.exec(t))?new yn(255*n[1]/100,255*n[2]/100,255*n[3]/100,1):(n=un.exec(t))?pn(n[1],n[2],n[3],n[4]):(n=cn.exec(t))?pn(255*n[1]/100,255*n[2]/100,255*n[3]/100,n[4]):(n=fn.exec(t))?bn(n[1],n[2]/100,n[3]/100,1):(n=sn.exec(t))?bn(n[1],n[2]/100,n[3]/100,n[4]):ln.hasOwnProperty(t)?dn(ln[t]):"transparent"===t?new yn(NaN,NaN,NaN,0):null}function dn(t){return new yn(t>>16&255,t>>8&255,255&t,1)}function pn(t,n,e,r){return r<=0&&(t=n=e=NaN),new yn(t,n,e,r)}function vn(t){return t instanceof Jt||(t=hn(t)),t?new yn((t=t.rgb()).r,t.g,t.b,t.opacity):new yn}function gn(t,n,e,r){return 1===arguments.length?vn(t):new yn(t,n,e,null==r?1:r)}function yn(t,n,e,r){this.r=+t,this.g=+n,this.b=+e,this.opacity=+r}function _n(t){return((t=Math.max(0,Math.min(255,Math.round(t)||0)))<16?"0":"")+t.toString(16)}function bn(t,n,e,r){return r<=0?t=n=e=NaN:e<=0||e>=1?t=n=NaN:n<=0&&(t=NaN),new xn(t,n,e,r)}function mn(t,n,e,r){return 1===arguments.length?function(t){if(t instanceof xn)return new xn(t.h,t.s,t.l,t.opacity);if(t instanceof Jt||(t=hn(t)),!t)return new xn;if(t instanceof xn)return t;var n=(t=t.rgb()).r/255,e=t.g/255,r=t.b/255,i=Math.min(n,e,r),o=Math.max(n,e,r),a=NaN,u=o-i,c=(o+i)/2;return u?(a=n===o?(e-r)/u+6*(e<r):e===o?(r-n)/u+2:(n-e)/u+4,u/=c<.5?o+i:2-o-i,a*=60):u=c>0&&c<1?0:a,new xn(a,u,c,t.opacity)}(t):new xn(t,n,e,null==r?1:r)}function xn(t,n,e,r){this.h=+t,this.s=+n,this.l=+e,this.opacity=+r}function wn(t,n,e){return 255*(t<60?n+(e-n)*t/60:t<180?e:t<240?n+(e-n)*(240-t)/60:n)}Zt(Jt,hn,{displayable:function(){return this.rgb().displayable()},hex:function(){return this.rgb().hex()},toString:function(){return this.rgb()+""}}),Zt(yn,gn,Qt(Jt,{brighter:function(t){return t=null==t?1/.7:Math.pow(1/.7,t),new yn(this.r*t,this.g*t,this.b*t,this.opacity)},darker:function(t){return t=null==t?.7:Math.pow(.7,t),new yn(this.r*t,this.g*t,this.b*t,this.opacity)},rgb:function(){return this},displayable:function(){return-.5<=this.r&&this.r<255.5&&-.5<=this.g&&this.g<255.5&&-.5<=this.b&&this.b<255.5&&0<=this.opacity&&this.opacity<=1},hex:function(){return"#"+_n(this.r)+_n(this.g)+_n(this.b)},toString:function(){var t=this.opacity;return(1===(t=isNaN(t)?1:Math.max(0,Math.min(1,t)))?"rgb(":"rgba(")+Math.max(0,Math.min(255,Math.round(this.r)||0))+", "+Math.max(0,Math.min(255,Math.round(this.g)||0))+", "+Math.max(0,Math.min(255,Math.round(this.b)||0))+(1===t?")":", "+t+")")}})),Zt(xn,mn,Qt(Jt,{brighter:function(t){return t=null==t?1/.7:Math.pow(1/.7,t),new xn(this.h,this.s,this.l*t,this.opacity)},darker:function(t){return t=null==t?.7:Math.pow(.7,t),new xn(this.h,this.s,this.l*t,this.opacity)},rgb:function(){var t=this.h%360+360*(this.h<0),n=isNaN(t)||isNaN(this.s)?0:this.s,e=this.l,r=e+(e<.5?e:1-e)*n,i=2*e-r;return new yn(wn(t>=240?t-240:t+120,i,r),wn(t,i,r),wn(t<120?t+240:t-120,i,r),this.opacity)},displayable:function(){return(0<=this.s&&this.s<=1||isNaN(this.s))&&0<=this.l&&this.l<=1&&0<=this.opacity&&this.opacity<=1}}));var Mn=Math.PI/180,Nn=180/Math.PI,An=.96422,Tn=1,Sn=.82521,kn=4/29,En=6/29,Cn=3*En*En,Pn=En*En*En;function zn(t){if(t instanceof Dn)return new Dn(t.l,t.a,t.b,t.opacity);if(t instanceof Fn)return In(t);t instanceof yn||(t=vn(t));var n,e,r=On(t.r),i=On(t.g),o=On(t.b),a=qn((.2225045*r+.7168786*i+.0606169*o)/Tn);return r===i&&i===o?n=e=a:(n=qn((.4360747*r+.3850649*i+.1430804*o)/An),e=qn((.0139322*r+.0971045*i+.7141733*o)/Sn)),new Dn(116*a-16,500*(n-a),200*(a-e),t.opacity)}function Rn(t,n,e,r){return 1===arguments.length?zn(t):new Dn(t,n,e,null==r?1:r)}function Dn(t,n,e,r){this.l=+t,this.a=+n,this.b=+e,this.opacity=+r}function qn(t){return t>Pn?Math.pow(t,1/3):t/Cn+kn}function Ln(t){return t>En?t*t*t:Cn*(t-kn)}function Un(t){return 255*(t<=.0031308?12.92*t:1.055*Math.pow(t,1/2.4)-.055)}function On(t){return(t/=255)<=.04045?t/12.92:Math.pow((t+.055)/1.055,2.4)}function Bn(t){if(t instanceof Fn)return new Fn(t.h,t.c,t.l,t.opacity);if(t instanceof Dn||(t=zn(t)),0===t.a&&0===t.b)return new Fn(NaN,0<t.l&&t.l<100?0:NaN,t.l,t.opacity);var n=Math.atan2(t.b,t.a)*Nn;return new Fn(n<0?n+360:n,Math.sqrt(t.a*t.a+t.b*t.b),t.l,t.opacity)}function Yn(t,n,e,r){return 1===arguments.length?Bn(t):new Fn(t,n,e,null==r?1:r)}function Fn(t,n,e,r){this.h=+t,this.c=+n,this.l=+e,this.opacity=+r}function In(t){if(isNaN(t.h))return new Dn(t.l,0,0,t.opacity);var n=t.h*Mn;return new Dn(t.l,Math.cos(n)*t.c,Math.sin(n)*t.c,t.opacity)}Zt(Dn,Rn,Qt(Jt,{brighter:function(t){return new Dn(this.l+18*(null==t?1:t),this.a,this.b,this.opacity)},darker:function(t){return new Dn(this.l-18*(null==t?1:t),this.a,this.b,this.opacity)},rgb:function(){var t=(this.l+16)/116,n=isNaN(this.a)?t:t+this.a/500,e=isNaN(this.b)?t:t-this.b/200;return new yn(Un(3.1338561*(n=An*Ln(n))-1.6168667*(t=Tn*Ln(t))-.4906146*(e=Sn*Ln(e))),Un(-.9787684*n+1.9161415*t+.033454*e),Un(.0719453*n-.2289914*t+1.4052427*e),this.opacity)}})),Zt(Fn,Yn,Qt(Jt,{brighter:function(t){return new Fn(this.h,this.c,this.l+18*(null==t?1:t),this.opacity)},darker:function(t){return new Fn(this.h,this.c,this.l-18*(null==t?1:t),this.opacity)},rgb:function(){return In(this).rgb()}}));var jn=-.14861,Hn=1.78277,Xn=-.29227,Gn=-.90649,Vn=1.97294,$n=Vn*Gn,Wn=Vn*Hn,Zn=Hn*Xn-Gn*jn;function Qn(t,n,e,r){return 1===arguments.length?function(t){if(t instanceof Jn)return new Jn(t.h,t.s,t.l,t.opacity);t instanceof yn||(t=vn(t));var n=t.r/255,e=t.g/255,r=t.b/255,i=(Zn*r+$n*n-Wn*e)/(Zn+$n-Wn),o=r-i,a=(Vn*(e-i)-Xn*o)/Gn,u=Math.sqrt(a*a+o*o)/(Vn*i*(1-i)),c=u?Math.atan2(a,o)*Nn-120:NaN;return new Jn(c<0?c+360:c,u,i,t.opacity)}(t):new Jn(t,n,e,null==r?1:r)}function Jn(t,n,e,r){this.h=+t,this.s=+n,this.l=+e,this.opacity=+r}function Kn(t,n,e,r,i){var o=t*t,a=o*t;return((1-3*t+3*o-a)*n+(4-6*o+3*a)*e+(1+3*t+3*o-3*a)*r+a*i)/6}function te(t){var n=t.length-1;return function(e){var r=e<=0?e=0:e>=1?(e=1,n-1):Math.floor(e*n),i=t[r],o=t[r+1],a=r>0?t[r-1]:2*i-o,u=r<n-1?t[r+2]:2*o-i;return Kn((e-r/n)*n,a,i,o,u)}}function ne(t){var n=t.length;return function(e){var r=Math.floor(((e%=1)<0?++e:e)*n),i=t[(r+n-1)%n],o=t[r%n],a=t[(r+1)%n],u=t[(r+2)%n];return Kn((e-r/n)*n,i,o,a,u)}}function ee(t){return function(){return t}}function re(t,n){return function(e){return t+e*n}}function ie(t,n){var e=n-t;return e?re(t,e>180||e<-180?e-360*Math.round(e/360):e):ee(isNaN(t)?n:t)}function oe(t){return 1==(t=+t)?ae:function(n,e){return e-n?function(t,n,e){return t=Math.pow(t,e),n=Math.pow(n,e)-t,e=1/e,function(r){return Math.pow(t+r*n,e)}}(n,e,t):ee(isNaN(n)?e:n)}}function ae(t,n){var e=n-t;return e?re(t,e):ee(isNaN(t)?n:t)}Zt(Jn,Qn,Qt(Jt,{brighter:function(t){return t=null==t?1/.7:Math.pow(1/.7,t),new Jn(this.h,this.s,this.l*t,this.opacity)},darker:function(t){return t=null==t?.7:Math.pow(.7,t),new Jn(this.h,this.s,this.l*t,this.opacity)},rgb:function(){var t=isNaN(this.h)?0:(this.h+120)*Mn,n=+this.l,e=isNaN(this.s)?0:this.s*n*(1-n),r=Math.cos(t),i=Math.sin(t);return new yn(255*(n+e*(jn*r+Hn*i)),255*(n+e*(Xn*r+Gn*i)),255*(n+e*(Vn*r)),this.opacity)}}));var ue=function t(n){var e=oe(n);function r(t,n){var r=e((t=gn(t)).r,(n=gn(n)).r),i=e(t.g,n.g),o=e(t.b,n.b),a=ae(t.opacity,n.opacity);return function(n){return t.r=r(n),t.g=i(n),t.b=o(n),t.opacity=a(n),t+""}}return r.gamma=t,r}(1);function ce(t){return function(n){var e,r,i=n.length,o=new Array(i),a=new Array(i),u=new Array(i);for(e=0;e<i;++e)r=gn(n[e]),o[e]=r.r||0,a[e]=r.g||0,u[e]=r.b||0;return o=t(o),a=t(a),u=t(u),r.opacity=1,function(t){return r.r=o(t),r.g=a(t),r.b=u(t),r+""}}}var fe=ce(te),se=ce(ne);function le(t,n){var e,r=n?n.length:0,i=t?Math.min(r,t.length):0,o=new Array(i),a=new Array(r);for(e=0;e<i;++e)o[e]=_e(t[e],n[e]);for(;e<r;++e)a[e]=n[e];return function(t){for(e=0;e<i;++e)a[e]=o[e](t);return a}}function he(t,n){var e=new Date;return n-=t=+t,function(r){return e.setTime(t+n*r),e}}function de(t,n){return n-=t=+t,function(e){return t+n*e}}function pe(t,n){var e,r={},i={};for(e in null!==t&&"object"==typeof t||(t={}),null!==n&&"object"==typeof n||(n={}),n)e in t?r[e]=_e(t[e],n[e]):i[e]=n[e];return function(t){for(e in r)i[e]=r[e](t);return i}}var ve=/[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g,ge=new RegExp(ve.source,"g");function ye(t,n){var e,r,i,o=ve.lastIndex=ge.lastIndex=0,a=-1,u=[],c=[];for(t+="",n+="";(e=ve.exec(t))&&(r=ge.exec(n));)(i=r.index)>o&&(i=n.slice(o,i),u[a]?u[a]+=i:u[++a]=i),(e=e[0])===(r=r[0])?u[a]?u[a]+=r:u[++a]=r:(u[++a]=null,c.push({i:a,x:de(e,r)})),o=ge.lastIndex;return o<n.length&&(i=n.slice(o),u[a]?u[a]+=i:u[++a]=i),u.length<2?c[0]?function(t){return function(n){return t(n)+""}}(c[0].x):function(t){return function(){return t}}(n):(n=c.length,function(t){for(var e,r=0;r<n;++r)u[(e=c[r]).i]=e.x(t);return u.join("")})}function _e(t,n){var e,r=typeof n;return null==n||"boolean"===r?ee(n):("number"===r?de:"string"===r?(e=hn(n))?(n=e,ue):ye:n instanceof hn?ue:n instanceof Date?he:Array.isArray(n)?le:"function"!=typeof n.valueOf&&"function"!=typeof n.toString||isNaN(n)?pe:de)(t,n)}function be(t,n){return n-=t=+t,function(e){return Math.round(t+n*e)}}var me,xe,we,Me,Ne=180/Math.PI,Ae={translateX:0,translateY:0,rotate:0,skewX:0,scaleX:1,scaleY:1};function Te(t,n,e,r,i,o){var a,u,c;return(a=Math.sqrt(t*t+n*n))&&(t/=a,n/=a),(c=t*e+n*r)&&(e-=t*c,r-=n*c),(u=Math.sqrt(e*e+r*r))&&(e/=u,r/=u,c/=u),t*r<n*e&&(t=-t,n=-n,c=-c,a=-a),{translateX:i,translateY:o,rotate:Math.atan2(n,t)*Ne,skewX:Math.atan(c)*Ne,scaleX:a,scaleY:u}}function Se(t,n,e,r){function i(t){return t.length?t.pop()+" ":""}return function(o,a){var u=[],c=[];return o=t(o),a=t(a),function(t,r,i,o,a,u){if(t!==i||r!==o){var c=a.push("translate(",null,n,null,e);u.push({i:c-4,x:de(t,i)},{i:c-2,x:de(r,o)})}else(i||o)&&a.push("translate("+i+n+o+e)}(o.translateX,o.translateY,a.translateX,a.translateY,u,c),function(t,n,e,o){t!==n?(t-n>180?n+=360:n-t>180&&(t+=360),o.push({i:e.push(i(e)+"rotate(",null,r)-2,x:de(t,n)})):n&&e.push(i(e)+"rotate("+n+r)}(o.rotate,a.rotate,u,c),function(t,n,e,o){t!==n?o.push({i:e.push(i(e)+"skewX(",null,r)-2,x:de(t,n)}):n&&e.push(i(e)+"skewX("+n+r)}(o.skewX,a.skewX,u,c),function(t,n,e,r,o,a){if(t!==e||n!==r){var u=o.push(i(o)+"scale(",null,",",null,")");a.push({i:u-4,x:de(t,e)},{i:u-2,x:de(n,r)})}else 1===e&&1===r||o.push(i(o)+"scale("+e+","+r+")")}(o.scaleX,o.scaleY,a.scaleX,a.scaleY,u,c),o=a=null,function(t){for(var n,e=-1,r=c.length;++e<r;)u[(n=c[e]).i]=n.x(t);return u.join("")}}}var ke=Se(function(t){return"none"===t?Ae:(me||(me=document.createElement("DIV"),xe=document.documentElement,we=document.defaultView),me.style.transform=t,t=we.getComputedStyle(xe.appendChild(me),null).getPropertyValue("transform"),xe.removeChild(me),Te(+(t=t.slice(7,-1).split(","))[0],+t[1],+t[2],+t[3],+t[4],+t[5]))},"px, ","px)","deg)"),Ee=Se(function(t){return null==t?Ae:(Me||(Me=document.createElementNS("http://www.w3.org/2000/svg","g")),Me.setAttribute("transform",t),(t=Me.transform.baseVal.consolidate())?Te((t=t.matrix).a,t.b,t.c,t.d,t.e,t.f):Ae)},", ",")",")"),Ce=Math.SQRT2,Pe=2,ze=4,Re=1e-12;function De(t){return((t=Math.exp(t))+1/t)/2}function qe(t,n){var e,r,i=t[0],o=t[1],a=t[2],u=n[0],c=n[1],f=n[2],s=u-i,l=c-o,h=s*s+l*l;if(h<Re)r=Math.log(f/a)/Ce,e=function(t){return[i+t*s,o+t*l,a*Math.exp(Ce*t*r)]};else{var d=Math.sqrt(h),p=(f*f-a*a+ze*h)/(2*a*Pe*d),v=(f*f-a*a-ze*h)/(2*f*Pe*d),g=Math.log(Math.sqrt(p*p+1)-p),y=Math.log(Math.sqrt(v*v+1)-v);r=(y-g)/Ce,e=function(t){var n,e=t*r,u=De(g),c=a/(Pe*d)*(u*(n=Ce*e+g,((n=Math.exp(2*n))-1)/(n+1))-function(t){return((t=Math.exp(t))-1/t)/2}(g));return[i+c*s,o+c*l,a*u/De(Ce*e+g)]}}return e.duration=1e3*r,e}function Le(t){return function(n,e){var r=t((n=mn(n)).h,(e=mn(e)).h),i=ae(n.s,e.s),o=ae(n.l,e.l),a=ae(n.opacity,e.opacity);return function(t){return n.h=r(t),n.s=i(t),n.l=o(t),n.opacity=a(t),n+""}}}var Ue=Le(ie),Oe=Le(ae);function Be(t){return function(n,e){var r=t((n=Yn(n)).h,(e=Yn(e)).h),i=ae(n.c,e.c),o=ae(n.l,e.l),a=ae(n.opacity,e.opacity);return function(t){return n.h=r(t),n.c=i(t),n.l=o(t),n.opacity=a(t),n+""}}}var Ye=Be(ie),Fe=Be(ae);function Ie(t){return function n(e){function r(n,r){var i=t((n=Qn(n)).h,(r=Qn(r)).h),o=ae(n.s,r.s),a=ae(n.l,r.l),u=ae(n.opacity,r.opacity);return function(t){return n.h=i(t),n.s=o(t),n.l=a(Math.pow(t,e)),n.opacity=u(t),n+""}}return e=+e,r.gamma=n,r}(1)}var je=Ie(ie),He=Ie(ae);var Xe,Ge,Ve=0,$e=0,We=0,Ze=1e3,Qe=0,Je=0,Ke=0,tr="object"==typeof performance&&performance.now?performance:Date,nr="object"==typeof window&&window.requestAnimationFrame?window.requestAnimationFrame.bind(window):function(t){setTimeout(t,17)};function er(){return Je||(nr(rr),Je=tr.now()+Ke)}function rr(){Je=0}function ir(){this._call=this._time=this._next=null}function or(t,n,e){var r=new ir;return r.restart(t,n,e),r}function ar(){er(),++Ve;for(var t,n=Xe;n;)(t=Je-n._time)>=0&&n._call.call(null,t),n=n._next;--Ve}function ur(){Je=(Qe=tr.now())+Ke,Ve=$e=0;try{ar()}finally{Ve=0,function(){var t,n,e=Xe,r=1/0;for(;e;)e._call?(r>e._time&&(r=e._time),t=e,e=e._next):(n=e._next,e._next=null,e=t?t._next=n:Xe=n);Ge=t,fr(r)}(),Je=0}}function cr(){var t=tr.now(),n=t-Qe;n>Ze&&(Ke-=n,Qe=t)}function fr(t){Ve||($e&&($e=clearTimeout($e)),t-Je>24?(t<1/0&&($e=setTimeout(ur,t-tr.now()-Ke)),We&&(We=clearInterval(We))):(We||(Qe=tr.now(),We=setInterval(cr,Ze)),Ve=1,nr(ur)))}function sr(t,n,e){var r=new ir;return n=null==n?0:+n,r.restart(function(e){r.stop(),t(e+n)},n,e),r}ir.prototype=or.prototype={constructor:ir,restart:function(t,n,e){if("function"!=typeof t)throw new TypeError("callback is not a function");e=(null==e?er():+e)+(null==n?0:+n),this._next||Ge===this||(Ge?Ge._next=this:Xe=this,Ge=this),this._call=t,this._time=e,fr()},stop:function(){this._call&&(this._call=null,this._time=1/0,fr())}};var lr=I("start","end","cancel","interrupt"),hr=[],dr=0,pr=1,vr=2,gr=3,yr=4,_r=5,br=6;function mr(t,n,e,r,i,o){var a=t.__transition;if(a){if(e in a)return}else t.__transition={};!function(t,n,e){var r,i=t.__transition;function o(c){var f,s,l,h;if(e.state!==pr)return u();for(f in i)if((h=i[f]).name===e.name){if(h.state===gr)return sr(o);h.state===yr?(h.state=br,h.timer.stop(),h.on.call("interrupt",t,t.__data__,h.index,h.group),delete i[f]):+f<n&&(h.state=br,h.timer.stop(),h.on.call("cancel",t,t.__data__,h.index,h.group),delete i[f])}if(sr(function(){e.state===gr&&(e.state=yr,e.timer.restart(a,e.delay,e.time),a(c))}),e.state=vr,e.on.call("start",t,t.__data__,e.index,e.group),e.state===vr){for(e.state=gr,r=new Array(l=e.tween.length),f=0,s=-1;f<l;++f)(h=e.tween[f].value.call(t,t.__data__,e.index,e.group))&&(r[++s]=h);r.length=s+1}}function a(n){for(var i=n<e.duration?e.ease.call(null,n/e.duration):(e.timer.restart(u),e.state=_r,1),o=-1,a=r.length;++o<a;)r[o].call(t,i);e.state===_r&&(e.on.call("end",t,t.__data__,e.index,e.group),u())}function u(){for(var r in e.state=br,e.timer.stop(),delete i[n],i)return;delete t.__transition}i[n]=e,e.timer=or(function(t){e.state=pr,e.timer.restart(o,e.delay,e.time),e.delay<=t&&o(t-e.delay)},0,e.time)}(t,e,{name:n,index:r,group:i,on:lr,tween:hr,time:o.time,delay:o.delay,duration:o.duration,ease:o.ease,timer:null,state:dr})}function xr(t,n){var e=Mr(t,n);if(e.state>dr)throw new Error("too late; already scheduled");return e}function wr(t,n){var e=Mr(t,n);if(e.state>gr)throw new Error("too late; already running");return e}function Mr(t,n){var e=t.__transition;if(!e||!(e=e[n]))throw new Error("transition not found");return e}function Nr(t,n){var e,r,i,o=t.__transition,a=!0;if(o){for(i in n=null==n?null:n+"",o)(e=o[i]).name===n?(r=e.state>vr&&e.state<_r,e.state=br,e.timer.stop(),e.on.call(r?"interrupt":"cancel",t,t.__data__,e.index,e.group),delete o[i]):a=!1;a&&delete t.__transition}}function Ar(t,n,e){var r=t._id;return t.each(function(){var t=wr(this,r);(t.value||(t.value={}))[n]=e.apply(this,arguments)}),function(t){return Mr(t,r).value[n]}}function Tr(t,n){var e;return("number"==typeof n?de:n instanceof hn?ue:(e=hn(n))?(n=e,ue):ye)(t,n)}var Sr=Pt.prototype.constructor;function kr(t){return function(){this.style.removeProperty(t)}}var Er=0;function Cr(t,n,e,r){this._groups=t,this._parents=n,this._name=e,this._id=r}function Pr(t){return Pt().transition(t)}function zr(){return++Er}var Rr=Pt.prototype;function Dr(t){return((t*=2)<=1?t*t:--t*(2-t)+1)/2}function qr(t){return((t*=2)<=1?t*t*t:(t-=2)*t*t+2)/2}Cr.prototype=Pr.prototype={constructor:Cr,select:function(t){var n=this._name,e=this._id;"function"!=typeof t&&(t=Q(t));for(var r=this._groups,i=r.length,o=new Array(i),a=0;a<i;++a)for(var u,c,f=r[a],s=f.length,l=o[a]=new Array(s),h=0;h<s;++h)(u=f[h])&&(c=t.call(u,u.__data__,h,f))&&("__data__"in u&&(c.__data__=u.__data__),l[h]=c,mr(l[h],n,e,h,l,Mr(u,e)));return new Cr(o,this._parents,n,e)},selectAll:function(t){var n=this._name,e=this._id;"function"!=typeof t&&(t=K(t));for(var r=this._groups,i=r.length,o=[],a=[],u=0;u<i;++u)for(var c,f=r[u],s=f.length,l=0;l<s;++l)if(c=f[l]){for(var h,d=t.call(c,c.__data__,l,f),p=Mr(c,e),v=0,g=d.length;v<g;++v)(h=d[v])&&mr(h,n,e,v,d,p);o.push(d),a.push(c)}return new Cr(o,a,n,e)},filter:function(t){"function"!=typeof t&&(t=tt(t));for(var n=this._groups,e=n.length,r=new Array(e),i=0;i<e;++i)for(var o,a=n[i],u=a.length,c=r[i]=[],f=0;f<u;++f)(o=a[f])&&t.call(o,o.__data__,f,a)&&c.push(o);return new Cr(r,this._parents,this._name,this._id)},merge:function(t){if(t._id!==this._id)throw new Error;for(var n=this._groups,e=t._groups,r=n.length,i=e.length,o=Math.min(r,i),a=new Array(r),u=0;u<o;++u)for(var c,f=n[u],s=e[u],l=f.length,h=a[u]=new Array(l),d=0;d<l;++d)(c=f[d]||s[d])&&(h[d]=c);for(;u<r;++u)a[u]=n[u];return new Cr(a,this._parents,this._name,this._id)},selection:function(){return new Sr(this._groups,this._parents)},transition:function(){for(var t=this._name,n=this._id,e=zr(),r=this._groups,i=r.length,o=0;o<i;++o)for(var a,u=r[o],c=u.length,f=0;f<c;++f)if(a=u[f]){var s=Mr(a,n);mr(a,t,e,f,u,{time:s.time+s.delay+s.duration,delay:0,duration:s.duration,ease:s.ease})}return new Cr(r,this._parents,t,e)},call:Rr.call,nodes:Rr.nodes,node:Rr.node,size:Rr.size,empty:Rr.empty,each:Rr.each,on:function(t,n){var e=this._id;return arguments.length<2?Mr(this.node(),e).on.on(t):this.each(function(t,n,e){var r,i,o=function(t){return(t+"").trim().split(/^|\s+/).every(function(t){var n=t.indexOf(".");return n>=0&&(t=t.slice(0,n)),!t||"start"===t})}(n)?xr:wr;return function(){var a=o(this,t),u=a.on;u!==r&&(i=(r=u).copy()).on(n,e),a.on=i}}(e,t,n))},attr:function(t,n){var e=$(t),r="transform"===e?Ee:Tr;return this.attrTween(t,"function"==typeof n?(e.local?function(t,n,e){var r,i,o;return function(){var a,u,c=e(this);if(null!=c)return(a=this.getAttributeNS(t.space,t.local))===(u=c+"")?null:a===r&&u===i?o:(i=u,o=n(r=a,c));this.removeAttributeNS(t.space,t.local)}}:function(t,n,e){var r,i,o;return function(){var a,u,c=e(this);if(null!=c)return(a=this.getAttribute(t))===(u=c+"")?null:a===r&&u===i?o:(i=u,o=n(r=a,c));this.removeAttribute(t)}})(e,r,Ar(this,"attr."+t,n)):null==n?(e.local?function(t){return function(){this.removeAttributeNS(t.space,t.local)}}:function(t){return function(){this.removeAttribute(t)}})(e):(e.local?function(t,n,e){var r,i,o=e+"";return function(){var a=this.getAttributeNS(t.space,t.local);return a===o?null:a===r?i:i=n(r=a,e)}}:function(t,n,e){var r,i,o=e+"";return function(){var a=this.getAttribute(t);return a===o?null:a===r?i:i=n(r=a,e)}})(e,r,n))},attrTween:function(t,n){var e="attr."+t;if(arguments.length<2)return(e=this.tween(e))&&e._value;if(null==n)return this.tween(e,null);if("function"!=typeof n)throw new Error;var r=$(t);return this.tween(e,(r.local?function(t,n){var e,r;function i(){var i=n.apply(this,arguments);return i!==r&&(e=(r=i)&&function(t,n){return function(e){this.setAttributeNS(t.space,t.local,n(e))}}(t,i)),e}return i._value=n,i}:function(t,n){var e,r;function i(){var i=n.apply(this,arguments);return i!==r&&(e=(r=i)&&function(t,n){return function(e){this.setAttribute(t,n(e))}}(t,i)),e}return i._value=n,i})(r,n))},style:function(t,n,e){var r="transform"==(t+="")?ke:Tr;return null==n?this.styleTween(t,function(t,n){var e,r,i;return function(){var o=ct(this,t),a=(this.style.removeProperty(t),ct(this,t));return o===a?null:o===e&&a===r?i:i=n(e=o,r=a)}}(t,r)).on("end.style."+t,kr(t)):"function"==typeof n?this.styleTween(t,function(t,n,e){var r,i,o;return function(){var a=ct(this,t),u=e(this),c=u+"";return null==u&&(this.style.removeProperty(t),c=u=ct(this,t)),a===c?null:a===r&&c===i?o:(i=c,o=n(r=a,u))}}(t,r,Ar(this,"style."+t,n))).each(function(t,n){var e,r,i,o,a="style."+n,u="end."+a;return function(){var c=wr(this,t),f=c.on,s=null==c.value[a]?o||(o=kr(n)):void 0;f===e&&i===s||(r=(e=f).copy()).on(u,i=s),c.on=r}}(this._id,t)):this.styleTween(t,function(t,n,e){var r,i,o=e+"";return function(){var a=ct(this,t);return a===o?null:a===r?i:i=n(r=a,e)}}(t,r,n),e).on("end.style."+t,null)},styleTween:function(t,n,e){var r="style."+(t+="");if(arguments.length<2)return(r=this.tween(r))&&r._value;if(null==n)return this.tween(r,null);if("function"!=typeof n)throw new Error;return this.tween(r,function(t,n,e){var r,i;function o(){var o=n.apply(this,arguments);return o!==i&&(r=(i=o)&&function(t,n,e){return function(r){this.style.setProperty(t,n(r),e)}}(t,o,e)),r}return o._value=n,o}(t,n,null==e?"":e))},text:function(t){return this.tween("text","function"==typeof t?function(t){return function(){var n=t(this);this.textContent=null==n?"":n}}(Ar(this,"text",t)):function(t){return function(){this.textContent=t}}(null==t?"":t+""))},remove:function(){return this.on("end.remove",(t=this._id,function(){var n=this.parentNode;for(var e in this.__transition)if(+e!==t)return;n&&n.removeChild(this)}));var t},tween:function(t,n){var e=this._id;if(t+="",arguments.length<2){for(var r,i=Mr(this.node(),e).tween,o=0,a=i.length;o<a;++o)if((r=i[o]).name===t)return r.value;return null}return this.each((null==n?function(t,n){var e,r;return function(){var i=wr(this,t),o=i.tween;if(o!==e)for(var a=0,u=(r=e=o).length;a<u;++a)if(r[a].name===n){(r=r.slice()).splice(a,1);break}i.tween=r}}:function(t,n,e){var r,i;if("function"!=typeof e)throw new Error;return function(){var o=wr(this,t),a=o.tween;if(a!==r){i=(r=a).slice();for(var u={name:n,value:e},c=0,f=i.length;c<f;++c)if(i[c].name===n){i[c]=u;break}c===f&&i.push(u)}o.tween=i}})(e,t,n))},delay:function(t){var n=this._id;return arguments.length?this.each(("function"==typeof t?function(t,n){return function(){xr(this,t).delay=+n.apply(this,arguments)}}:function(t,n){return n=+n,function(){xr(this,t).delay=n}})(n,t)):Mr(this.node(),n).delay},duration:function(t){var n=this._id;return arguments.length?this.each(("function"==typeof t?function(t,n){return function(){wr(this,t).duration=+n.apply(this,arguments)}}:function(t,n){return n=+n,function(){wr(this,t).duration=n}})(n,t)):Mr(this.node(),n).duration},ease:function(t){var n=this._id;return arguments.length?this.each(function(t,n){if("function"!=typeof n)throw new Error;return function(){wr(this,t).ease=n}}(n,t)):Mr(this.node(),n).ease},end:function(){var t,n,e=this,r=e._id,i=e.size();return new Promise(function(o,a){var u={value:a},c={value:function(){0==--i&&o()}};e.each(function(){var e=wr(this,r),i=e.on;i!==t&&((n=(t=i).copy())._.cancel.push(u),n._.interrupt.push(u),n._.end.push(c)),e.on=n})})}};var Lr=function t(n){function e(t){return Math.pow(t,n)}return n=+n,e.exponent=t,e}(3),Ur=function t(n){function e(t){return 1-Math.pow(1-t,n)}return n=+n,e.exponent=t,e}(3),Or=function t(n){function e(t){return((t*=2)<=1?Math.pow(t,n):2-Math.pow(2-t,n))/2}return n=+n,e.exponent=t,e}(3),Br=Math.PI,Yr=Br/2;function Fr(t){return(1-Math.cos(Br*t))/2}function Ir(t){return((t*=2)<=1?Math.pow(2,10*t-10):2-Math.pow(2,10-10*t))/2}function jr(t){return((t*=2)<=1?1-Math.sqrt(1-t*t):Math.sqrt(1-(t-=2)*t)+1)/2}var Hr=4/11,Xr=6/11,Gr=8/11,Vr=.75,$r=9/11,Wr=10/11,Zr=.9375,Qr=21/22,Jr=63/64,Kr=1/Hr/Hr;function ti(t){return(t=+t)<Hr?Kr*t*t:t<Gr?Kr*(t-=Xr)*t+Vr:t<Wr?Kr*(t-=$r)*t+Zr:Kr*(t-=Qr)*t+Jr}var ni=function t(n){function e(t){return t*t*((n+1)*t-n)}return n=+n,e.overshoot=t,e}(1.70158),ei=function t(n){function e(t){return--t*t*((n+1)*t+n)+1}return n=+n,e.overshoot=t,e}(1.70158),ri=function t(n){function e(t){return((t*=2)<1?t*t*((n+1)*t-n):(t-=2)*t*((n+1)*t+n)+2)/2}return n=+n,e.overshoot=t,e}(1.70158),ii=2*Math.PI,oi=function t(n,e){var r=Math.asin(1/(n=Math.max(1,n)))*(e/=ii);function i(t){return n*Math.pow(2,10*--t)*Math.sin((r-t)/e)}return i.amplitude=function(n){return t(n,e*ii)},i.period=function(e){return t(n,e)},i}(1,.3),ai=function t(n,e){var r=Math.asin(1/(n=Math.max(1,n)))*(e/=ii);function i(t){return 1-n*Math.pow(2,-10*(t=+t))*Math.sin((t+r)/e)}return i.amplitude=function(n){return t(n,e*ii)},i.period=function(e){return t(n,e)},i}(1,.3),ui=function t(n,e){var r=Math.asin(1/(n=Math.max(1,n)))*(e/=ii);function i(t){return((t=2*t-1)<0?n*Math.pow(2,10*t)*Math.sin((r-t)/e):2-n*Math.pow(2,-10*t)*Math.sin((r+t)/e))/2}return i.amplitude=function(n){return t(n,e*ii)},i.period=function(e){return t(n,e)},i}(1,.3),ci={time:null,delay:0,duration:250,ease:qr};function fi(t,n){for(var e;!(e=t.__transition)||!(e=e[n]);)if(!(t=t.parentNode))return ci.time=er(),ci;return e}Pt.prototype.interrupt=function(t){return this.each(function(){Nr(this,t)})},Pt.prototype.transition=function(t){var n,e;t instanceof Cr?(n=t._id,t=t._name):(n=zr(),(e=ci).time=er(),t=null==t?null:t+"");for(var r=this._groups,i=r.length,o=0;o<i;++o)for(var a,u=r[o],c=u.length,f=0;f<c;++f)(a=u[f])&&mr(a,t,n,f,u,e||fi(a,n));return new Cr(r,this._parents,t,n)};var si=[null];function li(t){return function(){return t}}function hi(t,n,e){this.target=t,this.type=n,this.selection=e}function di(){t.event.stopImmediatePropagation()}function pi(){t.event.preventDefault(),t.event.stopImmediatePropagation()}var vi={name:"drag"},gi={name:"space"},yi={name:"handle"},_i={name:"center"},bi={name:"x",handles:["e","w"].map(Si),input:function(t,n){return t&&[[t[0],n[0][1]],[t[1],n[1][1]]]},output:function(t){return t&&[t[0][0],t[1][0]]}},mi={name:"y",handles:["n","s"].map(Si),input:function(t,n){return t&&[[n[0][0],t[0]],[n[1][0],t[1]]]},output:function(t){return t&&[t[0][1],t[1][1]]}},xi={name:"xy",handles:["n","e","s","w","nw","ne","se","sw"].map(Si),input:function(t){return t},output:function(t){return t}},wi={overlay:"crosshair",selection:"move",n:"ns-resize",e:"ew-resize",s:"ns-resize",w:"ew-resize",nw:"nwse-resize",ne:"nesw-resize",se:"nwse-resize",sw:"nesw-resize"},Mi={e:"w",w:"e",nw:"ne",ne:"nw",se:"sw",sw:"se"},Ni={n:"s",s:"n",nw:"sw",ne:"se",se:"ne",sw:"nw"},Ai={overlay:1,selection:1,n:null,e:1,s:null,w:-1,nw:-1,ne:1,se:1,sw:-1},Ti={overlay:1,selection:1,n:-1,e:null,s:1,w:null,nw:-1,ne:-1,se:1,sw:1};function Si(t){return{type:t}}function ki(){return!t.event.button}function Ei(){var t=this.ownerSVGElement||this;return[[0,0],[t.width.baseVal.value,t.height.baseVal.value]]}function Ci(t){for(;!t.__brush;)if(!(t=t.parentNode))return;return t.__brush}function Pi(t){return t[0][0]===t[1][0]||t[0][1]===t[1][1]}function zi(n){var e,r=Ei,i=ki,o=I(u,"start","brush","end"),a=6;function u(t){var e=t.property("__brush",h).selectAll(".overlay").data([Si("overlay")]);e.enter().append("rect").attr("class","overlay").attr("pointer-events","all").attr("cursor",wi.overlay).merge(e).each(function(){var t=Ci(this).extent;zt(this).attr("x",t[0][0]).attr("y",t[0][1]).attr("width",t[1][0]-t[0][0]).attr("height",t[1][1]-t[0][1])}),t.selectAll(".selection").data([Si("selection")]).enter().append("rect").attr("class","selection").attr("cursor",wi.selection).attr("fill","#777").attr("fill-opacity",.3).attr("stroke","#fff").attr("shape-rendering","crispEdges");var r=t.selectAll(".handle").data(n.handles,function(t){return t.type});r.exit().remove(),r.enter().append("rect").attr("class",function(t){return"handle handle--"+t.type}).attr("cursor",function(t){return wi[t.type]}),t.each(c).attr("fill","none").attr("pointer-events","all").style("-webkit-tap-highlight-color","rgba(0,0,0,0)").on("mousedown.brush touchstart.brush",l)}function c(){var t=zt(this),n=Ci(this).selection;n?(t.selectAll(".selection").style("display",null).attr("x",n[0][0]).attr("y",n[0][1]).attr("width",n[1][0]-n[0][0]).attr("height",n[1][1]-n[0][1]),t.selectAll(".handle").style("display",null).attr("x",function(t){return"e"===t.type[t.type.length-1]?n[1][0]-a/2:n[0][0]-a/2}).attr("y",function(t){return"s"===t.type[0]?n[1][1]-a/2:n[0][1]-a/2}).attr("width",function(t){return"n"===t.type||"s"===t.type?n[1][0]-n[0][0]+a:a}).attr("height",function(t){return"e"===t.type||"w"===t.type?n[1][1]-n[0][1]+a:a})):t.selectAll(".selection,.handle").style("display","none").attr("x",null).attr("y",null).attr("width",null).attr("height",null)}function f(t,n){return t.__brush.emitter||new s(t,n)}function s(t,n){this.that=t,this.args=n,this.state=t.__brush,this.active=0}function l(){if(t.event.touches){if(t.event.changedTouches.length<t.event.touches.length)return pi()}else if(e)return;if(i.apply(this,arguments)){var r,o,a,u,s,l,h,d,p,v,g,y,_,b=this,m=t.event.target.__data__.type,x="selection"===(t.event.metaKey?m="overlay":m)?vi:t.event.altKey?_i:yi,w=n===mi?null:Ai[m],M=n===bi?null:Ti[m],N=Ci(b),A=N.extent,T=N.selection,S=A[0][0],k=A[0][1],E=A[1][0],C=A[1][1],P=w&&M&&t.event.shiftKey,z=Ot(b),R=z,D=f(b,arguments).beforestart();"overlay"===m?N.selection=T=[[r=n===mi?S:z[0],a=n===bi?k:z[1]],[s=n===mi?E:r,h=n===bi?C:a]]:(r=T[0][0],a=T[0][1],s=T[1][0],h=T[1][1]),o=r,u=a,l=s,d=h;var q=zt(b).attr("pointer-events","none"),L=q.selectAll(".overlay").attr("cursor",wi[m]);if(t.event.touches)q.on("touchmove.brush",O,!0).on("touchend.brush touchcancel.brush",Y,!0);else{var U=zt(t.event.view).on("keydown.brush",function(){switch(t.event.keyCode){case 16:P=w&&M;break;case 18:x===yi&&(w&&(s=l-p*w,r=o+p*w),M&&(h=d-v*M,a=u+v*M),x=_i,B());break;case 32:x!==yi&&x!==_i||(w<0?s=l-p:w>0&&(r=o-p),M<0?h=d-v:M>0&&(a=u-v),x=gi,L.attr("cursor",wi.selection),B());break;default:return}pi()},!0).on("keyup.brush",function(){switch(t.event.keyCode){case 16:P&&(y=_=P=!1,B());break;case 18:x===_i&&(w<0?s=l:w>0&&(r=o),M<0?h=d:M>0&&(a=u),x=yi,B());break;case 32:x===gi&&(t.event.altKey?(w&&(s=l-p*w,r=o+p*w),M&&(h=d-v*M,a=u+v*M),x=_i):(w<0?s=l:w>0&&(r=o),M<0?h=d:M>0&&(a=u),x=yi),L.attr("cursor",wi[m]),B());break;default:return}pi()},!0).on("mousemove.brush",O,!0).on("mouseup.brush",Y,!0);It(t.event.view)}di(),Nr(b),c.call(b),D.start()}function O(){var t=Ot(b);!P||y||_||(Math.abs(t[0]-R[0])>Math.abs(t[1]-R[1])?_=!0:y=!0),R=t,g=!0,pi(),B()}function B(){var t;switch(p=R[0]-z[0],v=R[1]-z[1],x){case gi:case vi:w&&(p=Math.max(S-r,Math.min(E-s,p)),o=r+p,l=s+p),M&&(v=Math.max(k-a,Math.min(C-h,v)),u=a+v,d=h+v);break;case yi:w<0?(p=Math.max(S-r,Math.min(E-r,p)),o=r+p,l=s):w>0&&(p=Math.max(S-s,Math.min(E-s,p)),o=r,l=s+p),M<0?(v=Math.max(k-a,Math.min(C-a,v)),u=a+v,d=h):M>0&&(v=Math.max(k-h,Math.min(C-h,v)),u=a,d=h+v);break;case _i:w&&(o=Math.max(S,Math.min(E,r-p*w)),l=Math.max(S,Math.min(E,s+p*w))),M&&(u=Math.max(k,Math.min(C,a-v*M)),d=Math.max(k,Math.min(C,h+v*M)))}l<o&&(w*=-1,t=r,r=s,s=t,t=o,o=l,l=t,m in Mi&&L.attr("cursor",wi[m=Mi[m]])),d<u&&(M*=-1,t=a,a=h,h=t,t=u,u=d,d=t,m in Ni&&L.attr("cursor",wi[m=Ni[m]])),N.selection&&(T=N.selection),y&&(o=T[0][0],l=T[1][0]),_&&(u=T[0][1],d=T[1][1]),T[0][0]===o&&T[0][1]===u&&T[1][0]===l&&T[1][1]===d||(N.selection=[[o,u],[l,d]],c.call(b),D.brush())}function Y(){if(di(),t.event.touches){if(t.event.touches.length)return;e&&clearTimeout(e),e=setTimeout(function(){e=null},500),q.on("touchmove.brush touchend.brush touchcancel.brush",null)}else jt(t.event.view,g),U.on("keydown.brush keyup.brush mousemove.brush mouseup.brush",null);q.attr("pointer-events","all"),L.attr("cursor",wi.overlay),N.selection&&(T=N.selection),Pi(T)&&(N.selection=null,c.call(b)),D.end()}}function h(){var t=this.__brush||{selection:null};return t.extent=r.apply(this,arguments),t.dim=n,t}return u.move=function(t,e){t.selection?t.on("start.brush",function(){f(this,arguments).beforestart().start()}).on("interrupt.brush end.brush",function(){f(this,arguments).end()}).tween("brush",function(){var t=this,r=t.__brush,i=f(t,arguments),o=r.selection,a=n.input("function"==typeof e?e.apply(this,arguments):e,r.extent),u=_e(o,a);function s(n){r.selection=1===n&&Pi(a)?null:u(n),c.call(t),i.brush()}return o&&a?s:s(1)}):t.each(function(){var t=arguments,r=this.__brush,i=n.input("function"==typeof e?e.apply(this,t):e,r.extent),o=f(this,t).beforestart();Nr(this),r.selection=null==i||Pi(i)?null:i,c.call(this),o.start().brush().end()})},s.prototype={beforestart:function(){return 1==++this.active&&(this.state.emitter=this,this.starting=!0),this},start:function(){return this.starting&&(this.starting=!1,this.emit("start")),this},brush:function(){return this.emit("brush"),this},end:function(){return 0==--this.active&&(delete this.state.emitter,this.emit("end")),this},emit:function(t){St(new hi(u,t,n.output(this.state.selection)),o.apply,o,[t,this.that,this.args])}},u.extent=function(t){return arguments.length?(r="function"==typeof t?t:li([[+t[0][0],+t[0][1]],[+t[1][0],+t[1][1]]]),u):r},u.filter=function(t){return arguments.length?(i="function"==typeof t?t:li(!!t),u):i},u.handleSize=function(t){return arguments.length?(a=+t,u):a},u.on=function(){var t=o.on.apply(o,arguments);return t===o?u:t},u}var Ri=Math.cos,Di=Math.sin,qi=Math.PI,Li=qi/2,Ui=2*qi,Oi=Math.max;var Bi=Array.prototype.slice;function Yi(t){return function(){return t}}var Fi=Math.PI,Ii=2*Fi,ji=Ii-1e-6;function Hi(){this._x0=this._y0=this._x1=this._y1=null,this._=""}function Xi(){return new Hi}function Gi(t){return t.source}function Vi(t){return t.target}function $i(t){return t.radius}function Wi(t){return t.startAngle}function Zi(t){return t.endAngle}Hi.prototype=Xi.prototype={constructor:Hi,moveTo:function(t,n){this._+="M"+(this._x0=this._x1=+t)+","+(this._y0=this._y1=+n)},closePath:function(){null!==this._x1&&(this._x1=this._x0,this._y1=this._y0,this._+="Z")},lineTo:function(t,n){this._+="L"+(this._x1=+t)+","+(this._y1=+n)},quadraticCurveTo:function(t,n,e,r){this._+="Q"+ +t+","+ +n+","+(this._x1=+e)+","+(this._y1=+r)},bezierCurveTo:function(t,n,e,r,i,o){this._+="C"+ +t+","+ +n+","+ +e+","+ +r+","+(this._x1=+i)+","+(this._y1=+o)},arcTo:function(t,n,e,r,i){t=+t,n=+n,e=+e,r=+r,i=+i;var o=this._x1,a=this._y1,u=e-t,c=r-n,f=o-t,s=a-n,l=f*f+s*s;if(i<0)throw new Error("negative radius: "+i);if(null===this._x1)this._+="M"+(this._x1=t)+","+(this._y1=n);else if(l>1e-6)if(Math.abs(s*u-c*f)>1e-6&&i){var h=e-o,d=r-a,p=u*u+c*c,v=h*h+d*d,g=Math.sqrt(p),y=Math.sqrt(l),_=i*Math.tan((Fi-Math.acos((p+l-v)/(2*g*y)))/2),b=_/y,m=_/g;Math.abs(b-1)>1e-6&&(this._+="L"+(t+b*f)+","+(n+b*s)),this._+="A"+i+","+i+",0,0,"+ +(s*h>f*d)+","+(this._x1=t+m*u)+","+(this._y1=n+m*c)}else this._+="L"+(this._x1=t)+","+(this._y1=n);else;},arc:function(t,n,e,r,i,o){t=+t,n=+n;var a=(e=+e)*Math.cos(r),u=e*Math.sin(r),c=t+a,f=n+u,s=1^o,l=o?r-i:i-r;if(e<0)throw new Error("negative radius: "+e);null===this._x1?this._+="M"+c+","+f:(Math.abs(this._x1-c)>1e-6||Math.abs(this._y1-f)>1e-6)&&(this._+="L"+c+","+f),e&&(l<0&&(l=l%Ii+Ii),l>ji?this._+="A"+e+","+e+",0,1,"+s+","+(t-a)+","+(n-u)+"A"+e+","+e+",0,1,"+s+","+(this._x1=c)+","+(this._y1=f):l>1e-6&&(this._+="A"+e+","+e+",0,"+ +(l>=Fi)+","+s+","+(this._x1=t+e*Math.cos(i))+","+(this._y1=n+e*Math.sin(i))))},rect:function(t,n,e,r){this._+="M"+(this._x0=this._x1=+t)+","+(this._y0=this._y1=+n)+"h"+ +e+"v"+ +r+"h"+-e+"Z"},toString:function(){return this._}};function Qi(){}function Ji(t,n){var e=new Qi;if(t instanceof Qi)t.each(function(t,n){e.set(n,t)});else if(Array.isArray(t)){var r,i=-1,o=t.length;if(null==n)for(;++i<o;)e.set(i,t[i]);else for(;++i<o;)e.set(n(r=t[i],i,t),r)}else if(t)for(var a in t)e.set(a,t[a]);return e}function Ki(){return{}}function to(t,n,e){t[n]=e}function no(){return Ji()}function eo(t,n,e){t.set(n,e)}function ro(){}Qi.prototype=Ji.prototype={constructor:Qi,has:function(t){return"$"+t in this},get:function(t){return this["$"+t]},set:function(t,n){return this["$"+t]=n,this},remove:function(t){var n="$"+t;return n in this&&delete this[n]},clear:function(){for(var t in this)"$"===t[0]&&delete this[t]},keys:function(){var t=[];for(var n in this)"$"===n[0]&&t.push(n.slice(1));return t},values:function(){var t=[];for(var n in this)"$"===n[0]&&t.push(this[n]);return t},entries:function(){var t=[];for(var n in this)"$"===n[0]&&t.push({key:n.slice(1),value:this[n]});return t},size:function(){var t=0;for(var n in this)"$"===n[0]&&++t;return t},empty:function(){for(var t in this)if("$"===t[0])return!1;return!0},each:function(t){for(var n in this)"$"===n[0]&&t(this[n],n.slice(1),this)}};var io=Ji.prototype;function oo(t,n){var e=new ro;if(t instanceof ro)t.each(function(t){e.add(t)});else if(t){var r=-1,i=t.length;if(null==n)for(;++r<i;)e.add(t[r]);else for(;++r<i;)e.add(n(t[r],r,t))}return e}ro.prototype=oo.prototype={constructor:ro,has:io.has,add:function(t){return this["$"+(t+="")]=t,this},remove:io.remove,clear:io.clear,values:io.keys,size:io.size,empty:io.empty,each:io.each};var ao=Array.prototype.slice;function uo(t,n){return t-n}function co(t){return function(){return t}}function fo(t,n){for(var e,r=-1,i=n.length;++r<i;)if(e=so(t,n[r]))return e;return 0}function so(t,n){for(var e=n[0],r=n[1],i=-1,o=0,a=t.length,u=a-1;o<a;u=o++){var c=t[o],f=c[0],s=c[1],l=t[u],h=l[0],d=l[1];if(lo(c,l,n))return 0;s>r!=d>r&&e<(h-f)*(r-s)/(d-s)+f&&(i=-i)}return i}function lo(t,n,e){var r,i,o,a;return function(t,n,e){return(n[0]-t[0])*(e[1]-t[1])==(e[0]-t[0])*(n[1]-t[1])}(t,n,e)&&(i=t[r=+(t[0]===n[0])],o=e[r],a=n[r],i<=o&&o<=a||a<=o&&o<=i)}function ho(){}var po=[[],[[[1,1.5],[.5,1]]],[[[1.5,1],[1,1.5]]],[[[1.5,1],[.5,1]]],[[[1,.5],[1.5,1]]],[[[1,1.5],[.5,1]],[[1,.5],[1.5,1]]],[[[1,.5],[1,1.5]]],[[[1,.5],[.5,1]]],[[[.5,1],[1,.5]]],[[[1,1.5],[1,.5]]],[[[.5,1],[1,.5]],[[1.5,1],[1,1.5]]],[[[1.5,1],[1,.5]]],[[[.5,1],[1.5,1]]],[[[1,1.5],[1.5,1]]],[[[.5,1],[1,1.5]]],[]];function vo(){var t=1,n=1,e=M,r=u;function i(t){var n=e(t);if(Array.isArray(n))n=n.slice().sort(uo);else{var r=s(t),i=r[0],a=r[1];n=w(i,a,n),n=g(Math.floor(i/n)*n,Math.floor(a/n)*n,n)}return n.map(function(n){return o(t,n)})}function o(e,i){var o=[],u=[];return function(e,r,i){var o,u,c,f,s,l,h=new Array,d=new Array;o=u=-1,f=e[0]>=r,po[f<<1].forEach(p);for(;++o<t-1;)c=f,f=e[o+1]>=r,po[c|f<<1].forEach(p);po[f<<0].forEach(p);for(;++u<n-1;){for(o=-1,f=e[u*t+t]>=r,s=e[u*t]>=r,po[f<<1|s<<2].forEach(p);++o<t-1;)c=f,f=e[u*t+t+o+1]>=r,l=s,s=e[u*t+o+1]>=r,po[c|f<<1|s<<2|l<<3].forEach(p);po[f|s<<3].forEach(p)}o=-1,s=e[u*t]>=r,po[s<<2].forEach(p);for(;++o<t-1;)l=s,s=e[u*t+o+1]>=r,po[s<<2|l<<3].forEach(p);function p(t){var n,e,r=[t[0][0]+o,t[0][1]+u],c=[t[1][0]+o,t[1][1]+u],f=a(r),s=a(c);(n=d[f])?(e=h[s])?(delete d[n.end],delete h[e.start],n===e?(n.ring.push(c),i(n.ring)):h[n.start]=d[e.end]={start:n.start,end:e.end,ring:n.ring.concat(e.ring)}):(delete d[n.end],n.ring.push(c),d[n.end=s]=n):(n=h[s])?(e=d[f])?(delete h[n.start],delete d[e.end],n===e?(n.ring.push(c),i(n.ring)):h[e.start]=d[n.end]={start:e.start,end:n.end,ring:e.ring.concat(n.ring)}):(delete h[n.start],n.ring.unshift(r),h[n.start=f]=n):h[f]=d[s]={start:f,end:s,ring:[r,c]}}po[s<<3].forEach(p)}(e,i,function(t){r(t,e,i),function(t){for(var n=0,e=t.length,r=t[e-1][1]*t[0][0]-t[e-1][0]*t[0][1];++n<e;)r+=t[n-1][1]*t[n][0]-t[n-1][0]*t[n][1];return r}(t)>0?o.push([t]):u.push(t)}),u.forEach(function(t){for(var n,e=0,r=o.length;e<r;++e)if(-1!==fo((n=o[e])[0],t))return void n.push(t)}),{type:"MultiPolygon",value:i,coordinates:o}}function a(n){return 2*n[0]+n[1]*(t+1)*4}function u(e,r,i){e.forEach(function(e){var o,a=e[0],u=e[1],c=0|a,f=0|u,s=r[f*t+c];a>0&&a<t&&c===a&&(o=r[f*t+c-1],e[0]=a+(i-o)/(s-o)-.5),u>0&&u<n&&f===u&&(o=r[(f-1)*t+c],e[1]=u+(i-o)/(s-o)-.5)})}return i.contour=o,i.size=function(e){if(!arguments.length)return[t,n];var r=Math.ceil(e[0]),o=Math.ceil(e[1]);if(!(r>0&&o>0))throw new Error("invalid size");return t=r,n=o,i},i.thresholds=function(t){return arguments.length?(e="function"==typeof t?t:Array.isArray(t)?co(ao.call(t)):co(t),i):e},i.smooth=function(t){return arguments.length?(r=t?u:ho,i):r===u},i}function go(t,n,e){for(var r=t.width,i=t.height,o=1+(e<<1),a=0;a<i;++a)for(var u=0,c=0;u<r+e;++u)u<r&&(c+=t.data[u+a*r]),u>=e&&(u>=o&&(c-=t.data[u-o+a*r]),n.data[u-e+a*r]=c/Math.min(u+1,r-1+o-u,o))}function yo(t,n,e){for(var r=t.width,i=t.height,o=1+(e<<1),a=0;a<r;++a)for(var u=0,c=0;u<i+e;++u)u<i&&(c+=t.data[a+u*r]),u>=e&&(u>=o&&(c-=t.data[a+(u-o)*r]),n.data[a+(u-e)*r]=c/Math.min(u+1,i-1+o-u,o))}function _o(t){return t[0]}function bo(t){return t[1]}function mo(){return 1}var xo={},wo={},Mo=34,No=10,Ao=13;function To(t){return new Function("d","return {"+t.map(function(t,n){return JSON.stringify(t)+": d["+n+"]"}).join(",")+"}")}function So(t){var n=Object.create(null),e=[];return t.forEach(function(t){for(var r in t)r in n||e.push(n[r]=r)}),e}function ko(t,n){var e=t+"",r=e.length;return r<n?new Array(n-r+1).join(0)+e:e}function Eo(t){var n,e=t.getUTCHours(),r=t.getUTCMinutes(),i=t.getUTCSeconds(),o=t.getUTCMilliseconds();return isNaN(t)?"Invalid Date":((n=t.getUTCFullYear())<0?"-"+ko(-n,6):n>9999?"+"+ko(n,6):ko(n,4))+"-"+ko(t.getUTCMonth()+1,2)+"-"+ko(t.getUTCDate(),2)+(o?"T"+ko(e,2)+":"+ko(r,2)+":"+ko(i,2)+"."+ko(o,3)+"Z":i?"T"+ko(e,2)+":"+ko(r,2)+":"+ko(i,2)+"Z":r||e?"T"+ko(e,2)+":"+ko(r,2)+"Z":"")}function Co(t){var n=new RegExp('["'+t+"\n\r]"),e=t.charCodeAt(0);function r(t,n){var r,i=[],o=t.length,a=0,u=0,c=o<=0,f=!1;function s(){if(c)return wo;if(f)return f=!1,xo;var n,r,i=a;if(t.charCodeAt(i)===Mo){for(;a++<o&&t.charCodeAt(a)!==Mo||t.charCodeAt(++a)===Mo;);return(n=a)>=o?c=!0:(r=t.charCodeAt(a++))===No?f=!0:r===Ao&&(f=!0,t.charCodeAt(a)===No&&++a),t.slice(i+1,n-1).replace(/""/g,'"')}for(;a<o;){if((r=t.charCodeAt(n=a++))===No)f=!0;else if(r===Ao)f=!0,t.charCodeAt(a)===No&&++a;else if(r!==e)continue;return t.slice(i,n)}return c=!0,t.slice(i,o)}for(t.charCodeAt(o-1)===No&&--o,t.charCodeAt(o-1)===Ao&&--o;(r=s())!==wo;){for(var l=[];r!==xo&&r!==wo;)l.push(r),r=s();n&&null==(l=n(l,u++))||i.push(l)}return i}function i(n,e){return n.map(function(n){return e.map(function(t){return a(n[t])}).join(t)})}function o(n){return n.map(a).join(t)}function a(t){return null==t?"":t instanceof Date?Eo(t):n.test(t+="")?'"'+t.replace(/"/g,'""')+'"':t}return{parse:function(t,n){var e,i,o=r(t,function(t,r){if(e)return e(t,r-1);i=t,e=n?function(t,n){var e=To(t);return function(r,i){return n(e(r),i,t)}}(t,n):To(t)});return o.columns=i||[],o},parseRows:r,format:function(n,e){return null==e&&(e=So(n)),[e.map(a).join(t)].concat(i(n,e)).join("\n")},formatBody:function(t,n){return null==n&&(n=So(t)),i(t,n).join("\n")},formatRows:function(t){return t.map(o).join("\n")}}}var Po=Co(","),zo=Po.parse,Ro=Po.parseRows,Do=Po.format,qo=Po.formatBody,Lo=Po.formatRows,Uo=Co("\t"),Oo=Uo.parse,Bo=Uo.parseRows,Yo=Uo.format,Fo=Uo.formatBody,Io=Uo.formatRows;function jo(t){if(!t.ok)throw new Error(t.status+" "+t.statusText);return t.blob()}function Ho(t){if(!t.ok)throw new Error(t.status+" "+t.statusText);return t.arrayBuffer()}function Xo(t){if(!t.ok)throw new Error(t.status+" "+t.statusText);return t.text()}function Go(t,n){return fetch(t,n).then(Xo)}function Vo(t){return function(n,e,r){return 2===arguments.length&&"function"==typeof e&&(r=e,e=void 0),Go(n,e).then(function(n){return t(n,r)})}}var $o=Vo(zo),Wo=Vo(Oo);function Zo(t){if(!t.ok)throw new Error(t.status+" "+t.statusText);return t.json()}function Qo(t){return function(n,e){return Go(n,e).then(function(n){return(new DOMParser).parseFromString(n,t)})}}var Jo=Qo("application/xml"),Ko=Qo("text/html"),ta=Qo("image/svg+xml");function na(t){return function(){return t}}function ea(){return 1e-6*(Math.random()-.5)}function ra(t,n,e,r){if(isNaN(n)||isNaN(e))return t;var i,o,a,u,c,f,s,l,h,d=t._root,p={data:r},v=t._x0,g=t._y0,y=t._x1,_=t._y1;if(!d)return t._root=p,t;for(;d.length;)if((f=n>=(o=(v+y)/2))?v=o:y=o,(s=e>=(a=(g+_)/2))?g=a:_=a,i=d,!(d=d[l=s<<1|f]))return i[l]=p,t;if(u=+t._x.call(null,d.data),c=+t._y.call(null,d.data),n===u&&e===c)return p.next=d,i?i[l]=p:t._root=p,t;do{i=i?i[l]=new Array(4):t._root=new Array(4),(f=n>=(o=(v+y)/2))?v=o:y=o,(s=e>=(a=(g+_)/2))?g=a:_=a}while((l=s<<1|f)==(h=(c>=a)<<1|u>=o));return i[h]=d,i[l]=p,t}function ia(t,n,e,r,i){this.node=t,this.x0=n,this.y0=e,this.x1=r,this.y1=i}function oa(t){return t[0]}function aa(t){return t[1]}function ua(t,n,e){var r=new ca(null==n?oa:n,null==e?aa:e,NaN,NaN,NaN,NaN);return null==t?r:r.addAll(t)}function ca(t,n,e,r,i,o){this._x=t,this._y=n,this._x0=e,this._y0=r,this._x1=i,this._y1=o,this._root=void 0}function fa(t){for(var n={data:t.data},e=n;t=t.next;)e=e.next={data:t.data};return n}var sa=ua.prototype=ca.prototype;function la(t){return t.x+t.vx}function ha(t){return t.y+t.vy}function da(t){return t.index}function pa(t,n){var e=t.get(n);if(!e)throw new Error("missing: "+n);return e}function va(t){return t.x}function ga(t){return t.y}sa.copy=function(){var t,n,e=new ca(this._x,this._y,this._x0,this._y0,this._x1,this._y1),r=this._root;if(!r)return e;if(!r.length)return e._root=fa(r),e;for(t=[{source:r,target:e._root=new Array(4)}];r=t.pop();)for(var i=0;i<4;++i)(n=r.source[i])&&(n.length?t.push({source:n,target:r.target[i]=new Array(4)}):r.target[i]=fa(n));return e},sa.add=function(t){var n=+this._x.call(null,t),e=+this._y.call(null,t);return ra(this.cover(n,e),n,e,t)},sa.addAll=function(t){var n,e,r,i,o=t.length,a=new Array(o),u=new Array(o),c=1/0,f=1/0,s=-1/0,l=-1/0;for(e=0;e<o;++e)isNaN(r=+this._x.call(null,n=t[e]))||isNaN(i=+this._y.call(null,n))||(a[e]=r,u[e]=i,r<c&&(c=r),r>s&&(s=r),i<f&&(f=i),i>l&&(l=i));if(c>s||f>l)return this;for(this.cover(c,f).cover(s,l),e=0;e<o;++e)ra(this,a[e],u[e],t[e]);return this},sa.cover=function(t,n){if(isNaN(t=+t)||isNaN(n=+n))return this;var e=this._x0,r=this._y0,i=this._x1,o=this._y1;if(isNaN(e))i=(e=Math.floor(t))+1,o=(r=Math.floor(n))+1;else{for(var a,u,c=i-e,f=this._root;e>t||t>=i||r>n||n>=o;)switch(u=(n<r)<<1|t<e,(a=new Array(4))[u]=f,f=a,c*=2,u){case 0:i=e+c,o=r+c;break;case 1:e=i-c,o=r+c;break;case 2:i=e+c,r=o-c;break;case 3:e=i-c,r=o-c}this._root&&this._root.length&&(this._root=f)}return this._x0=e,this._y0=r,this._x1=i,this._y1=o,this},sa.data=function(){var t=[];return this.visit(function(n){if(!n.length)do{t.push(n.data)}while(n=n.next)}),t},sa.extent=function(t){return arguments.length?this.cover(+t[0][0],+t[0][1]).cover(+t[1][0],+t[1][1]):isNaN(this._x0)?void 0:[[this._x0,this._y0],[this._x1,this._y1]]},sa.find=function(t,n,e){var r,i,o,a,u,c,f,s=this._x0,l=this._y0,h=this._x1,d=this._y1,p=[],v=this._root;for(v&&p.push(new ia(v,s,l,h,d)),null==e?e=1/0:(s=t-e,l=n-e,h=t+e,d=n+e,e*=e);c=p.pop();)if(!(!(v=c.node)||(i=c.x0)>h||(o=c.y0)>d||(a=c.x1)<s||(u=c.y1)<l))if(v.length){var g=(i+a)/2,y=(o+u)/2;p.push(new ia(v[3],g,y,a,u),new ia(v[2],i,y,g,u),new ia(v[1],g,o,a,y),new ia(v[0],i,o,g,y)),(f=(n>=y)<<1|t>=g)&&(c=p[p.length-1],p[p.length-1]=p[p.length-1-f],p[p.length-1-f]=c)}else{var _=t-+this._x.call(null,v.data),b=n-+this._y.call(null,v.data),m=_*_+b*b;if(m<e){var x=Math.sqrt(e=m);s=t-x,l=n-x,h=t+x,d=n+x,r=v.data}}return r},sa.remove=function(t){if(isNaN(o=+this._x.call(null,t))||isNaN(a=+this._y.call(null,t)))return this;var n,e,r,i,o,a,u,c,f,s,l,h,d=this._root,p=this._x0,v=this._y0,g=this._x1,y=this._y1;if(!d)return this;if(d.length)for(;;){if((f=o>=(u=(p+g)/2))?p=u:g=u,(s=a>=(c=(v+y)/2))?v=c:y=c,n=d,!(d=d[l=s<<1|f]))return this;if(!d.length)break;(n[l+1&3]||n[l+2&3]||n[l+3&3])&&(e=n,h=l)}for(;d.data!==t;)if(r=d,!(d=d.next))return this;return(i=d.next)&&delete d.next,r?(i?r.next=i:delete r.next,this):n?(i?n[l]=i:delete n[l],(d=n[0]||n[1]||n[2]||n[3])&&d===(n[3]||n[2]||n[1]||n[0])&&!d.length&&(e?e[h]=d:this._root=d),this):(this._root=i,this)},sa.removeAll=function(t){for(var n=0,e=t.length;n<e;++n)this.remove(t[n]);return this},sa.root=function(){return this._root},sa.size=function(){var t=0;return this.visit(function(n){if(!n.length)do{++t}while(n=n.next)}),t},sa.visit=function(t){var n,e,r,i,o,a,u=[],c=this._root;for(c&&u.push(new ia(c,this._x0,this._y0,this._x1,this._y1));n=u.pop();)if(!t(c=n.node,r=n.x0,i=n.y0,o=n.x1,a=n.y1)&&c.length){var f=(r+o)/2,s=(i+a)/2;(e=c[3])&&u.push(new ia(e,f,s,o,a)),(e=c[2])&&u.push(new ia(e,r,s,f,a)),(e=c[1])&&u.push(new ia(e,f,i,o,s)),(e=c[0])&&u.push(new ia(e,r,i,f,s))}return this},sa.visitAfter=function(t){var n,e=[],r=[];for(this._root&&e.push(new ia(this._root,this._x0,this._y0,this._x1,this._y1));n=e.pop();){var i=n.node;if(i.length){var o,a=n.x0,u=n.y0,c=n.x1,f=n.y1,s=(a+c)/2,l=(u+f)/2;(o=i[0])&&e.push(new ia(o,a,u,s,l)),(o=i[1])&&e.push(new ia(o,s,u,c,l)),(o=i[2])&&e.push(new ia(o,a,l,s,f)),(o=i[3])&&e.push(new ia(o,s,l,c,f))}r.push(n)}for(;n=r.pop();)t(n.node,n.x0,n.y0,n.x1,n.y1);return this},sa.x=function(t){return arguments.length?(this._x=t,this):this._x},sa.y=function(t){return arguments.length?(this._y=t,this):this._y};var ya=10,_a=Math.PI*(3-Math.sqrt(5));function ba(t,n){if((e=(t=n?t.toExponential(n-1):t.toExponential()).indexOf("e"))<0)return null;var e,r=t.slice(0,e);return[r.length>1?r[0]+r.slice(2):r,+t.slice(e+1)]}function ma(t){return(t=ba(Math.abs(t)))?t[1]:NaN}var xa,wa=/^(?:(.)?([<>=^]))?([+\-( ])?([$#])?(0)?(\d+)?(,)?(\.\d+)?(~)?([a-z%])?$/i;function Ma(t){return new Na(t)}function Na(t){if(!(n=wa.exec(t)))throw new Error("invalid format: "+t);var n;this.fill=n[1]||" ",this.align=n[2]||">",this.sign=n[3]||"-",this.symbol=n[4]||"",this.zero=!!n[5],this.width=n[6]&&+n[6],this.comma=!!n[7],this.precision=n[8]&&+n[8].slice(1),this.trim=!!n[9],this.type=n[10]||""}function Aa(t,n){var e=ba(t,n);if(!e)return t+"";var r=e[0],i=e[1];return i<0?"0."+new Array(-i).join("0")+r:r.length>i+1?r.slice(0,i+1)+"."+r.slice(i+1):r+new Array(i-r.length+2).join("0")}Ma.prototype=Na.prototype,Na.prototype.toString=function(){return this.fill+this.align+this.sign+this.symbol+(this.zero?"0":"")+(null==this.width?"":Math.max(1,0|this.width))+(this.comma?",":"")+(null==this.precision?"":"."+Math.max(0,0|this.precision))+(this.trim?"~":"")+this.type};var Ta={"%":function(t,n){return(100*t).toFixed(n)},b:function(t){return Math.round(t).toString(2)},c:function(t){return t+""},d:function(t){return Math.round(t).toString(10)},e:function(t,n){return t.toExponential(n)},f:function(t,n){return t.toFixed(n)},g:function(t,n){return t.toPrecision(n)},o:function(t){return Math.round(t).toString(8)},p:function(t,n){return Aa(100*t,n)},r:Aa,s:function(t,n){var e=ba(t,n);if(!e)return t+"";var r=e[0],i=e[1],o=i-(xa=3*Math.max(-8,Math.min(8,Math.floor(i/3))))+1,a=r.length;return o===a?r:o>a?r+new Array(o-a+1).join("0"):o>0?r.slice(0,o)+"."+r.slice(o):"0."+new Array(1-o).join("0")+ba(t,Math.max(0,n+o-1))[0]},X:function(t){return Math.round(t).toString(16).toUpperCase()},x:function(t){return Math.round(t).toString(16)}};function Sa(t){return t}var ka,Ea=["y","z","a","f","p","n","µ","m","","k","M","G","T","P","E","Z","Y"];function Ca(t){var n,e,r=t.grouping&&t.thousands?(n=t.grouping,e=t.thousands,function(t,r){for(var i=t.length,o=[],a=0,u=n[0],c=0;i>0&&u>0&&(c+u+1>r&&(u=Math.max(1,r-c)),o.push(t.substring(i-=u,i+u)),!((c+=u+1)>r));)u=n[a=(a+1)%n.length];return o.reverse().join(e)}):Sa,i=t.currency,o=t.decimal,a=t.numerals?function(t){return function(n){return n.replace(/[0-9]/g,function(n){return t[+n]})}}(t.numerals):Sa,u=t.percent||"%";function c(t){var n=(t=Ma(t)).fill,e=t.align,c=t.sign,f=t.symbol,s=t.zero,l=t.width,h=t.comma,d=t.precision,p=t.trim,v=t.type;"n"===v?(h=!0,v="g"):Ta[v]||(null==d&&(d=12),p=!0,v="g"),(s||"0"===n&&"="===e)&&(s=!0,n="0",e="=");var g="$"===f?i[0]:"#"===f&&/[boxX]/.test(v)?"0"+v.toLowerCase():"",y="$"===f?i[1]:/[%p]/.test(v)?u:"",_=Ta[v],b=/[defgprs%]/.test(v);function m(t){var i,u,f,m=g,x=y;if("c"===v)x=_(t)+x,t="";else{var w=(t=+t)<0;if(t=_(Math.abs(t),d),p&&(t=function(t){t:for(var n,e=t.length,r=1,i=-1;r<e;++r)switch(t[r]){case".":i=n=r;break;case"0":0===i&&(i=r),n=r;break;default:if(i>0){if(!+t[r])break t;i=0}}return i>0?t.slice(0,i)+t.slice(n+1):t}(t)),w&&0==+t&&(w=!1),m=(w?"("===c?c:"-":"-"===c||"("===c?"":c)+m,x=("s"===v?Ea[8+xa/3]:"")+x+(w&&"("===c?")":""),b)for(i=-1,u=t.length;++i<u;)if(48>(f=t.charCodeAt(i))||f>57){x=(46===f?o+t.slice(i+1):t.slice(i))+x,t=t.slice(0,i);break}}h&&!s&&(t=r(t,1/0));var M=m.length+t.length+x.length,N=M<l?new Array(l-M+1).join(n):"";switch(h&&s&&(t=r(N+t,N.length?l-x.length:1/0),N=""),e){case"<":t=m+t+x+N;break;case"=":t=m+N+t+x;break;case"^":t=N.slice(0,M=N.length>>1)+m+t+x+N.slice(M);break;default:t=N+m+t+x}return a(t)}return d=null==d?6:/[gprs]/.test(v)?Math.max(1,Math.min(21,d)):Math.max(0,Math.min(20,d)),m.toString=function(){return t+""},m}return{format:c,formatPrefix:function(t,n){var e=c(((t=Ma(t)).type="f",t)),r=3*Math.max(-8,Math.min(8,Math.floor(ma(n)/3))),i=Math.pow(10,-r),o=Ea[8+r/3];return function(t){return e(i*t)+o}}}}function Pa(n){return ka=Ca(n),t.format=ka.format,t.formatPrefix=ka.formatPrefix,ka}function za(t){return Math.max(0,-ma(Math.abs(t)))}function Ra(t,n){return Math.max(0,3*Math.max(-8,Math.min(8,Math.floor(ma(n)/3)))-ma(Math.abs(t)))}function Da(t,n){return t=Math.abs(t),n=Math.abs(n)-t,Math.max(0,ma(n)-ma(t))+1}function qa(){return new La}function La(){this.reset()}Pa({decimal:".",thousands:",",grouping:[3],currency:["$",""]}),La.prototype={constructor:La,reset:function(){this.s=this.t=0},add:function(t){Oa(Ua,t,this.t),Oa(this,Ua.s,this.s),this.s?this.t+=Ua.t:this.s=Ua.t},valueOf:function(){return this.s}};var Ua=new La;function Oa(t,n,e){var r=t.s=n+e,i=r-n,o=r-i;t.t=n-o+(e-i)}var Ba=1e-6,Ya=1e-12,Fa=Math.PI,Ia=Fa/2,ja=Fa/4,Ha=2*Fa,Xa=180/Fa,Ga=Fa/180,Va=Math.abs,$a=Math.atan,Wa=Math.atan2,Za=Math.cos,Qa=Math.ceil,Ja=Math.exp,Ka=Math.log,tu=Math.pow,nu=Math.sin,eu=Math.sign||function(t){return t>0?1:t<0?-1:0},ru=Math.sqrt,iu=Math.tan;function ou(t){return t>1?0:t<-1?Fa:Math.acos(t)}function au(t){return t>1?Ia:t<-1?-Ia:Math.asin(t)}function uu(t){return(t=nu(t/2))*t}function cu(){}function fu(t,n){t&&lu.hasOwnProperty(t.type)&&lu[t.type](t,n)}var su={Feature:function(t,n){fu(t.geometry,n)},FeatureCollection:function(t,n){for(var e=t.features,r=-1,i=e.length;++r<i;)fu(e[r].geometry,n)}},lu={Sphere:function(t,n){n.sphere()},Point:function(t,n){t=t.coordinates,n.point(t[0],t[1],t[2])},MultiPoint:function(t,n){for(var e=t.coordinates,r=-1,i=e.length;++r<i;)t=e[r],n.point(t[0],t[1],t[2])},LineString:function(t,n){hu(t.coordinates,n,0)},MultiLineString:function(t,n){for(var e=t.coordinates,r=-1,i=e.length;++r<i;)hu(e[r],n,0)},Polygon:function(t,n){du(t.coordinates,n)},MultiPolygon:function(t,n){for(var e=t.coordinates,r=-1,i=e.length;++r<i;)du(e[r],n)},GeometryCollection:function(t,n){for(var e=t.geometries,r=-1,i=e.length;++r<i;)fu(e[r],n)}};function hu(t,n,e){var r,i=-1,o=t.length-e;for(n.lineStart();++i<o;)r=t[i],n.point(r[0],r[1],r[2]);n.lineEnd()}function du(t,n){var e=-1,r=t.length;for(n.polygonStart();++e<r;)hu(t[e],n,1);n.polygonEnd()}function pu(t,n){t&&su.hasOwnProperty(t.type)?su[t.type](t,n):fu(t,n)}var vu,gu,yu,_u,bu,mu=qa(),xu=qa(),wu={point:cu,lineStart:cu,lineEnd:cu,polygonStart:function(){mu.reset(),wu.lineStart=Mu,wu.lineEnd=Nu},polygonEnd:function(){var t=+mu;xu.add(t<0?Ha+t:t),this.lineStart=this.lineEnd=this.point=cu},sphere:function(){xu.add(Ha)}};function Mu(){wu.point=Au}function Nu(){Tu(vu,gu)}function Au(t,n){wu.point=Tu,vu=t,gu=n,yu=t*=Ga,_u=Za(n=(n*=Ga)/2+ja),bu=nu(n)}function Tu(t,n){var e=(t*=Ga)-yu,r=e>=0?1:-1,i=r*e,o=Za(n=(n*=Ga)/2+ja),a=nu(n),u=bu*a,c=_u*o+u*Za(i),f=u*r*nu(i);mu.add(Wa(f,c)),yu=t,_u=o,bu=a}function Su(t){return[Wa(t[1],t[0]),au(t[2])]}function ku(t){var n=t[0],e=t[1],r=Za(e);return[r*Za(n),r*nu(n),nu(e)]}function Eu(t,n){return t[0]*n[0]+t[1]*n[1]+t[2]*n[2]}function Cu(t,n){return[t[1]*n[2]-t[2]*n[1],t[2]*n[0]-t[0]*n[2],t[0]*n[1]-t[1]*n[0]]}function Pu(t,n){t[0]+=n[0],t[1]+=n[1],t[2]+=n[2]}function zu(t,n){return[t[0]*n,t[1]*n,t[2]*n]}function Ru(t){var n=ru(t[0]*t[0]+t[1]*t[1]+t[2]*t[2]);t[0]/=n,t[1]/=n,t[2]/=n}var Du,qu,Lu,Uu,Ou,Bu,Yu,Fu,Iu,ju,Hu,Xu,Gu,Vu,$u,Wu,Zu,Qu,Ju,Ku,tc,nc,ec,rc,ic,oc,ac=qa(),uc={point:cc,lineStart:sc,lineEnd:lc,polygonStart:function(){uc.point=hc,uc.lineStart=dc,uc.lineEnd=pc,ac.reset(),wu.polygonStart()},polygonEnd:function(){wu.polygonEnd(),uc.point=cc,uc.lineStart=sc,uc.lineEnd=lc,mu<0?(Du=-(Lu=180),qu=-(Uu=90)):ac>Ba?Uu=90:ac<-Ba&&(qu=-90),ju[0]=Du,ju[1]=Lu},sphere:function(){Du=-(Lu=180),qu=-(Uu=90)}};function cc(t,n){Iu.push(ju=[Du=t,Lu=t]),n<qu&&(qu=n),n>Uu&&(Uu=n)}function fc(t,n){var e=ku([t*Ga,n*Ga]);if(Fu){var r=Cu(Fu,e),i=Cu([r[1],-r[0],0],r);Ru(i),i=Su(i);var o,a=t-Ou,u=a>0?1:-1,c=i[0]*Xa*u,f=Va(a)>180;f^(u*Ou<c&&c<u*t)?(o=i[1]*Xa)>Uu&&(Uu=o):f^(u*Ou<(c=(c+360)%360-180)&&c<u*t)?(o=-i[1]*Xa)<qu&&(qu=o):(n<qu&&(qu=n),n>Uu&&(Uu=n)),f?t<Ou?vc(Du,t)>vc(Du,Lu)&&(Lu=t):vc(t,Lu)>vc(Du,Lu)&&(Du=t):Lu>=Du?(t<Du&&(Du=t),t>Lu&&(Lu=t)):t>Ou?vc(Du,t)>vc(Du,Lu)&&(Lu=t):vc(t,Lu)>vc(Du,Lu)&&(Du=t)}else Iu.push(ju=[Du=t,Lu=t]);n<qu&&(qu=n),n>Uu&&(Uu=n),Fu=e,Ou=t}function sc(){uc.point=fc}function lc(){ju[0]=Du,ju[1]=Lu,uc.point=cc,Fu=null}function hc(t,n){if(Fu){var e=t-Ou;ac.add(Va(e)>180?e+(e>0?360:-360):e)}else Bu=t,Yu=n;wu.point(t,n),fc(t,n)}function dc(){wu.lineStart()}function pc(){hc(Bu,Yu),wu.lineEnd(),Va(ac)>Ba&&(Du=-(Lu=180)),ju[0]=Du,ju[1]=Lu,Fu=null}function vc(t,n){return(n-=t)<0?n+360:n}function gc(t,n){return t[0]-n[0]}function yc(t,n){return t[0]<=t[1]?t[0]<=n&&n<=t[1]:n<t[0]||t[1]<n}var _c={sphere:cu,point:bc,lineStart:xc,lineEnd:Nc,polygonStart:function(){_c.lineStart=Ac,_c.lineEnd=Tc},polygonEnd:function(){_c.lineStart=xc,_c.lineEnd=Nc}};function bc(t,n){t*=Ga;var e=Za(n*=Ga);mc(e*Za(t),e*nu(t),nu(n))}function mc(t,n,e){Gu+=(t-Gu)/++Hu,Vu+=(n-Vu)/Hu,$u+=(e-$u)/Hu}function xc(){_c.point=wc}function wc(t,n){t*=Ga;var e=Za(n*=Ga);rc=e*Za(t),ic=e*nu(t),oc=nu(n),_c.point=Mc,mc(rc,ic,oc)}function Mc(t,n){t*=Ga;var e=Za(n*=Ga),r=e*Za(t),i=e*nu(t),o=nu(n),a=Wa(ru((a=ic*o-oc*i)*a+(a=oc*r-rc*o)*a+(a=rc*i-ic*r)*a),rc*r+ic*i+oc*o);Xu+=a,Wu+=a*(rc+(rc=r)),Zu+=a*(ic+(ic=i)),Qu+=a*(oc+(oc=o)),mc(rc,ic,oc)}function Nc(){_c.point=bc}function Ac(){_c.point=Sc}function Tc(){kc(nc,ec),_c.point=bc}function Sc(t,n){nc=t,ec=n,t*=Ga,n*=Ga,_c.point=kc;var e=Za(n);rc=e*Za(t),ic=e*nu(t),oc=nu(n),mc(rc,ic,oc)}function kc(t,n){t*=Ga;var e=Za(n*=Ga),r=e*Za(t),i=e*nu(t),o=nu(n),a=ic*o-oc*i,u=oc*r-rc*o,c=rc*i-ic*r,f=ru(a*a+u*u+c*c),s=au(f),l=f&&-s/f;Ju+=l*a,Ku+=l*u,tc+=l*c,Xu+=s,Wu+=s*(rc+(rc=r)),Zu+=s*(ic+(ic=i)),Qu+=s*(oc+(oc=o)),mc(rc,ic,oc)}function Ec(t){return function(){return t}}function Cc(t,n){function e(e,r){return e=t(e,r),n(e[0],e[1])}return t.invert&&n.invert&&(e.invert=function(e,r){return(e=n.invert(e,r))&&t.invert(e[0],e[1])}),e}function Pc(t,n){return[Va(t)>Fa?t+Math.round(-t/Ha)*Ha:t,n]}function zc(t,n,e){return(t%=Ha)?n||e?Cc(Dc(t),qc(n,e)):Dc(t):n||e?qc(n,e):Pc}function Rc(t){return function(n,e){return[(n+=t)>Fa?n-Ha:n<-Fa?n+Ha:n,e]}}function Dc(t){var n=Rc(t);return n.invert=Rc(-t),n}function qc(t,n){var e=Za(t),r=nu(t),i=Za(n),o=nu(n);function a(t,n){var a=Za(n),u=Za(t)*a,c=nu(t)*a,f=nu(n),s=f*e+u*r;return[Wa(c*i-s*o,u*e-f*r),au(s*i+c*o)]}return a.invert=function(t,n){var a=Za(n),u=Za(t)*a,c=nu(t)*a,f=nu(n),s=f*i-c*o;return[Wa(c*i+f*o,u*e+s*r),au(s*e-u*r)]},a}function Lc(t){function n(n){return(n=t(n[0]*Ga,n[1]*Ga))[0]*=Xa,n[1]*=Xa,n}return t=zc(t[0]*Ga,t[1]*Ga,t.length>2?t[2]*Ga:0),n.invert=function(n){return(n=t.invert(n[0]*Ga,n[1]*Ga))[0]*=Xa,n[1]*=Xa,n},n}function Uc(t,n,e,r,i,o){if(e){var a=Za(n),u=nu(n),c=r*e;null==i?(i=n+r*Ha,o=n-c/2):(i=Oc(a,i),o=Oc(a,o),(r>0?i<o:i>o)&&(i+=r*Ha));for(var f,s=i;r>0?s>o:s<o;s-=c)f=Su([a,-u*Za(s),-u*nu(s)]),t.point(f[0],f[1])}}function Oc(t,n){(n=ku(n))[0]-=t,Ru(n);var e=ou(-n[1]);return((-n[2]<0?-e:e)+Ha-Ba)%Ha}function Bc(){var t,n=[];return{point:function(n,e){t.push([n,e])},lineStart:function(){n.push(t=[])},lineEnd:cu,rejoin:function(){n.length>1&&n.push(n.pop().concat(n.shift()))},result:function(){var e=n;return n=[],t=null,e}}}function Yc(t,n){return Va(t[0]-n[0])<Ba&&Va(t[1]-n[1])<Ba}function Fc(t,n,e,r){this.x=t,this.z=n,this.o=e,this.e=r,this.v=!1,this.n=this.p=null}function Ic(t,n,e,r,i){var o,a,u=[],c=[];if(t.forEach(function(t){if(!((n=t.length-1)<=0)){var n,e,r=t[0],a=t[n];if(Yc(r,a)){for(i.lineStart(),o=0;o<n;++o)i.point((r=t[o])[0],r[1]);i.lineEnd()}else u.push(e=new Fc(r,t,null,!0)),c.push(e.o=new Fc(r,null,e,!1)),u.push(e=new Fc(a,t,null,!1)),c.push(e.o=new Fc(a,null,e,!0))}}),u.length){for(c.sort(n),jc(u),jc(c),o=0,a=c.length;o<a;++o)c[o].e=e=!e;for(var f,s,l=u[0];;){for(var h=l,d=!0;h.v;)if((h=h.n)===l)return;f=h.z,i.lineStart();do{if(h.v=h.o.v=!0,h.e){if(d)for(o=0,a=f.length;o<a;++o)i.point((s=f[o])[0],s[1]);else r(h.x,h.n.x,1,i);h=h.n}else{if(d)for(f=h.p.z,o=f.length-1;o>=0;--o)i.point((s=f[o])[0],s[1]);else r(h.x,h.p.x,-1,i);h=h.p}f=(h=h.o).z,d=!d}while(!h.v);i.lineEnd()}}}function jc(t){if(n=t.length){for(var n,e,r=0,i=t[0];++r<n;)i.n=e=t[r],e.p=i,i=e;i.n=e=t[0],e.p=i}}Pc.invert=Pc;var Hc=qa();function Xc(t){return Va(t[0])<=Fa?t[0]:eu(t[0])*((Va(t[0])+Fa)%Ha-Fa)}function Gc(t,n){var e=Xc(n),r=n[1],i=nu(r),o=[nu(e),-Za(e),0],a=0,u=0;Hc.reset(),1===i?r=Ia+Ba:-1===i&&(r=-Ia-Ba);for(var c=0,f=t.length;c<f;++c)if(l=(s=t[c]).length)for(var s,l,h=s[l-1],d=Xc(h),p=h[1]/2+ja,v=nu(p),g=Za(p),y=0;y<l;++y,d=b,v=x,g=w,h=_){var _=s[y],b=Xc(_),m=_[1]/2+ja,x=nu(m),w=Za(m),M=b-d,N=M>=0?1:-1,A=N*M,T=A>Fa,S=v*x;if(Hc.add(Wa(S*N*nu(A),g*w+S*Za(A))),a+=T?M+N*Ha:M,T^d>=e^b>=e){var k=Cu(ku(h),ku(_));Ru(k);var E=Cu(o,k);Ru(E);var C=(T^M>=0?-1:1)*au(E[2]);(r>C||r===C&&(k[0]||k[1]))&&(u+=T^M>=0?1:-1)}}return(a<-Ba||a<Ba&&Hc<-Ba)^1&u}function Vc(t,n,e,r){return function(i){var o,a,u,c=n(i),f=Bc(),s=n(f),l=!1,h={point:d,lineStart:v,lineEnd:g,polygonStart:function(){h.point=y,h.lineStart=_,h.lineEnd=b,a=[],o=[]},polygonEnd:function(){h.point=d,h.lineStart=v,h.lineEnd=g,a=T(a);var t=Gc(o,r);a.length?(l||(i.polygonStart(),l=!0),Ic(a,Wc,t,e,i)):t&&(l||(i.polygonStart(),l=!0),i.lineStart(),e(null,null,1,i),i.lineEnd()),l&&(i.polygonEnd(),l=!1),a=o=null},sphere:function(){i.polygonStart(),i.lineStart(),e(null,null,1,i),i.lineEnd(),i.polygonEnd()}};function d(n,e){t(n,e)&&i.point(n,e)}function p(t,n){c.point(t,n)}function v(){h.point=p,c.lineStart()}function g(){h.point=d,c.lineEnd()}function y(t,n){u.push([t,n]),s.point(t,n)}function _(){s.lineStart(),u=[]}function b(){y(u[0][0],u[0][1]),s.lineEnd();var t,n,e,r,c=s.clean(),h=f.result(),d=h.length;if(u.pop(),o.push(u),u=null,d)if(1&c){if((n=(e=h[0]).length-1)>0){for(l||(i.polygonStart(),l=!0),i.lineStart(),t=0;t<n;++t)i.point((r=e[t])[0],r[1]);i.lineEnd()}}else d>1&&2&c&&h.push(h.pop().concat(h.shift())),a.push(h.filter($c))}return h}}function $c(t){return t.length>1}function Wc(t,n){return((t=t.x)[0]<0?t[1]-Ia-Ba:Ia-t[1])-((n=n.x)[0]<0?n[1]-Ia-Ba:Ia-n[1])}var Zc=Vc(function(){return!0},function(t){var n,e=NaN,r=NaN,i=NaN;return{lineStart:function(){t.lineStart(),n=1},point:function(o,a){var u=o>0?Fa:-Fa,c=Va(o-e);Va(c-Fa)<Ba?(t.point(e,r=(r+a)/2>0?Ia:-Ia),t.point(i,r),t.lineEnd(),t.lineStart(),t.point(u,r),t.point(o,r),n=0):i!==u&&c>=Fa&&(Va(e-i)<Ba&&(e-=i*Ba),Va(o-u)<Ba&&(o-=u*Ba),r=function(t,n,e,r){var i,o,a=nu(t-e);return Va(a)>Ba?$a((nu(n)*(o=Za(r))*nu(e)-nu(r)*(i=Za(n))*nu(t))/(i*o*a)):(n+r)/2}(e,r,o,a),t.point(i,r),t.lineEnd(),t.lineStart(),t.point(u,r),n=0),t.point(e=o,r=a),i=u},lineEnd:function(){t.lineEnd(),e=r=NaN},clean:function(){return 2-n}}},function(t,n,e,r){var i;if(null==t)i=e*Ia,r.point(-Fa,i),r.point(0,i),r.point(Fa,i),r.point(Fa,0),r.point(Fa,-i),r.point(0,-i),r.point(-Fa,-i),r.point(-Fa,0),r.point(-Fa,i);else if(Va(t[0]-n[0])>Ba){var o=t[0]<n[0]?Fa:-Fa;i=e*o/2,r.point(-o,i),r.point(0,i),r.point(o,i)}else r.point(n[0],n[1])},[-Fa,-Ia]);function Qc(t){var n=Za(t),e=6*Ga,r=n>0,i=Va(n)>Ba;function o(t,e){return Za(t)*Za(e)>n}function a(t,e,r){var i=[1,0,0],o=Cu(ku(t),ku(e)),a=Eu(o,o),u=o[0],c=a-u*u;if(!c)return!r&&t;var f=n*a/c,s=-n*u/c,l=Cu(i,o),h=zu(i,f);Pu(h,zu(o,s));var d=l,p=Eu(h,d),v=Eu(d,d),g=p*p-v*(Eu(h,h)-1);if(!(g<0)){var y=ru(g),_=zu(d,(-p-y)/v);if(Pu(_,h),_=Su(_),!r)return _;var b,m=t[0],x=e[0],w=t[1],M=e[1];x<m&&(b=m,m=x,x=b);var N=x-m,A=Va(N-Fa)<Ba;if(!A&&M<w&&(b=w,w=M,M=b),A||N<Ba?A?w+M>0^_[1]<(Va(_[0]-m)<Ba?w:M):w<=_[1]&&_[1]<=M:N>Fa^(m<=_[0]&&_[0]<=x)){var T=zu(d,(-p+y)/v);return Pu(T,h),[_,Su(T)]}}}function u(n,e){var i=r?t:Fa-t,o=0;return n<-i?o|=1:n>i&&(o|=2),e<-i?o|=4:e>i&&(o|=8),o}return Vc(o,function(t){var n,e,c,f,s;return{lineStart:function(){f=c=!1,s=1},point:function(l,h){var d,p=[l,h],v=o(l,h),g=r?v?0:u(l,h):v?u(l+(l<0?Fa:-Fa),h):0;if(!n&&(f=c=v)&&t.lineStart(),v!==c&&(!(d=a(n,p))||Yc(n,d)||Yc(p,d))&&(p[0]+=Ba,p[1]+=Ba,v=o(p[0],p[1])),v!==c)s=0,v?(t.lineStart(),d=a(p,n),t.point(d[0],d[1])):(d=a(n,p),t.point(d[0],d[1]),t.lineEnd()),n=d;else if(i&&n&&r^v){var y;g&e||!(y=a(p,n,!0))||(s=0,r?(t.lineStart(),t.point(y[0][0],y[0][1]),t.point(y[1][0],y[1][1]),t.lineEnd()):(t.point(y[1][0],y[1][1]),t.lineEnd(),t.lineStart(),t.point(y[0][0],y[0][1])))}!v||n&&Yc(n,p)||t.point(p[0],p[1]),n=p,c=v,e=g},lineEnd:function(){c&&t.lineEnd(),n=null},clean:function(){return s|(f&&c)<<1}}},function(n,r,i,o){Uc(o,t,e,i,n,r)},r?[0,-t]:[-Fa,t-Fa])}var Jc=1e9,Kc=-Jc;function tf(t,n,e,r){function i(i,o){return t<=i&&i<=e&&n<=o&&o<=r}function o(i,o,u,f){var s=0,l=0;if(null==i||(s=a(i,u))!==(l=a(o,u))||c(i,o)<0^u>0)do{f.point(0===s||3===s?t:e,s>1?r:n)}while((s=(s+u+4)%4)!==l);else f.point(o[0],o[1])}function a(r,i){return Va(r[0]-t)<Ba?i>0?0:3:Va(r[0]-e)<Ba?i>0?2:1:Va(r[1]-n)<Ba?i>0?1:0:i>0?3:2}function u(t,n){return c(t.x,n.x)}function c(t,n){var e=a(t,1),r=a(n,1);return e!==r?e-r:0===e?n[1]-t[1]:1===e?t[0]-n[0]:2===e?t[1]-n[1]:n[0]-t[0]}return function(a){var c,f,s,l,h,d,p,v,g,y,_,b=a,m=Bc(),x={point:w,lineStart:function(){x.point=M,f&&f.push(s=[]);y=!0,g=!1,p=v=NaN},lineEnd:function(){c&&(M(l,h),d&&g&&m.rejoin(),c.push(m.result()));x.point=w,g&&b.lineEnd()},polygonStart:function(){b=m,c=[],f=[],_=!0},polygonEnd:function(){var n=function(){for(var n=0,e=0,i=f.length;e<i;++e)for(var o,a,u=f[e],c=1,s=u.length,l=u[0],h=l[0],d=l[1];c<s;++c)o=h,a=d,l=u[c],h=l[0],d=l[1],a<=r?d>r&&(h-o)*(r-a)>(d-a)*(t-o)&&++n:d<=r&&(h-o)*(r-a)<(d-a)*(t-o)&&--n;return n}(),e=_&&n,i=(c=T(c)).length;(e||i)&&(a.polygonStart(),e&&(a.lineStart(),o(null,null,1,a),a.lineEnd()),i&&Ic(c,u,n,o,a),a.polygonEnd());b=a,c=f=s=null}};function w(t,n){i(t,n)&&b.point(t,n)}function M(o,a){var u=i(o,a);if(f&&s.push([o,a]),y)l=o,h=a,d=u,y=!1,u&&(b.lineStart(),b.point(o,a));else if(u&&g)b.point(o,a);else{var c=[p=Math.max(Kc,Math.min(Jc,p)),v=Math.max(Kc,Math.min(Jc,v))],m=[o=Math.max(Kc,Math.min(Jc,o)),a=Math.max(Kc,Math.min(Jc,a))];!function(t,n,e,r,i,o){var a,u=t[0],c=t[1],f=0,s=1,l=n[0]-u,h=n[1]-c;if(a=e-u,l||!(a>0)){if(a/=l,l<0){if(a<f)return;a<s&&(s=a)}else if(l>0){if(a>s)return;a>f&&(f=a)}if(a=i-u,l||!(a<0)){if(a/=l,l<0){if(a>s)return;a>f&&(f=a)}else if(l>0){if(a<f)return;a<s&&(s=a)}if(a=r-c,h||!(a>0)){if(a/=h,h<0){if(a<f)return;a<s&&(s=a)}else if(h>0){if(a>s)return;a>f&&(f=a)}if(a=o-c,h||!(a<0)){if(a/=h,h<0){if(a>s)return;a>f&&(f=a)}else if(h>0){if(a<f)return;a<s&&(s=a)}return f>0&&(t[0]=u+f*l,t[1]=c+f*h),s<1&&(n[0]=u+s*l,n[1]=c+s*h),!0}}}}}(c,m,t,n,e,r)?u&&(b.lineStart(),b.point(o,a),_=!1):(g||(b.lineStart(),b.point(c[0],c[1])),b.point(m[0],m[1]),u||b.lineEnd(),_=!1)}p=o,v=a,g=u}return x}}var nf,ef,rf,of=qa(),af={sphere:cu,point:cu,lineStart:function(){af.point=cf,af.lineEnd=uf},lineEnd:cu,polygonStart:cu,polygonEnd:cu};function uf(){af.point=af.lineEnd=cu}function cf(t,n){nf=t*=Ga,ef=nu(n*=Ga),rf=Za(n),af.point=ff}function ff(t,n){t*=Ga;var e=nu(n*=Ga),r=Za(n),i=Va(t-nf),o=Za(i),a=r*nu(i),u=rf*e-ef*r*o,c=ef*e+rf*r*o;of.add(Wa(ru(a*a+u*u),c)),nf=t,ef=e,rf=r}function sf(t){return of.reset(),pu(t,af),+of}var lf=[null,null],hf={type:"LineString",coordinates:lf};function df(t,n){return lf[0]=t,lf[1]=n,sf(hf)}var pf={Feature:function(t,n){return gf(t.geometry,n)},FeatureCollection:function(t,n){for(var e=t.features,r=-1,i=e.length;++r<i;)if(gf(e[r].geometry,n))return!0;return!1}},vf={Sphere:function(){return!0},Point:function(t,n){return yf(t.coordinates,n)},MultiPoint:function(t,n){for(var e=t.coordinates,r=-1,i=e.length;++r<i;)if(yf(e[r],n))return!0;return!1},LineString:function(t,n){return _f(t.coordinates,n)},MultiLineString:function(t,n){for(var e=t.coordinates,r=-1,i=e.length;++r<i;)if(_f(e[r],n))return!0;return!1},Polygon:function(t,n){return bf(t.coordinates,n)},MultiPolygon:function(t,n){for(var e=t.coordinates,r=-1,i=e.length;++r<i;)if(bf(e[r],n))return!0;return!1},GeometryCollection:function(t,n){for(var e=t.geometries,r=-1,i=e.length;++r<i;)if(gf(e[r],n))return!0;return!1}};function gf(t,n){return!(!t||!vf.hasOwnProperty(t.type))&&vf[t.type](t,n)}function yf(t,n){return 0===df(t,n)}function _f(t,n){for(var e,r,i,o=0,a=t.length;o<a;o++){if(0===(r=df(t[o],n)))return!0;if(o>0&&(i=df(t[o],t[o-1]))>0&&e<=i&&r<=i&&(e+r-i)*(1-Math.pow((e-r)/i,2))<Ya*i)return!0;e=r}return!1}function bf(t,n){return!!Gc(t.map(mf),xf(n))}function mf(t){return(t=t.map(xf)).pop(),t}function xf(t){return[t[0]*Ga,t[1]*Ga]}function wf(t,n,e){var r=g(t,n-Ba,e).concat(n);return function(t){return r.map(function(n){return[t,n]})}}function Mf(t,n,e){var r=g(t,n-Ba,e).concat(n);return function(t){return r.map(function(n){return[n,t]})}}function Nf(){var t,n,e,r,i,o,a,u,c,f,s,l,h=10,d=h,p=90,v=360,y=2.5;function _(){return{type:"MultiLineString",coordinates:b()}}function b(){return g(Qa(r/p)*p,e,p).map(s).concat(g(Qa(u/v)*v,a,v).map(l)).concat(g(Qa(n/h)*h,t,h).filter(function(t){return Va(t%p)>Ba}).map(c)).concat(g(Qa(o/d)*d,i,d).filter(function(t){return Va(t%v)>Ba}).map(f))}return _.lines=function(){return b().map(function(t){return{type:"LineString",coordinates:t}})},_.outline=function(){return{type:"Polygon",coordinates:[s(r).concat(l(a).slice(1),s(e).reverse().slice(1),l(u).reverse().slice(1))]}},_.extent=function(t){return arguments.length?_.extentMajor(t).extentMinor(t):_.extentMinor()},_.extentMajor=function(t){return arguments.length?(r=+t[0][0],e=+t[1][0],u=+t[0][1],a=+t[1][1],r>e&&(t=r,r=e,e=t),u>a&&(t=u,u=a,a=t),_.precision(y)):[[r,u],[e,a]]},_.extentMinor=function(e){return arguments.length?(n=+e[0][0],t=+e[1][0],o=+e[0][1],i=+e[1][1],n>t&&(e=n,n=t,t=e),o>i&&(e=o,o=i,i=e),_.precision(y)):[[n,o],[t,i]]},_.step=function(t){return arguments.length?_.stepMajor(t).stepMinor(t):_.stepMinor()},_.stepMajor=function(t){return arguments.length?(p=+t[0],v=+t[1],_):[p,v]},_.stepMinor=function(t){return arguments.length?(h=+t[0],d=+t[1],_):[h,d]},_.precision=function(h){return arguments.length?(y=+h,c=wf(o,i,90),f=Mf(n,t,y),s=wf(u,a,90),l=Mf(r,e,y),_):y},_.extentMajor([[-180,-90+Ba],[180,90-Ba]]).extentMinor([[-180,-80-Ba],[180,80+Ba]])}function Af(t){return t}var Tf,Sf,kf,Ef,Cf=qa(),Pf=qa(),zf={point:cu,lineStart:cu,lineEnd:cu,polygonStart:function(){zf.lineStart=Rf,zf.lineEnd=Lf},polygonEnd:function(){zf.lineStart=zf.lineEnd=zf.point=cu,Cf.add(Va(Pf)),Pf.reset()},result:function(){var t=Cf/2;return Cf.reset(),t}};function Rf(){zf.point=Df}function Df(t,n){zf.point=qf,Tf=kf=t,Sf=Ef=n}function qf(t,n){Pf.add(Ef*t-kf*n),kf=t,Ef=n}function Lf(){qf(Tf,Sf)}var Uf=1/0,Of=Uf,Bf=-Uf,Yf=Bf,Ff={point:function(t,n){t<Uf&&(Uf=t);t>Bf&&(Bf=t);n<Of&&(Of=n);n>Yf&&(Yf=n)},lineStart:cu,lineEnd:cu,polygonStart:cu,polygonEnd:cu,result:function(){var t=[[Uf,Of],[Bf,Yf]];return Bf=Yf=-(Of=Uf=1/0),t}};var If,jf,Hf,Xf,Gf=0,Vf=0,$f=0,Wf=0,Zf=0,Qf=0,Jf=0,Kf=0,ts=0,ns={point:es,lineStart:rs,lineEnd:as,polygonStart:function(){ns.lineStart=us,ns.lineEnd=cs},polygonEnd:function(){ns.point=es,ns.lineStart=rs,ns.lineEnd=as},result:function(){var t=ts?[Jf/ts,Kf/ts]:Qf?[Wf/Qf,Zf/Qf]:$f?[Gf/$f,Vf/$f]:[NaN,NaN];return Gf=Vf=$f=Wf=Zf=Qf=Jf=Kf=ts=0,t}};function es(t,n){Gf+=t,Vf+=n,++$f}function rs(){ns.point=is}function is(t,n){ns.point=os,es(Hf=t,Xf=n)}function os(t,n){var e=t-Hf,r=n-Xf,i=ru(e*e+r*r);Wf+=i*(Hf+t)/2,Zf+=i*(Xf+n)/2,Qf+=i,es(Hf=t,Xf=n)}function as(){ns.point=es}function us(){ns.point=fs}function cs(){ss(If,jf)}function fs(t,n){ns.point=ss,es(If=Hf=t,jf=Xf=n)}function ss(t,n){var e=t-Hf,r=n-Xf,i=ru(e*e+r*r);Wf+=i*(Hf+t)/2,Zf+=i*(Xf+n)/2,Qf+=i,Jf+=(i=Xf*t-Hf*n)*(Hf+t),Kf+=i*(Xf+n),ts+=3*i,es(Hf=t,Xf=n)}function ls(t){this._context=t}ls.prototype={_radius:4.5,pointRadius:function(t){return this._radius=t,this},polygonStart:function(){this._line=0},polygonEnd:function(){this._line=NaN},lineStart:function(){this._point=0},lineEnd:function(){0===this._line&&this._context.closePath(),this._point=NaN},point:function(t,n){switch(this._point){case 0:this._context.moveTo(t,n),this._point=1;break;case 1:this._context.lineTo(t,n);break;default:this._context.moveTo(t+this._radius,n),this._context.arc(t,n,this._radius,0,Ha)}},result:cu};var hs,ds,ps,vs,gs,ys=qa(),_s={point:cu,lineStart:function(){_s.point=bs},lineEnd:function(){hs&&ms(ds,ps),_s.point=cu},polygonStart:function(){hs=!0},polygonEnd:function(){hs=null},result:function(){var t=+ys;return ys.reset(),t}};function bs(t,n){_s.point=ms,ds=vs=t,ps=gs=n}function ms(t,n){vs-=t,gs-=n,ys.add(ru(vs*vs+gs*gs)),vs=t,gs=n}function xs(){this._string=[]}function ws(t){return"m0,"+t+"a"+t+","+t+" 0 1,1 0,"+-2*t+"a"+t+","+t+" 0 1,1 0,"+2*t+"z"}function Ms(t){return function(n){var e=new Ns;for(var r in t)e[r]=t[r];return e.stream=n,e}}function Ns(){}function As(t,n,e){var r=t.clipExtent&&t.clipExtent();return t.scale(150).translate([0,0]),null!=r&&t.clipExtent(null),pu(e,t.stream(Ff)),n(Ff.result()),null!=r&&t.clipExtent(r),t}function Ts(t,n,e){return As(t,function(e){var r=n[1][0]-n[0][0],i=n[1][1]-n[0][1],o=Math.min(r/(e[1][0]-e[0][0]),i/(e[1][1]-e[0][1])),a=+n[0][0]+(r-o*(e[1][0]+e[0][0]))/2,u=+n[0][1]+(i-o*(e[1][1]+e[0][1]))/2;t.scale(150*o).translate([a,u])},e)}function Ss(t,n,e){return Ts(t,[[0,0],n],e)}function ks(t,n,e){return As(t,function(e){var r=+n,i=r/(e[1][0]-e[0][0]),o=(r-i*(e[1][0]+e[0][0]))/2,a=-i*e[0][1];t.scale(150*i).translate([o,a])},e)}function Es(t,n,e){return As(t,function(e){var r=+n,i=r/(e[1][1]-e[0][1]),o=-i*e[0][0],a=(r-i*(e[1][1]+e[0][1]))/2;t.scale(150*i).translate([o,a])},e)}xs.prototype={_radius:4.5,_circle:ws(4.5),pointRadius:function(t){return(t=+t)!==this._radius&&(this._radius=t,this._circle=null),this},polygonStart:function(){this._line=0},polygonEnd:function(){this._line=NaN},lineStart:function(){this._point=0},lineEnd:function(){0===this._line&&this._string.push("Z"),this._point=NaN},point:function(t,n){switch(this._point){case 0:this._string.push("M",t,",",n),this._point=1;break;case 1:this._string.push("L",t,",",n);break;default:null==this._circle&&(this._circle=ws(this._radius)),this._string.push("M",t,",",n,this._circle)}},result:function(){if(this._string.length){var t=this._string.join("");return this._string=[],t}return null}},Ns.prototype={constructor:Ns,point:function(t,n){this.stream.point(t,n)},sphere:function(){this.stream.sphere()},lineStart:function(){this.stream.lineStart()},lineEnd:function(){this.stream.lineEnd()},polygonStart:function(){this.stream.polygonStart()},polygonEnd:function(){this.stream.polygonEnd()}};var Cs=16,Ps=Za(30*Ga);function zs(t,n){return+n?function(t,n){function e(r,i,o,a,u,c,f,s,l,h,d,p,v,g){var y=f-r,_=s-i,b=y*y+_*_;if(b>4*n&&v--){var m=a+h,x=u+d,w=c+p,M=ru(m*m+x*x+w*w),N=au(w/=M),A=Va(Va(w)-1)<Ba||Va(o-l)<Ba?(o+l)/2:Wa(x,m),T=t(A,N),S=T[0],k=T[1],E=S-r,C=k-i,P=_*E-y*C;(P*P/b>n||Va((y*E+_*C)/b-.5)>.3||a*h+u*d+c*p<Ps)&&(e(r,i,o,a,u,c,S,k,A,m/=M,x/=M,w,v,g),g.point(S,k),e(S,k,A,m,x,w,f,s,l,h,d,p,v,g))}}return function(n){var r,i,o,a,u,c,f,s,l,h,d,p,v={point:g,lineStart:y,lineEnd:b,polygonStart:function(){n.polygonStart(),v.lineStart=m},polygonEnd:function(){n.polygonEnd(),v.lineStart=y}};function g(e,r){e=t(e,r),n.point(e[0],e[1])}function y(){s=NaN,v.point=_,n.lineStart()}function _(r,i){var o=ku([r,i]),a=t(r,i);e(s,l,f,h,d,p,s=a[0],l=a[1],f=r,h=o[0],d=o[1],p=o[2],Cs,n),n.point(s,l)}function b(){v.point=g,n.lineEnd()}function m(){y(),v.point=x,v.lineEnd=w}function x(t,n){_(r=t,n),i=s,o=l,a=h,u=d,c=p,v.point=_}function w(){e(s,l,f,h,d,p,i,o,r,a,u,c,Cs,n),v.lineEnd=b,b()}return v}}(t,n):function(t){return Ms({point:function(n,e){n=t(n,e),this.stream.point(n[0],n[1])}})}(t)}var Rs=Ms({point:function(t,n){this.stream.point(t*Ga,n*Ga)}});function Ds(t,n,e,r){var i=Za(r),o=nu(r),a=i*t,u=o*t,c=i/t,f=o/t,s=(o*e-i*n)/t,l=(o*n+i*e)/t;function h(t,r){return[a*t-u*r+n,e-u*t-a*r]}return h.invert=function(t,n){return[c*t-f*n+s,l-f*t-c*n]},h}function qs(t){return Ls(function(){return t})()}function Ls(t){var n,e,r,i,o,a,u,c,f,s,l=150,h=480,d=250,p=0,v=0,g=0,y=0,_=0,b=0,m=null,x=Zc,w=null,M=Af,N=.5;function A(t){return c(t[0]*Ga,t[1]*Ga)}function T(t){return(t=c.invert(t[0],t[1]))&&[t[0]*Xa,t[1]*Xa]}function S(){var t=Ds(l,0,0,b).apply(null,n(p,v)),r=(b?Ds:function(t,n,e){function r(r,i){return[n+t*r,e-t*i]}return r.invert=function(r,i){return[(r-n)/t,(e-i)/t]},r})(l,h-t[0],d-t[1],b);return e=zc(g,y,_),u=Cc(n,r),c=Cc(e,u),a=zs(u,N),k()}function k(){return f=s=null,A}return A.stream=function(t){return f&&s===t?f:f=Rs(function(t){return Ms({point:function(n,e){var r=t(n,e);return this.stream.point(r[0],r[1])}})}(e)(x(a(M(s=t)))))},A.preclip=function(t){return arguments.length?(x=t,m=void 0,k()):x},A.postclip=function(t){return arguments.length?(M=t,w=r=i=o=null,k()):M},A.clipAngle=function(t){return arguments.length?(x=+t?Qc(m=t*Ga):(m=null,Zc),k()):m*Xa},A.clipExtent=function(t){return arguments.length?(M=null==t?(w=r=i=o=null,Af):tf(w=+t[0][0],r=+t[0][1],i=+t[1][0],o=+t[1][1]),k()):null==w?null:[[w,r],[i,o]]},A.scale=function(t){return arguments.length?(l=+t,S()):l},A.translate=function(t){return arguments.length?(h=+t[0],d=+t[1],S()):[h,d]},A.center=function(t){return arguments.length?(p=t[0]%360*Ga,v=t[1]%360*Ga,S()):[p*Xa,v*Xa]},A.rotate=function(t){return arguments.length?(g=t[0]%360*Ga,y=t[1]%360*Ga,_=t.length>2?t[2]%360*Ga:0,S()):[g*Xa,y*Xa,_*Xa]},A.angle=function(t){return arguments.length?(b=t%360*Ga,S()):b*Xa},A.precision=function(t){return arguments.length?(a=zs(u,N=t*t),k()):ru(N)},A.fitExtent=function(t,n){return Ts(A,t,n)},A.fitSize=function(t,n){return Ss(A,t,n)},A.fitWidth=function(t,n){return ks(A,t,n)},A.fitHeight=function(t,n){return Es(A,t,n)},function(){return n=t.apply(this,arguments),A.invert=n.invert&&T,S()}}function Us(t){var n=0,e=Fa/3,r=Ls(t),i=r(n,e);return i.parallels=function(t){return arguments.length?r(n=t[0]*Ga,e=t[1]*Ga):[n*Xa,e*Xa]},i}function Os(t,n){var e=nu(t),r=(e+nu(n))/2;if(Va(r)<Ba)return function(t){var n=Za(t);function e(t,e){return[t*n,nu(e)/n]}return e.invert=function(t,e){return[t/n,au(e*n)]},e}(t);var i=1+e*(2*r-e),o=ru(i)/r;function a(t,n){var e=ru(i-2*r*nu(n))/r;return[e*nu(t*=r),o-e*Za(t)]}return a.invert=function(t,n){var e=o-n;return[Wa(t,Va(e))/r*eu(e),au((i-(t*t+e*e)*r*r)/(2*r))]},a}function Bs(){return Us(Os).scale(155.424).center([0,33.6442])}function Ys(){return Bs().parallels([29.5,45.5]).scale(1070).translate([480,250]).rotate([96,0]).center([-.6,38.7])}function Fs(t){return function(n,e){var r=Za(n),i=Za(e),o=t(r*i);return[o*i*nu(n),o*nu(e)]}}function Is(t){return function(n,e){var r=ru(n*n+e*e),i=t(r),o=nu(i),a=Za(i);return[Wa(n*o,r*a),au(r&&e*o/r)]}}var js=Fs(function(t){return ru(2/(1+t))});js.invert=Is(function(t){return 2*au(t/2)});var Hs=Fs(function(t){return(t=ou(t))&&t/nu(t)});function Xs(t,n){return[t,Ka(iu((Ia+n)/2))]}function Gs(t){var n,e,r,i=qs(t),o=i.center,a=i.scale,u=i.translate,c=i.clipExtent,f=null;function s(){var o=Fa*a(),u=i(Lc(i.rotate()).invert([0,0]));return c(null==f?[[u[0]-o,u[1]-o],[u[0]+o,u[1]+o]]:t===Xs?[[Math.max(u[0]-o,f),n],[Math.min(u[0]+o,e),r]]:[[f,Math.max(u[1]-o,n)],[e,Math.min(u[1]+o,r)]])}return i.scale=function(t){return arguments.length?(a(t),s()):a()},i.translate=function(t){return arguments.length?(u(t),s()):u()},i.center=function(t){return arguments.length?(o(t),s()):o()},i.clipExtent=function(t){return arguments.length?(null==t?f=n=e=r=null:(f=+t[0][0],n=+t[0][1],e=+t[1][0],r=+t[1][1]),s()):null==f?null:[[f,n],[e,r]]},s()}function Vs(t){return iu((Ia+t)/2)}function $s(t,n){var e=Za(t),r=t===n?nu(t):Ka(e/Za(n))/Ka(Vs(n)/Vs(t)),i=e*tu(Vs(t),r)/r;if(!r)return Xs;function o(t,n){i>0?n<-Ia+Ba&&(n=-Ia+Ba):n>Ia-Ba&&(n=Ia-Ba);var e=i/tu(Vs(n),r);return[e*nu(r*t),i-e*Za(r*t)]}return o.invert=function(t,n){var e=i-n,o=eu(r)*ru(t*t+e*e);return[Wa(t,Va(e))/r*eu(e),2*$a(tu(i/o,1/r))-Ia]},o}function Ws(t,n){return[t,n]}function Zs(t,n){var e=Za(t),r=t===n?nu(t):(e-Za(n))/(n-t),i=e/r+t;if(Va(r)<Ba)return Ws;function o(t,n){var e=i-n,o=r*t;return[e*nu(o),i-e*Za(o)]}return o.invert=function(t,n){var e=i-n;return[Wa(t,Va(e))/r*eu(e),i-eu(r)*ru(t*t+e*e)]},o}Hs.invert=Is(function(t){return t}),Xs.invert=function(t,n){return[t,2*$a(Ja(n))-Ia]},Ws.invert=Ws;var Qs=1.340264,Js=-.081106,Ks=893e-6,tl=.003796,nl=ru(3)/2;function el(t,n){var e=au(nl*nu(n)),r=e*e,i=r*r*r;return[t*Za(e)/(nl*(Qs+3*Js*r+i*(7*Ks+9*tl*r))),e*(Qs+Js*r+i*(Ks+tl*r))]}function rl(t,n){var e=Za(n),r=Za(t)*e;return[e*nu(t)/r,nu(n)/r]}function il(t,n,e,r){return 1===t&&1===n&&0===e&&0===r?Af:Ms({point:function(i,o){this.stream.point(i*t+e,o*n+r)}})}function ol(t,n){var e=n*n,r=e*e;return[t*(.8707-.131979*e+r*(r*(.003971*e-.001529*r)-.013791)),n*(1.007226+e*(.015085+r*(.028874*e-.044475-.005916*r)))]}function al(t,n){return[Za(n)*nu(t),nu(n)]}function ul(t,n){var e=Za(n),r=1+Za(t)*e;return[e*nu(t)/r,nu(n)/r]}function cl(t,n){return[Ka(iu((Ia+n)/2)),-t]}function fl(t,n){return t.parent===n.parent?1:2}function sl(t,n){return t+n.x}function ll(t,n){return Math.max(t,n.y)}function hl(t){var n=0,e=t.children,r=e&&e.length;if(r)for(;--r>=0;)n+=e[r].value;else n=1;t.value=n}function dl(t,n){var e,r,i,o,a,u=new yl(t),c=+t.value&&(u.value=t.value),f=[u];for(null==n&&(n=pl);e=f.pop();)if(c&&(e.value=+e.data.value),(i=n(e.data))&&(a=i.length))for(e.children=new Array(a),o=a-1;o>=0;--o)f.push(r=e.children[o]=new yl(i[o])),r.parent=e,r.depth=e.depth+1;return u.eachBefore(gl)}function pl(t){return t.children}function vl(t){t.data=t.data.data}function gl(t){var n=0;do{t.height=n}while((t=t.parent)&&t.height<++n)}function yl(t){this.data=t,this.depth=this.height=0,this.parent=null}el.invert=function(t,n){for(var e,r=n,i=r*r,o=i*i*i,a=0;a<12&&(o=(i=(r-=e=(r*(Qs+Js*i+o*(Ks+tl*i))-n)/(Qs+3*Js*i+o*(7*Ks+9*tl*i)))*r)*i*i,!(Va(e)<Ya));++a);return[nl*t*(Qs+3*Js*i+o*(7*Ks+9*tl*i))/Za(r),au(nu(r)/nl)]},rl.invert=Is($a),ol.invert=function(t,n){var e,r=n,i=25;do{var o=r*r,a=o*o;r-=e=(r*(1.007226+o*(.015085+a*(.028874*o-.044475-.005916*a)))-n)/(1.007226+o*(.045255+a*(.259866*o-.311325-.005916*11*a)))}while(Va(e)>Ba&&--i>0);return[t/(.8707+(o=r*r)*(o*(o*o*o*(.003971-.001529*o)-.013791)-.131979)),r]},al.invert=Is(au),ul.invert=Is(function(t){return 2*$a(t)}),cl.invert=function(t,n){return[-n,2*$a(Ja(t))-Ia]},yl.prototype=dl.prototype={constructor:yl,count:function(){return this.eachAfter(hl)},each:function(t){var n,e,r,i,o=this,a=[o];do{for(n=a.reverse(),a=[];o=n.pop();)if(t(o),e=o.children)for(r=0,i=e.length;r<i;++r)a.push(e[r])}while(a.length);return this},eachAfter:function(t){for(var n,e,r,i=this,o=[i],a=[];i=o.pop();)if(a.push(i),n=i.children)for(e=0,r=n.length;e<r;++e)o.push(n[e]);for(;i=a.pop();)t(i);return this},eachBefore:function(t){for(var n,e,r=this,i=[r];r=i.pop();)if(t(r),n=r.children)for(e=n.length-1;e>=0;--e)i.push(n[e]);return this},sum:function(t){return this.eachAfter(function(n){for(var e=+t(n.data)||0,r=n.children,i=r&&r.length;--i>=0;)e+=r[i].value;n.value=e})},sort:function(t){return this.eachBefore(function(n){n.children&&n.children.sort(t)})},path:function(t){for(var n=this,e=function(t,n){if(t===n)return t;var e=t.ancestors(),r=n.ancestors(),i=null;for(t=e.pop(),n=r.pop();t===n;)i=t,t=e.pop(),n=r.pop();return i}(n,t),r=[n];n!==e;)n=n.parent,r.push(n);for(var i=r.length;t!==e;)r.splice(i,0,t),t=t.parent;return r},ancestors:function(){for(var t=this,n=[t];t=t.parent;)n.push(t);return n},descendants:function(){var t=[];return this.each(function(n){t.push(n)}),t},leaves:function(){var t=[];return this.eachBefore(function(n){n.children||t.push(n)}),t},links:function(){var t=this,n=[];return t.each(function(e){e!==t&&n.push({source:e.parent,target:e})}),n},copy:function(){return dl(this).eachBefore(vl)}};var _l=Array.prototype.slice;function bl(t){for(var n,e,r=0,i=(t=function(t){for(var n,e,r=t.length;r;)e=Math.random()*r--|0,n=t[r],t[r]=t[e],t[e]=n;return t}(_l.call(t))).length,o=[];r<i;)n=t[r],e&&wl(e,n)?++r:(e=Nl(o=ml(o,n)),r=0);return e}function ml(t,n){var e,r;if(Ml(n,t))return[n];for(e=0;e<t.length;++e)if(xl(n,t[e])&&Ml(Al(t[e],n),t))return[t[e],n];for(e=0;e<t.length-1;++e)for(r=e+1;r<t.length;++r)if(xl(Al(t[e],t[r]),n)&&xl(Al(t[e],n),t[r])&&xl(Al(t[r],n),t[e])&&Ml(Tl(t[e],t[r],n),t))return[t[e],t[r],n];throw new Error}function xl(t,n){var e=t.r-n.r,r=n.x-t.x,i=n.y-t.y;return e<0||e*e<r*r+i*i}function wl(t,n){var e=t.r-n.r+1e-6,r=n.x-t.x,i=n.y-t.y;return e>0&&e*e>r*r+i*i}function Ml(t,n){for(var e=0;e<n.length;++e)if(!wl(t,n[e]))return!1;return!0}function Nl(t){switch(t.length){case 1:return{x:(n=t[0]).x,y:n.y,r:n.r};case 2:return Al(t[0],t[1]);case 3:return Tl(t[0],t[1],t[2])}var n}function Al(t,n){var e=t.x,r=t.y,i=t.r,o=n.x,a=n.y,u=n.r,c=o-e,f=a-r,s=u-i,l=Math.sqrt(c*c+f*f);return{x:(e+o+c/l*s)/2,y:(r+a+f/l*s)/2,r:(l+i+u)/2}}function Tl(t,n,e){var r=t.x,i=t.y,o=t.r,a=n.x,u=n.y,c=n.r,f=e.x,s=e.y,l=e.r,h=r-a,d=r-f,p=i-u,v=i-s,g=c-o,y=l-o,_=r*r+i*i-o*o,b=_-a*a-u*u+c*c,m=_-f*f-s*s+l*l,x=d*p-h*v,w=(p*m-v*b)/(2*x)-r,M=(v*g-p*y)/x,N=(d*b-h*m)/(2*x)-i,A=(h*y-d*g)/x,T=M*M+A*A-1,S=2*(o+w*M+N*A),k=w*w+N*N-o*o,E=-(T?(S+Math.sqrt(S*S-4*T*k))/(2*T):k/S);return{x:r+w+M*E,y:i+N+A*E,r:E}}function Sl(t,n,e){var r,i,o,a,u=t.x-n.x,c=t.y-n.y,f=u*u+c*c;f?(i=n.r+e.r,i*=i,a=t.r+e.r,i>(a*=a)?(r=(f+a-i)/(2*f),o=Math.sqrt(Math.max(0,a/f-r*r)),e.x=t.x-r*u-o*c,e.y=t.y-r*c+o*u):(r=(f+i-a)/(2*f),o=Math.sqrt(Math.max(0,i/f-r*r)),e.x=n.x+r*u-o*c,e.y=n.y+r*c+o*u)):(e.x=n.x+e.r,e.y=n.y)}function kl(t,n){var e=t.r+n.r-1e-6,r=n.x-t.x,i=n.y-t.y;return e>0&&e*e>r*r+i*i}function El(t){var n=t._,e=t.next._,r=n.r+e.r,i=(n.x*e.r+e.x*n.r)/r,o=(n.y*e.r+e.y*n.r)/r;return i*i+o*o}function Cl(t){this._=t,this.next=null,this.previous=null}function Pl(t){if(!(i=t.length))return 0;var n,e,r,i,o,a,u,c,f,s,l;if((n=t[0]).x=0,n.y=0,!(i>1))return n.r;if(e=t[1],n.x=-e.r,e.x=n.r,e.y=0,!(i>2))return n.r+e.r;Sl(e,n,r=t[2]),n=new Cl(n),e=new Cl(e),r=new Cl(r),n.next=r.previous=e,e.next=n.previous=r,r.next=e.previous=n;t:for(u=3;u<i;++u){Sl(n._,e._,r=t[u]),r=new Cl(r),c=e.next,f=n.previous,s=e._.r,l=n._.r;do{if(s<=l){if(kl(c._,r._)){e=c,n.next=e,e.previous=n,--u;continue t}s+=c._.r,c=c.next}else{if(kl(f._,r._)){(n=f).next=e,e.previous=n,--u;continue t}l+=f._.r,f=f.previous}}while(c!==f.next);for(r.previous=n,r.next=e,n.next=e.previous=e=r,o=El(n);(r=r.next)!==e;)(a=El(r))<o&&(n=r,o=a);e=n.next}for(n=[e._],r=e;(r=r.next)!==e;)n.push(r._);for(r=bl(n),u=0;u<i;++u)(n=t[u]).x-=r.x,n.y-=r.y;return r.r}function zl(t){if("function"!=typeof t)throw new Error;return t}function Rl(){return 0}function Dl(t){return function(){return t}}function ql(t){return Math.sqrt(t.value)}function Ll(t){return function(n){n.children||(n.r=Math.max(0,+t(n)||0))}}function Ul(t,n){return function(e){if(r=e.children){var r,i,o,a=r.length,u=t(e)*n||0;if(u)for(i=0;i<a;++i)r[i].r+=u;if(o=Pl(r),u)for(i=0;i<a;++i)r[i].r-=u;e.r=o+u}}}function Ol(t){return function(n){var e=n.parent;n.r*=t,e&&(n.x=e.x+t*n.x,n.y=e.y+t*n.y)}}function Bl(t){t.x0=Math.round(t.x0),t.y0=Math.round(t.y0),t.x1=Math.round(t.x1),t.y1=Math.round(t.y1)}function Yl(t,n,e,r,i){for(var o,a=t.children,u=-1,c=a.length,f=t.value&&(r-n)/t.value;++u<c;)(o=a[u]).y0=e,o.y1=i,o.x0=n,o.x1=n+=o.value*f}var Fl="$",Il={depth:-1},jl={};function Hl(t){return t.id}function Xl(t){return t.parentId}function Gl(t,n){return t.parent===n.parent?1:2}function Vl(t){var n=t.children;return n?n[0]:t.t}function $l(t){var n=t.children;return n?n[n.length-1]:t.t}function Wl(t,n,e){var r=e/(n.i-t.i);n.c-=r,n.s+=e,t.c+=r,n.z+=e,n.m+=e}function Zl(t,n,e){return t.a.parent===n.parent?t.a:e}function Ql(t,n){this._=t,this.parent=null,this.children=null,this.A=null,this.a=this,this.z=0,this.m=0,this.c=0,this.s=0,this.t=null,this.i=n}function Jl(t,n,e,r,i){for(var o,a=t.children,u=-1,c=a.length,f=t.value&&(i-e)/t.value;++u<c;)(o=a[u]).x0=n,o.x1=r,o.y0=e,o.y1=e+=o.value*f}Ql.prototype=Object.create(yl.prototype);var Kl=(1+Math.sqrt(5))/2;function th(t,n,e,r,i,o){for(var a,u,c,f,s,l,h,d,p,v,g,y=[],_=n.children,b=0,m=0,x=_.length,w=n.value;b<x;){c=i-e,f=o-r;do{s=_[m++].value}while(!s&&m<x);for(l=h=s,g=s*s*(v=Math.max(f/c,c/f)/(w*t)),p=Math.max(h/g,g/l);m<x;++m){if(s+=u=_[m].value,u<l&&(l=u),u>h&&(h=u),g=s*s*v,(d=Math.max(h/g,g/l))>p){s-=u;break}p=d}y.push(a={value:s,dice:c<f,children:_.slice(b,m)}),a.dice?Yl(a,e,r,i,w?r+=f*s/w:o):Jl(a,e,r,w?e+=c*s/w:i,o),w-=s,b=m}return y}var nh=function t(n){function e(t,e,r,i,o){th(n,t,e,r,i,o)}return e.ratio=function(n){return t((n=+n)>1?n:1)},e}(Kl);var eh=function t(n){function e(t,e,r,i,o){if((a=t._squarify)&&a.ratio===n)for(var a,u,c,f,s,l=-1,h=a.length,d=t.value;++l<h;){for(c=(u=a[l]).children,f=u.value=0,s=c.length;f<s;++f)u.value+=c[f].value;u.dice?Yl(u,e,r,i,r+=(o-r)*u.value/d):Jl(u,e,r,e+=(i-e)*u.value/d,o),d-=u.value}else t._squarify=a=th(n,t,e,r,i,o),a.ratio=n}return e.ratio=function(n){return t((n=+n)>1?n:1)},e}(Kl);function rh(t,n){return t[0]-n[0]||t[1]-n[1]}function ih(t){for(var n,e,r,i=t.length,o=[0,1],a=2,u=2;u<i;++u){for(;a>1&&(n=t[o[a-2]],e=t[o[a-1]],r=t[u],(e[0]-n[0])*(r[1]-n[1])-(e[1]-n[1])*(r[0]-n[0])<=0);)--a;o[a++]=u}return o.slice(0,a)}function oh(){return Math.random()}var ah=function t(n){function e(t,e){return t=null==t?0:+t,e=null==e?1:+e,1===arguments.length?(e=t,t=0):e-=t,function(){return n()*e+t}}return e.source=t,e}(oh),uh=function t(n){function e(t,e){var r,i;return t=null==t?0:+t,e=null==e?1:+e,function(){var o;if(null!=r)o=r,r=null;else do{r=2*n()-1,o=2*n()-1,i=r*r+o*o}while(!i||i>1);return t+e*o*Math.sqrt(-2*Math.log(i)/i)}}return e.source=t,e}(oh),ch=function t(n){function e(){var t=uh.source(n).apply(this,arguments);return function(){return Math.exp(t())}}return e.source=t,e}(oh),fh=function t(n){function e(t){return function(){for(var e=0,r=0;r<t;++r)e+=n();return e}}return e.source=t,e}(oh),sh=function t(n){function e(t){var e=fh.source(n)(t);return function(){return e()/t}}return e.source=t,e}(oh),lh=function t(n){function e(t){return function(){return-Math.log(1-n())/t}}return e.source=t,e}(oh);function hh(t,n){switch(arguments.length){case 0:break;case 1:this.range(t);break;default:this.range(n).domain(t)}return this}function dh(t,n){switch(arguments.length){case 0:break;case 1:this.interpolator(t);break;default:this.interpolator(n).domain(t)}return this}var ph=Array.prototype,vh=ph.map,gh=ph.slice,yh={name:"implicit"};function _h(){var t=Ji(),n=[],e=[],r=yh;function i(i){var o=i+"",a=t.get(o);if(!a){if(r!==yh)return r;t.set(o,a=n.push(i))}return e[(a-1)%e.length]}return i.domain=function(e){if(!arguments.length)return n.slice();n=[],t=Ji();for(var r,o,a=-1,u=e.length;++a<u;)t.has(o=(r=e[a])+"")||t.set(o,n.push(r));return i},i.range=function(t){return arguments.length?(e=gh.call(t),i):e.slice()},i.unknown=function(t){return arguments.length?(r=t,i):r},i.copy=function(){return _h(n,e).unknown(r)},hh.apply(i,arguments),i}function bh(){var t,n,e=_h().unknown(void 0),r=e.domain,i=e.range,o=[0,1],a=!1,u=0,c=0,f=.5;function s(){var e=r().length,s=o[1]<o[0],l=o[s-0],h=o[1-s];t=(h-l)/Math.max(1,e-u+2*c),a&&(t=Math.floor(t)),l+=(h-l-t*(e-u))*f,n=t*(1-u),a&&(l=Math.round(l),n=Math.round(n));var d=g(e).map(function(n){return l+t*n});return i(s?d.reverse():d)}return delete e.unknown,e.domain=function(t){return arguments.length?(r(t),s()):r()},e.range=function(t){return arguments.length?(o=[+t[0],+t[1]],s()):o.slice()},e.rangeRound=function(t){return o=[+t[0],+t[1]],a=!0,s()},e.bandwidth=function(){return n},e.step=function(){return t},e.round=function(t){return arguments.length?(a=!!t,s()):a},e.padding=function(t){return arguments.length?(u=Math.min(1,c=+t),s()):u},e.paddingInner=function(t){return arguments.length?(u=Math.min(1,t),s()):u},e.paddingOuter=function(t){return arguments.length?(c=+t,s()):c},e.align=function(t){return arguments.length?(f=Math.max(0,Math.min(1,t)),s()):f},e.copy=function(){return bh(r(),o).round(a).paddingInner(u).paddingOuter(c).align(f)},hh.apply(s(),arguments)}function mh(t){return+t}var xh=[0,1];function wh(t){return t}function Mh(t,n){return(n-=t=+t)?function(e){return(e-t)/n}:(e=isNaN(n)?NaN:.5,function(){return e});var e}function Nh(t){var n,e=t[0],r=t[t.length-1];return e>r&&(n=e,e=r,r=n),function(t){return Math.max(e,Math.min(r,t))}}function Ah(t,n,e){var r=t[0],i=t[1],o=n[0],a=n[1];return i<r?(r=Mh(i,r),o=e(a,o)):(r=Mh(r,i),o=e(o,a)),function(t){return o(r(t))}}function Th(t,n,e){var r=Math.min(t.length,n.length)-1,o=new Array(r),a=new Array(r),u=-1;for(t[r]<t[0]&&(t=t.slice().reverse(),n=n.slice().reverse());++u<r;)o[u]=Mh(t[u],t[u+1]),a[u]=e(n[u],n[u+1]);return function(n){var e=i(t,n,1,r)-1;return a[e](o[e](n))}}function Sh(t,n){return n.domain(t.domain()).range(t.range()).interpolate(t.interpolate()).clamp(t.clamp()).unknown(t.unknown())}function kh(){var t,n,e,r,i,o,a=xh,u=xh,c=_e,f=wh;function s(){return r=Math.min(a.length,u.length)>2?Th:Ah,i=o=null,l}function l(n){return isNaN(n=+n)?e:(i||(i=r(a.map(t),u,c)))(t(f(n)))}return l.invert=function(e){return f(n((o||(o=r(u,a.map(t),de)))(e)))},l.domain=function(t){return arguments.length?(a=vh.call(t,mh),f===wh||(f=Nh(a)),s()):a.slice()},l.range=function(t){return arguments.length?(u=gh.call(t),s()):u.slice()},l.rangeRound=function(t){return u=gh.call(t),c=be,s()},l.clamp=function(t){return arguments.length?(f=t?Nh(a):wh,l):f!==wh},l.interpolate=function(t){return arguments.length?(c=t,s()):c},l.unknown=function(t){return arguments.length?(e=t,l):e},function(e,r){return t=e,n=r,s()}}function Eh(t,n){return kh()(t,n)}function Ch(n,e,r,i){var o,a=w(n,e,r);switch((i=Ma(null==i?",f":i)).type){case"s":var u=Math.max(Math.abs(n),Math.abs(e));return null!=i.precision||isNaN(o=Ra(a,u))||(i.precision=o),t.formatPrefix(i,u);case"":case"e":case"g":case"p":case"r":null!=i.precision||isNaN(o=Da(a,Math.max(Math.abs(n),Math.abs(e))))||(i.precision=o-("e"===i.type));break;case"f":case"%":null!=i.precision||isNaN(o=za(a))||(i.precision=o-2*("%"===i.type))}return t.format(i)}function Ph(t){var n=t.domain;return t.ticks=function(t){var e=n();return m(e[0],e[e.length-1],null==t?10:t)},t.tickFormat=function(t,e){var r=n();return Ch(r[0],r[r.length-1],null==t?10:t,e)},t.nice=function(e){null==e&&(e=10);var r,i=n(),o=0,a=i.length-1,u=i[o],c=i[a];return c<u&&(r=u,u=c,c=r,r=o,o=a,a=r),(r=x(u,c,e))>0?r=x(u=Math.floor(u/r)*r,c=Math.ceil(c/r)*r,e):r<0&&(r=x(u=Math.ceil(u*r)/r,c=Math.floor(c*r)/r,e)),r>0?(i[o]=Math.floor(u/r)*r,i[a]=Math.ceil(c/r)*r,n(i)):r<0&&(i[o]=Math.ceil(u*r)/r,i[a]=Math.floor(c*r)/r,n(i)),t},t}function zh(t,n){var e,r=0,i=(t=t.slice()).length-1,o=t[r],a=t[i];return a<o&&(e=r,r=i,i=e,e=o,o=a,a=e),t[r]=n.floor(o),t[i]=n.ceil(a),t}function Rh(t){return Math.log(t)}function Dh(t){return Math.exp(t)}function qh(t){return-Math.log(-t)}function Lh(t){return-Math.exp(-t)}function Uh(t){return isFinite(t)?+("1e"+t):t<0?0:t}function Oh(t){return function(n){return-t(-n)}}function Bh(n){var e,r,i=n(Rh,Dh),o=i.domain,a=10;function u(){return e=function(t){return t===Math.E?Math.log:10===t&&Math.log10||2===t&&Math.log2||(t=Math.log(t),function(n){return Math.log(n)/t})}(a),r=function(t){return 10===t?Uh:t===Math.E?Math.exp:function(n){return Math.pow(t,n)}}(a),o()[0]<0?(e=Oh(e),r=Oh(r),n(qh,Lh)):n(Rh,Dh),i}return i.base=function(t){return arguments.length?(a=+t,u()):a},i.domain=function(t){return arguments.length?(o(t),u()):o()},i.ticks=function(t){var n,i=o(),u=i[0],c=i[i.length-1];(n=c<u)&&(h=u,u=c,c=h);var f,s,l,h=e(u),d=e(c),p=null==t?10:+t,v=[];if(!(a%1)&&d-h<p){if(h=Math.round(h)-1,d=Math.round(d)+1,u>0){for(;h<d;++h)for(s=1,f=r(h);s<a;++s)if(!((l=f*s)<u)){if(l>c)break;v.push(l)}}else for(;h<d;++h)for(s=a-1,f=r(h);s>=1;--s)if(!((l=f*s)<u)){if(l>c)break;v.push(l)}}else v=m(h,d,Math.min(d-h,p)).map(r);return n?v.reverse():v},i.tickFormat=function(n,o){if(null==o&&(o=10===a?".0e":","),"function"!=typeof o&&(o=t.format(o)),n===1/0)return o;null==n&&(n=10);var u=Math.max(1,a*n/i.ticks().length);return function(t){var n=t/r(Math.round(e(t)));return n*a<a-.5&&(n*=a),n<=u?o(t):""}},i.nice=function(){return o(zh(o(),{floor:function(t){return r(Math.floor(e(t)))},ceil:function(t){return r(Math.ceil(e(t)))}}))},i}function Yh(t){return function(n){return Math.sign(n)*Math.log1p(Math.abs(n/t))}}function Fh(t){return function(n){return Math.sign(n)*Math.expm1(Math.abs(n))*t}}function Ih(t){var n=1,e=t(Yh(n),Fh(n));return e.constant=function(e){return arguments.length?t(Yh(n=+e),Fh(n)):n},Ph(e)}function jh(t){return function(n){return n<0?-Math.pow(-n,t):Math.pow(n,t)}}function Hh(t){return t<0?-Math.sqrt(-t):Math.sqrt(t)}function Xh(t){return t<0?-t*t:t*t}function Gh(t){var n=t(wh,wh),e=1;return n.exponent=function(n){return arguments.length?1===(e=+n)?t(wh,wh):.5===e?t(Hh,Xh):t(jh(e),jh(1/e)):e},Ph(n)}function Vh(){var t=Gh(kh());return t.copy=function(){return Sh(t,Vh()).exponent(t.exponent())},hh.apply(t,arguments),t}var $h=new Date,Wh=new Date;function Zh(t,n,e,r){function i(n){return t(n=new Date(+n)),n}return i.floor=i,i.ceil=function(e){return t(e=new Date(e-1)),n(e,1),t(e),e},i.round=function(t){var n=i(t),e=i.ceil(t);return t-n<e-t?n:e},i.offset=function(t,e){return n(t=new Date(+t),null==e?1:Math.floor(e)),t},i.range=function(e,r,o){var a,u=[];if(e=i.ceil(e),o=null==o?1:Math.floor(o),!(e<r&&o>0))return u;do{u.push(a=new Date(+e)),n(e,o),t(e)}while(a<e&&e<r);return u},i.filter=function(e){return Zh(function(n){if(n>=n)for(;t(n),!e(n);)n.setTime(n-1)},function(t,r){if(t>=t)if(r<0)for(;++r<=0;)for(;n(t,-1),!e(t););else for(;--r>=0;)for(;n(t,1),!e(t););})},e&&(i.count=function(n,r){return $h.setTime(+n),Wh.setTime(+r),t($h),t(Wh),Math.floor(e($h,Wh))},i.every=function(t){return t=Math.floor(t),isFinite(t)&&t>0?t>1?i.filter(r?function(n){return r(n)%t==0}:function(n){return i.count(0,n)%t==0}):i:null}),i}var Qh=Zh(function(){},function(t,n){t.setTime(+t+n)},function(t,n){return n-t});Qh.every=function(t){return t=Math.floor(t),isFinite(t)&&t>0?t>1?Zh(function(n){n.setTime(Math.floor(n/t)*t)},function(n,e){n.setTime(+n+e*t)},function(n,e){return(e-n)/t}):Qh:null};var Jh=Qh.range,Kh=6e4,td=6048e5,nd=Zh(function(t){t.setTime(t-t.getMilliseconds())},function(t,n){t.setTime(+t+1e3*n)},function(t,n){return(n-t)/1e3},function(t){return t.getUTCSeconds()}),ed=nd.range,rd=Zh(function(t){t.setTime(t-t.getMilliseconds()-1e3*t.getSeconds())},function(t,n){t.setTime(+t+n*Kh)},function(t,n){return(n-t)/Kh},function(t){return t.getMinutes()}),id=rd.range,od=Zh(function(t){t.setTime(t-t.getMilliseconds()-1e3*t.getSeconds()-t.getMinutes()*Kh)},function(t,n){t.setTime(+t+36e5*n)},function(t,n){return(n-t)/36e5},function(t){return t.getHours()}),ad=od.range,ud=Zh(function(t){t.setHours(0,0,0,0)},function(t,n){t.setDate(t.getDate()+n)},function(t,n){return(n-t-(n.getTimezoneOffset()-t.getTimezoneOffset())*Kh)/864e5},function(t){return t.getDate()-1}),cd=ud.range;function fd(t){return Zh(function(n){n.setDate(n.getDate()-(n.getDay()+7-t)%7),n.setHours(0,0,0,0)},function(t,n){t.setDate(t.getDate()+7*n)},function(t,n){return(n-t-(n.getTimezoneOffset()-t.getTimezoneOffset())*Kh)/td})}var sd=fd(0),ld=fd(1),hd=fd(2),dd=fd(3),pd=fd(4),vd=fd(5),gd=fd(6),yd=sd.range,_d=ld.range,bd=hd.range,md=dd.range,xd=pd.range,wd=vd.range,Md=gd.range,Nd=Zh(function(t){t.setDate(1),t.setHours(0,0,0,0)},function(t,n){t.setMonth(t.getMonth()+n)},function(t,n){return n.getMonth()-t.getMonth()+12*(n.getFullYear()-t.getFullYear())},function(t){return t.getMonth()}),Ad=Nd.range,Td=Zh(function(t){t.setMonth(0,1),t.setHours(0,0,0,0)},function(t,n){t.setFullYear(t.getFullYear()+n)},function(t,n){return n.getFullYear()-t.getFullYear()},function(t){return t.getFullYear()});Td.every=function(t){return isFinite(t=Math.floor(t))&&t>0?Zh(function(n){n.setFullYear(Math.floor(n.getFullYear()/t)*t),n.setMonth(0,1),n.setHours(0,0,0,0)},function(n,e){n.setFullYear(n.getFullYear()+e*t)}):null};var Sd=Td.range,kd=Zh(function(t){t.setUTCSeconds(0,0)},function(t,n){t.setTime(+t+n*Kh)},function(t,n){return(n-t)/Kh},function(t){return t.getUTCMinutes()}),Ed=kd.range,Cd=Zh(function(t){t.setUTCMinutes(0,0,0)},function(t,n){t.setTime(+t+36e5*n)},function(t,n){return(n-t)/36e5},function(t){return t.getUTCHours()}),Pd=Cd.range,zd=Zh(function(t){t.setUTCHours(0,0,0,0)},function(t,n){t.setUTCDate(t.getUTCDate()+n)},function(t,n){return(n-t)/864e5},function(t){return t.getUTCDate()-1}),Rd=zd.range;function Dd(t){return Zh(function(n){n.setUTCDate(n.getUTCDate()-(n.getUTCDay()+7-t)%7),n.setUTCHours(0,0,0,0)},function(t,n){t.setUTCDate(t.getUTCDate()+7*n)},function(t,n){return(n-t)/td})}var qd=Dd(0),Ld=Dd(1),Ud=Dd(2),Od=Dd(3),Bd=Dd(4),Yd=Dd(5),Fd=Dd(6),Id=qd.range,jd=Ld.range,Hd=Ud.range,Xd=Od.range,Gd=Bd.range,Vd=Yd.range,$d=Fd.range,Wd=Zh(function(t){t.setUTCDate(1),t.setUTCHours(0,0,0,0)},function(t,n){t.setUTCMonth(t.getUTCMonth()+n)},function(t,n){return n.getUTCMonth()-t.getUTCMonth()+12*(n.getUTCFullYear()-t.getUTCFullYear())},function(t){return t.getUTCMonth()}),Zd=Wd.range,Qd=Zh(function(t){t.setUTCMonth(0,1),t.setUTCHours(0,0,0,0)},function(t,n){t.setUTCFullYear(t.getUTCFullYear()+n)},function(t,n){return n.getUTCFullYear()-t.getUTCFullYear()},function(t){return t.getUTCFullYear()});Qd.every=function(t){return isFinite(t=Math.floor(t))&&t>0?Zh(function(n){n.setUTCFullYear(Math.floor(n.getUTCFullYear()/t)*t),n.setUTCMonth(0,1),n.setUTCHours(0,0,0,0)},function(n,e){n.setUTCFullYear(n.getUTCFullYear()+e*t)}):null};var Jd=Qd.range;function Kd(t){if(0<=t.y&&t.y<100){var n=new Date(-1,t.m,t.d,t.H,t.M,t.S,t.L);return n.setFullYear(t.y),n}return new Date(t.y,t.m,t.d,t.H,t.M,t.S,t.L)}function tp(t){if(0<=t.y&&t.y<100){var n=new Date(Date.UTC(-1,t.m,t.d,t.H,t.M,t.S,t.L));return n.setUTCFullYear(t.y),n}return new Date(Date.UTC(t.y,t.m,t.d,t.H,t.M,t.S,t.L))}function np(t){return{y:t,m:0,d:1,H:0,M:0,S:0,L:0}}function ep(t){var n=t.dateTime,e=t.date,r=t.time,i=t.periods,o=t.days,a=t.shortDays,u=t.months,c=t.shortMonths,f=sp(i),s=lp(i),l=sp(o),h=lp(o),d=sp(a),p=lp(a),v=sp(u),g=lp(u),y=sp(c),_=lp(c),b={a:function(t){return a[t.getDay()]},A:function(t){return o[t.getDay()]},b:function(t){return c[t.getMonth()]},B:function(t){return u[t.getMonth()]},c:null,d:Pp,e:Pp,f:Lp,H:zp,I:Rp,j:Dp,L:qp,m:Up,M:Op,p:function(t){return i[+(t.getHours()>=12)]},Q:hv,s:dv,S:Bp,u:Yp,U:Fp,V:Ip,w:jp,W:Hp,x:null,X:null,y:Xp,Y:Gp,Z:Vp,"%":lv},m={a:function(t){return a[t.getUTCDay()]},A:function(t){return o[t.getUTCDay()]},b:function(t){return c[t.getUTCMonth()]},B:function(t){return u[t.getUTCMonth()]},c:null,d:$p,e:$p,f:Kp,H:Wp,I:Zp,j:Qp,L:Jp,m:tv,M:nv,p:function(t){return i[+(t.getUTCHours()>=12)]},Q:hv,s:dv,S:ev,u:rv,U:iv,V:ov,w:av,W:uv,x:null,X:null,y:cv,Y:fv,Z:sv,"%":lv},x={a:function(t,n,e){var r=d.exec(n.slice(e));return r?(t.w=p[r[0].toLowerCase()],e+r[0].length):-1},A:function(t,n,e){var r=l.exec(n.slice(e));return r?(t.w=h[r[0].toLowerCase()],e+r[0].length):-1},b:function(t,n,e){var r=y.exec(n.slice(e));return r?(t.m=_[r[0].toLowerCase()],e+r[0].length):-1},B:function(t,n,e){var r=v.exec(n.slice(e));return r?(t.m=g[r[0].toLowerCase()],e+r[0].length):-1},c:function(t,e,r){return N(t,n,e,r)},d:xp,e:xp,f:Sp,H:Mp,I:Mp,j:wp,L:Tp,m:mp,M:Np,p:function(t,n,e){var r=f.exec(n.slice(e));return r?(t.p=s[r[0].toLowerCase()],e+r[0].length):-1},Q:Ep,s:Cp,S:Ap,u:dp,U:pp,V:vp,w:hp,W:gp,x:function(t,n,r){return N(t,e,n,r)},X:function(t,n,e){return N(t,r,n,e)},y:_p,Y:yp,Z:bp,"%":kp};function w(t,n){return function(e){var r,i,o,a=[],u=-1,c=0,f=t.length;for(e instanceof Date||(e=new Date(+e));++u<f;)37===t.charCodeAt(u)&&(a.push(t.slice(c,u)),null!=(i=ip[r=t.charAt(++u)])?r=t.charAt(++u):i="e"===r?" ":"0",(o=n[r])&&(r=o(e,i)),a.push(r),c=u+1);return a.push(t.slice(c,u)),a.join("")}}function M(t,n){return function(e){var r,i,o=np(1900);if(N(o,t,e+="",0)!=e.length)return null;if("Q"in o)return new Date(o.Q);if("p"in o&&(o.H=o.H%12+12*o.p),"V"in o){if(o.V<1||o.V>53)return null;"w"in o||(o.w=1),"Z"in o?(i=(r=tp(np(o.y))).getUTCDay(),r=i>4||0===i?Ld.ceil(r):Ld(r),r=zd.offset(r,7*(o.V-1)),o.y=r.getUTCFullYear(),o.m=r.getUTCMonth(),o.d=r.getUTCDate()+(o.w+6)%7):(i=(r=n(np(o.y))).getDay(),r=i>4||0===i?ld.ceil(r):ld(r),r=ud.offset(r,7*(o.V-1)),o.y=r.getFullYear(),o.m=r.getMonth(),o.d=r.getDate()+(o.w+6)%7)}else("W"in o||"U"in o)&&("w"in o||(o.w="u"in o?o.u%7:"W"in o?1:0),i="Z"in o?tp(np(o.y)).getUTCDay():n(np(o.y)).getDay(),o.m=0,o.d="W"in o?(o.w+6)%7+7*o.W-(i+5)%7:o.w+7*o.U-(i+6)%7);return"Z"in o?(o.H+=o.Z/100|0,o.M+=o.Z%100,tp(o)):n(o)}}function N(t,n,e,r){for(var i,o,a=0,u=n.length,c=e.length;a<u;){if(r>=c)return-1;if(37===(i=n.charCodeAt(a++))){if(i=n.charAt(a++),!(o=x[i in ip?n.charAt(a++):i])||(r=o(t,e,r))<0)return-1}else if(i!=e.charCodeAt(r++))return-1}return r}return b.x=w(e,b),b.X=w(r,b),b.c=w(n,b),m.x=w(e,m),m.X=w(r,m),m.c=w(n,m),{format:function(t){var n=w(t+="",b);return n.toString=function(){return t},n},parse:function(t){var n=M(t+="",Kd);return n.toString=function(){return t},n},utcFormat:function(t){var n=w(t+="",m);return n.toString=function(){return t},n},utcParse:function(t){var n=M(t,tp);return n.toString=function(){return t},n}}}var rp,ip={"-":"",_:" ",0:"0"},op=/^\s*\d+/,ap=/^%/,up=/[\\^$*+?|[\]().{}]/g;function cp(t,n,e){var r=t<0?"-":"",i=(r?-t:t)+"",o=i.length;return r+(o<e?new Array(e-o+1).join(n)+i:i)}function fp(t){return t.replace(up,"\\$&")}function sp(t){return new RegExp("^(?:"+t.map(fp).join("|")+")","i")}function lp(t){for(var n={},e=-1,r=t.length;++e<r;)n[t[e].toLowerCase()]=e;return n}function hp(t,n,e){var r=op.exec(n.slice(e,e+1));return r?(t.w=+r[0],e+r[0].length):-1}function dp(t,n,e){var r=op.exec(n.slice(e,e+1));return r?(t.u=+r[0],e+r[0].length):-1}function pp(t,n,e){var r=op.exec(n.slice(e,e+2));return r?(t.U=+r[0],e+r[0].length):-1}function vp(t,n,e){var r=op.exec(n.slice(e,e+2));return r?(t.V=+r[0],e+r[0].length):-1}function gp(t,n,e){var r=op.exec(n.slice(e,e+2));return r?(t.W=+r[0],e+r[0].length):-1}function yp(t,n,e){var r=op.exec(n.slice(e,e+4));return r?(t.y=+r[0],e+r[0].length):-1}function _p(t,n,e){var r=op.exec(n.slice(e,e+2));return r?(t.y=+r[0]+(+r[0]>68?1900:2e3),e+r[0].length):-1}function bp(t,n,e){var r=/^(Z)|([+-]\d\d)(?::?(\d\d))?/.exec(n.slice(e,e+6));return r?(t.Z=r[1]?0:-(r[2]+(r[3]||"00")),e+r[0].length):-1}function mp(t,n,e){var r=op.exec(n.slice(e,e+2));return r?(t.m=r[0]-1,e+r[0].length):-1}function xp(t,n,e){var r=op.exec(n.slice(e,e+2));return r?(t.d=+r[0],e+r[0].length):-1}function wp(t,n,e){var r=op.exec(n.slice(e,e+3));return r?(t.m=0,t.d=+r[0],e+r[0].length):-1}function Mp(t,n,e){var r=op.exec(n.slice(e,e+2));return r?(t.H=+r[0],e+r[0].length):-1}function Np(t,n,e){var r=op.exec(n.slice(e,e+2));return r?(t.M=+r[0],e+r[0].length):-1}function Ap(t,n,e){var r=op.exec(n.slice(e,e+2));return r?(t.S=+r[0],e+r[0].length):-1}function Tp(t,n,e){var r=op.exec(n.slice(e,e+3));return r?(t.L=+r[0],e+r[0].length):-1}function Sp(t,n,e){var r=op.exec(n.slice(e,e+6));return r?(t.L=Math.floor(r[0]/1e3),e+r[0].length):-1}function kp(t,n,e){var r=ap.exec(n.slice(e,e+1));return r?e+r[0].length:-1}function Ep(t,n,e){var r=op.exec(n.slice(e));return r?(t.Q=+r[0],e+r[0].length):-1}function Cp(t,n,e){var r=op.exec(n.slice(e));return r?(t.Q=1e3*+r[0],e+r[0].length):-1}function Pp(t,n){return cp(t.getDate(),n,2)}function zp(t,n){return cp(t.getHours(),n,2)}function Rp(t,n){return cp(t.getHours()%12||12,n,2)}function Dp(t,n){return cp(1+ud.count(Td(t),t),n,3)}function qp(t,n){return cp(t.getMilliseconds(),n,3)}function Lp(t,n){return qp(t,n)+"000"}function Up(t,n){return cp(t.getMonth()+1,n,2)}function Op(t,n){return cp(t.getMinutes(),n,2)}function Bp(t,n){return cp(t.getSeconds(),n,2)}function Yp(t){var n=t.getDay();return 0===n?7:n}function Fp(t,n){return cp(sd.count(Td(t),t),n,2)}function Ip(t,n){var e=t.getDay();return t=e>=4||0===e?pd(t):pd.ceil(t),cp(pd.count(Td(t),t)+(4===Td(t).getDay()),n,2)}function jp(t){return t.getDay()}function Hp(t,n){return cp(ld.count(Td(t),t),n,2)}function Xp(t,n){return cp(t.getFullYear()%100,n,2)}function Gp(t,n){return cp(t.getFullYear()%1e4,n,4)}function Vp(t){var n=t.getTimezoneOffset();return(n>0?"-":(n*=-1,"+"))+cp(n/60|0,"0",2)+cp(n%60,"0",2)}function $p(t,n){return cp(t.getUTCDate(),n,2)}function Wp(t,n){return cp(t.getUTCHours(),n,2)}function Zp(t,n){return cp(t.getUTCHours()%12||12,n,2)}function Qp(t,n){return cp(1+zd.count(Qd(t),t),n,3)}function Jp(t,n){return cp(t.getUTCMilliseconds(),n,3)}function Kp(t,n){return Jp(t,n)+"000"}function tv(t,n){return cp(t.getUTCMonth()+1,n,2)}function nv(t,n){return cp(t.getUTCMinutes(),n,2)}function ev(t,n){return cp(t.getUTCSeconds(),n,2)}function rv(t){var n=t.getUTCDay();return 0===n?7:n}function iv(t,n){return cp(qd.count(Qd(t),t),n,2)}function ov(t,n){var e=t.getUTCDay();return t=e>=4||0===e?Bd(t):Bd.ceil(t),cp(Bd.count(Qd(t),t)+(4===Qd(t).getUTCDay()),n,2)}function av(t){return t.getUTCDay()}function uv(t,n){return cp(Ld.count(Qd(t),t),n,2)}function cv(t,n){return cp(t.getUTCFullYear()%100,n,2)}function fv(t,n){return cp(t.getUTCFullYear()%1e4,n,4)}function sv(){return"+0000"}function lv(){return"%"}function hv(t){return+t}function dv(t){return Math.floor(+t/1e3)}function pv(n){return rp=ep(n),t.timeFormat=rp.format,t.timeParse=rp.parse,t.utcFormat=rp.utcFormat,t.utcParse=rp.utcParse,rp}pv({dateTime:"%x, %X",date:"%-m/%-d/%Y",time:"%-I:%M:%S %p",periods:["AM","PM"],days:["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],shortDays:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],months:["January","February","March","April","May","June","July","August","September","October","November","December"],shortMonths:["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]});var vv=Date.prototype.toISOString?function(t){return t.toISOString()}:t.utcFormat("%Y-%m-%dT%H:%M:%S.%LZ");var gv=+new Date("2000-01-01T00:00:00.000Z")?function(t){var n=new Date(t);return isNaN(n)?null:n}:t.utcParse("%Y-%m-%dT%H:%M:%S.%LZ"),yv=1e3,_v=60*yv,bv=60*_v,mv=24*bv,xv=7*mv,wv=30*mv,Mv=365*mv;function Nv(t){return new Date(t)}function Av(t){return t instanceof Date?+t:+new Date(+t)}function Tv(t,n,r,i,o,a,u,c,f){var s=Eh(wh,wh),l=s.invert,h=s.domain,d=f(".%L"),p=f(":%S"),v=f("%I:%M"),g=f("%I %p"),y=f("%a %d"),_=f("%b %d"),b=f("%B"),m=f("%Y"),x=[[u,1,yv],[u,5,5*yv],[u,15,15*yv],[u,30,30*yv],[a,1,_v],[a,5,5*_v],[a,15,15*_v],[a,30,30*_v],[o,1,bv],[o,3,3*bv],[o,6,6*bv],[o,12,12*bv],[i,1,mv],[i,2,2*mv],[r,1,xv],[n,1,wv],[n,3,3*wv],[t,1,Mv]];function M(e){return(u(e)<e?d:a(e)<e?p:o(e)<e?v:i(e)<e?g:n(e)<e?r(e)<e?y:_:t(e)<e?b:m)(e)}function N(n,r,i,o){if(null==n&&(n=10),"number"==typeof n){var a=Math.abs(i-r)/n,u=e(function(t){return t[2]}).right(x,a);u===x.length?(o=w(r/Mv,i/Mv,n),n=t):u?(o=(u=x[a/x[u-1][2]<x[u][2]/a?u-1:u])[1],n=u[0]):(o=Math.max(w(r,i,n),1),n=c)}return null==o?n:n.every(o)}return s.invert=function(t){return new Date(l(t))},s.domain=function(t){return arguments.length?h(vh.call(t,Av)):h().map(Nv)},s.ticks=function(t,n){var e,r=h(),i=r[0],o=r[r.length-1],a=o<i;return a&&(e=i,i=o,o=e),e=(e=N(t,i,o,n))?e.range(i,o+1):[],a?e.reverse():e},s.tickFormat=function(t,n){return null==n?M:f(n)},s.nice=function(t,n){var e=h();return(t=N(t,e[0],e[e.length-1],n))?h(zh(e,t)):s},s.copy=function(){return Sh(s,Tv(t,n,r,i,o,a,u,c,f))},s}function Sv(){var t,n,e,r,i,o=0,a=1,u=wh,c=!1;function f(n){return isNaN(n=+n)?i:u(0===e?.5:(n=(r(n)-t)*e,c?Math.max(0,Math.min(1,n)):n))}return f.domain=function(i){return arguments.length?(t=r(o=+i[0]),n=r(a=+i[1]),e=t===n?0:1/(n-t),f):[o,a]},f.clamp=function(t){return arguments.length?(c=!!t,f):c},f.interpolator=function(t){return arguments.length?(u=t,f):u},f.unknown=function(t){return arguments.length?(i=t,f):i},function(i){return r=i,t=i(o),n=i(a),e=t===n?0:1/(n-t),f}}function kv(t,n){return n.domain(t.domain()).interpolator(t.interpolator()).clamp(t.clamp()).unknown(t.unknown())}function Ev(){var t=Gh(Sv());return t.copy=function(){return kv(t,Ev()).exponent(t.exponent())},dh.apply(t,arguments)}function Cv(){var t,n,e,r,i,o,a,u=0,c=.5,f=1,s=wh,l=!1;function h(t){return isNaN(t=+t)?a:(t=.5+((t=+o(t))-n)*(t<n?r:i),s(l?Math.max(0,Math.min(1,t)):t))}return h.domain=function(a){return arguments.length?(t=o(u=+a[0]),n=o(c=+a[1]),e=o(f=+a[2]),r=t===n?0:.5/(n-t),i=n===e?0:.5/(e-n),h):[u,c,f]},h.clamp=function(t){return arguments.length?(l=!!t,h):l},h.interpolator=function(t){return arguments.length?(s=t,h):s},h.unknown=function(t){return arguments.length?(a=t,h):a},function(a){return o=a,t=a(u),n=a(c),e=a(f),r=t===n?0:.5/(n-t),i=n===e?0:.5/(e-n),h}}function Pv(){var t=Gh(Cv());return t.copy=function(){return kv(t,Pv()).exponent(t.exponent())},dh.apply(t,arguments)}function zv(t){for(var n=t.length/6|0,e=new Array(n),r=0;r<n;)e[r]="#"+t.slice(6*r,6*++r);return e}var Rv=zv("1f77b4ff7f0e2ca02cd627289467bd8c564be377c27f7f7fbcbd2217becf"),Dv=zv("7fc97fbeaed4fdc086ffff99386cb0f0027fbf5b17666666"),qv=zv("1b9e77d95f027570b3e7298a66a61ee6ab02a6761d666666"),Lv=zv("a6cee31f78b4b2df8a33a02cfb9a99e31a1cfdbf6fff7f00cab2d66a3d9affff99b15928"),Uv=zv("fbb4aeb3cde3ccebc5decbe4fed9a6ffffcce5d8bdfddaecf2f2f2"),Ov=zv("b3e2cdfdcdaccbd5e8f4cae4e6f5c9fff2aef1e2cccccccc"),Bv=zv("e41a1c377eb84daf4a984ea3ff7f00ffff33a65628f781bf999999"),Yv=zv("66c2a5fc8d628da0cbe78ac3a6d854ffd92fe5c494b3b3b3"),Fv=zv("8dd3c7ffffb3bebadafb807280b1d3fdb462b3de69fccde5d9d9d9bc80bdccebc5ffed6f");function Iv(t){return fe(t[t.length-1])}var jv=new Array(3).concat("d8b365f5f5f55ab4ac","a6611adfc27d80cdc1018571","a6611adfc27df5f5f580cdc1018571","8c510ad8b365f6e8c3c7eae55ab4ac01665e","8c510ad8b365f6e8c3f5f5f5c7eae55ab4ac01665e","8c510abf812ddfc27df6e8c3c7eae580cdc135978f01665e","8c510abf812ddfc27df6e8c3f5f5f5c7eae580cdc135978f01665e","5430058c510abf812ddfc27df6e8c3c7eae580cdc135978f01665e003c30","5430058c510abf812ddfc27df6e8c3f5f5f5c7eae580cdc135978f01665e003c30").map(zv),Hv=Iv(jv),Xv=new Array(3).concat("af8dc3f7f7f77fbf7b","7b3294c2a5cfa6dba0008837","7b3294c2a5cff7f7f7a6dba0008837","762a83af8dc3e7d4e8d9f0d37fbf7b1b7837","762a83af8dc3e7d4e8f7f7f7d9f0d37fbf7b1b7837","762a839970abc2a5cfe7d4e8d9f0d3a6dba05aae611b7837","762a839970abc2a5cfe7d4e8f7f7f7d9f0d3a6dba05aae611b7837","40004b762a839970abc2a5cfe7d4e8d9f0d3a6dba05aae611b783700441b","40004b762a839970abc2a5cfe7d4e8f7f7f7d9f0d3a6dba05aae611b783700441b").map(zv),Gv=Iv(Xv),Vv=new Array(3).concat("e9a3c9f7f7f7a1d76a","d01c8bf1b6dab8e1864dac26","d01c8bf1b6daf7f7f7b8e1864dac26","c51b7de9a3c9fde0efe6f5d0a1d76a4d9221","c51b7de9a3c9fde0eff7f7f7e6f5d0a1d76a4d9221","c51b7dde77aef1b6dafde0efe6f5d0b8e1867fbc414d9221","c51b7dde77aef1b6dafde0eff7f7f7e6f5d0b8e1867fbc414d9221","8e0152c51b7dde77aef1b6dafde0efe6f5d0b8e1867fbc414d9221276419","8e0152c51b7dde77aef1b6dafde0eff7f7f7e6f5d0b8e1867fbc414d9221276419").map(zv),$v=Iv(Vv),Wv=new Array(3).concat("998ec3f7f7f7f1a340","5e3c99b2abd2fdb863e66101","5e3c99b2abd2f7f7f7fdb863e66101","542788998ec3d8daebfee0b6f1a340b35806","542788998ec3d8daebf7f7f7fee0b6f1a340b35806","5427888073acb2abd2d8daebfee0b6fdb863e08214b35806","5427888073acb2abd2d8daebf7f7f7fee0b6fdb863e08214b35806","2d004b5427888073acb2abd2d8daebfee0b6fdb863e08214b358067f3b08","2d004b5427888073acb2abd2d8daebf7f7f7fee0b6fdb863e08214b358067f3b08").map(zv),Zv=Iv(Wv),Qv=new Array(3).concat("ef8a62f7f7f767a9cf","ca0020f4a58292c5de0571b0","ca0020f4a582f7f7f792c5de0571b0","b2182bef8a62fddbc7d1e5f067a9cf2166ac","b2182bef8a62fddbc7f7f7f7d1e5f067a9cf2166ac","b2182bd6604df4a582fddbc7d1e5f092c5de4393c32166ac","b2182bd6604df4a582fddbc7f7f7f7d1e5f092c5de4393c32166ac","67001fb2182bd6604df4a582fddbc7d1e5f092c5de4393c32166ac053061","67001fb2182bd6604df4a582fddbc7f7f7f7d1e5f092c5de4393c32166ac053061").map(zv),Jv=Iv(Qv),Kv=new Array(3).concat("ef8a62ffffff999999","ca0020f4a582bababa404040","ca0020f4a582ffffffbababa404040","b2182bef8a62fddbc7e0e0e09999994d4d4d","b2182bef8a62fddbc7ffffffe0e0e09999994d4d4d","b2182bd6604df4a582fddbc7e0e0e0bababa8787874d4d4d","b2182bd6604df4a582fddbc7ffffffe0e0e0bababa8787874d4d4d","67001fb2182bd6604df4a582fddbc7e0e0e0bababa8787874d4d4d1a1a1a","67001fb2182bd6604df4a582fddbc7ffffffe0e0e0bababa8787874d4d4d1a1a1a").map(zv),tg=Iv(Kv),ng=new Array(3).concat("fc8d59ffffbf91bfdb","d7191cfdae61abd9e92c7bb6","d7191cfdae61ffffbfabd9e92c7bb6","d73027fc8d59fee090e0f3f891bfdb4575b4","d73027fc8d59fee090ffffbfe0f3f891bfdb4575b4","d73027f46d43fdae61fee090e0f3f8abd9e974add14575b4","d73027f46d43fdae61fee090ffffbfe0f3f8abd9e974add14575b4","a50026d73027f46d43fdae61fee090e0f3f8abd9e974add14575b4313695","a50026d73027f46d43fdae61fee090ffffbfe0f3f8abd9e974add14575b4313695").map(zv),eg=Iv(ng),rg=new Array(3).concat("fc8d59ffffbf91cf60","d7191cfdae61a6d96a1a9641","d7191cfdae61ffffbfa6d96a1a9641","d73027fc8d59fee08bd9ef8b91cf601a9850","d73027fc8d59fee08bffffbfd9ef8b91cf601a9850","d73027f46d43fdae61fee08bd9ef8ba6d96a66bd631a9850","d73027f46d43fdae61fee08bffffbfd9ef8ba6d96a66bd631a9850","a50026d73027f46d43fdae61fee08bd9ef8ba6d96a66bd631a9850006837","a50026d73027f46d43fdae61fee08bffffbfd9ef8ba6d96a66bd631a9850006837").map(zv),ig=Iv(rg),og=new Array(3).concat("fc8d59ffffbf99d594","d7191cfdae61abdda42b83ba","d7191cfdae61ffffbfabdda42b83ba","d53e4ffc8d59fee08be6f59899d5943288bd","d53e4ffc8d59fee08bffffbfe6f59899d5943288bd","d53e4ff46d43fdae61fee08be6f598abdda466c2a53288bd","d53e4ff46d43fdae61fee08bffffbfe6f598abdda466c2a53288bd","9e0142d53e4ff46d43fdae61fee08be6f598abdda466c2a53288bd5e4fa2","9e0142d53e4ff46d43fdae61fee08bffffbfe6f598abdda466c2a53288bd5e4fa2").map(zv),ag=Iv(og),ug=new Array(3).concat("e5f5f999d8c92ca25f","edf8fbb2e2e266c2a4238b45","edf8fbb2e2e266c2a42ca25f006d2c","edf8fbccece699d8c966c2a42ca25f006d2c","edf8fbccece699d8c966c2a441ae76238b45005824","f7fcfde5f5f9ccece699d8c966c2a441ae76238b45005824","f7fcfde5f5f9ccece699d8c966c2a441ae76238b45006d2c00441b").map(zv),cg=Iv(ug),fg=new Array(3).concat("e0ecf49ebcda8856a7","edf8fbb3cde38c96c688419d","edf8fbb3cde38c96c68856a7810f7c","edf8fbbfd3e69ebcda8c96c68856a7810f7c","edf8fbbfd3e69ebcda8c96c68c6bb188419d6e016b","f7fcfde0ecf4bfd3e69ebcda8c96c68c6bb188419d6e016b","f7fcfde0ecf4bfd3e69ebcda8c96c68c6bb188419d810f7c4d004b").map(zv),sg=Iv(fg),lg=new Array(3).concat("e0f3dba8ddb543a2ca","f0f9e8bae4bc7bccc42b8cbe","f0f9e8bae4bc7bccc443a2ca0868ac","f0f9e8ccebc5a8ddb57bccc443a2ca0868ac","f0f9e8ccebc5a8ddb57bccc44eb3d32b8cbe08589e","f7fcf0e0f3dbccebc5a8ddb57bccc44eb3d32b8cbe08589e","f7fcf0e0f3dbccebc5a8ddb57bccc44eb3d32b8cbe0868ac084081").map(zv),hg=Iv(lg),dg=new Array(3).concat("fee8c8fdbb84e34a33","fef0d9fdcc8afc8d59d7301f","fef0d9fdcc8afc8d59e34a33b30000","fef0d9fdd49efdbb84fc8d59e34a33b30000","fef0d9fdd49efdbb84fc8d59ef6548d7301f990000","fff7ecfee8c8fdd49efdbb84fc8d59ef6548d7301f990000","fff7ecfee8c8fdd49efdbb84fc8d59ef6548d7301fb300007f0000").map(zv),pg=Iv(dg),vg=new Array(3).concat("ece2f0a6bddb1c9099","f6eff7bdc9e167a9cf02818a","f6eff7bdc9e167a9cf1c9099016c59","f6eff7d0d1e6a6bddb67a9cf1c9099016c59","f6eff7d0d1e6a6bddb67a9cf3690c002818a016450","fff7fbece2f0d0d1e6a6bddb67a9cf3690c002818a016450","fff7fbece2f0d0d1e6a6bddb67a9cf3690c002818a016c59014636").map(zv),gg=Iv(vg),yg=new Array(3).concat("ece7f2a6bddb2b8cbe","f1eef6bdc9e174a9cf0570b0","f1eef6bdc9e174a9cf2b8cbe045a8d","f1eef6d0d1e6a6bddb74a9cf2b8cbe045a8d","f1eef6d0d1e6a6bddb74a9cf3690c00570b0034e7b","fff7fbece7f2d0d1e6a6bddb74a9cf3690c00570b0034e7b","fff7fbece7f2d0d1e6a6bddb74a9cf3690c00570b0045a8d023858").map(zv),_g=Iv(yg),bg=new Array(3).concat("e7e1efc994c7dd1c77","f1eef6d7b5d8df65b0ce1256","f1eef6d7b5d8df65b0dd1c77980043","f1eef6d4b9dac994c7df65b0dd1c77980043","f1eef6d4b9dac994c7df65b0e7298ace125691003f","f7f4f9e7e1efd4b9dac994c7df65b0e7298ace125691003f","f7f4f9e7e1efd4b9dac994c7df65b0e7298ace125698004367001f").map(zv),mg=Iv(bg),xg=new Array(3).concat("fde0ddfa9fb5c51b8a","feebe2fbb4b9f768a1ae017e","feebe2fbb4b9f768a1c51b8a7a0177","feebe2fcc5c0fa9fb5f768a1c51b8a7a0177","feebe2fcc5c0fa9fb5f768a1dd3497ae017e7a0177","fff7f3fde0ddfcc5c0fa9fb5f768a1dd3497ae017e7a0177","fff7f3fde0ddfcc5c0fa9fb5f768a1dd3497ae017e7a017749006a").map(zv),wg=Iv(xg),Mg=new Array(3).concat("edf8b17fcdbb2c7fb8","ffffcca1dab441b6c4225ea8","ffffcca1dab441b6c42c7fb8253494","ffffccc7e9b47fcdbb41b6c42c7fb8253494","ffffccc7e9b47fcdbb41b6c41d91c0225ea80c2c84","ffffd9edf8b1c7e9b47fcdbb41b6c41d91c0225ea80c2c84","ffffd9edf8b1c7e9b47fcdbb41b6c41d91c0225ea8253494081d58").map(zv),Ng=Iv(Mg),Ag=new Array(3).concat("f7fcb9addd8e31a354","ffffccc2e69978c679238443","ffffccc2e69978c67931a354006837","ffffccd9f0a3addd8e78c67931a354006837","ffffccd9f0a3addd8e78c67941ab5d238443005a32","ffffe5f7fcb9d9f0a3addd8e78c67941ab5d238443005a32","ffffe5f7fcb9d9f0a3addd8e78c67941ab5d238443006837004529").map(zv),Tg=Iv(Ag),Sg=new Array(3).concat("fff7bcfec44fd95f0e","ffffd4fed98efe9929cc4c02","ffffd4fed98efe9929d95f0e993404","ffffd4fee391fec44ffe9929d95f0e993404","ffffd4fee391fec44ffe9929ec7014cc4c028c2d04","ffffe5fff7bcfee391fec44ffe9929ec7014cc4c028c2d04","ffffe5fff7bcfee391fec44ffe9929ec7014cc4c02993404662506").map(zv),kg=Iv(Sg),Eg=new Array(3).concat("ffeda0feb24cf03b20","ffffb2fecc5cfd8d3ce31a1c","ffffb2fecc5cfd8d3cf03b20bd0026","ffffb2fed976feb24cfd8d3cf03b20bd0026","ffffb2fed976feb24cfd8d3cfc4e2ae31a1cb10026","ffffccffeda0fed976feb24cfd8d3cfc4e2ae31a1cb10026","ffffccffeda0fed976feb24cfd8d3cfc4e2ae31a1cbd0026800026").map(zv),Cg=Iv(Eg),Pg=new Array(3).concat("deebf79ecae13182bd","eff3ffbdd7e76baed62171b5","eff3ffbdd7e76baed63182bd08519c","eff3ffc6dbef9ecae16baed63182bd08519c","eff3ffc6dbef9ecae16baed64292c62171b5084594","f7fbffdeebf7c6dbef9ecae16baed64292c62171b5084594","f7fbffdeebf7c6dbef9ecae16baed64292c62171b508519c08306b").map(zv),zg=Iv(Pg),Rg=new Array(3).concat("e5f5e0a1d99b31a354","edf8e9bae4b374c476238b45","edf8e9bae4b374c47631a354006d2c","edf8e9c7e9c0a1d99b74c47631a354006d2c","edf8e9c7e9c0a1d99b74c47641ab5d238b45005a32","f7fcf5e5f5e0c7e9c0a1d99b74c47641ab5d238b45005a32","f7fcf5e5f5e0c7e9c0a1d99b74c47641ab5d238b45006d2c00441b").map(zv),Dg=Iv(Rg),qg=new Array(3).concat("f0f0f0bdbdbd636363","f7f7f7cccccc969696525252","f7f7f7cccccc969696636363252525","f7f7f7d9d9d9bdbdbd969696636363252525","f7f7f7d9d9d9bdbdbd969696737373525252252525","fffffff0f0f0d9d9d9bdbdbd969696737373525252252525","fffffff0f0f0d9d9d9bdbdbd969696737373525252252525000000").map(zv),Lg=Iv(qg),Ug=new Array(3).concat("efedf5bcbddc756bb1","f2f0f7cbc9e29e9ac86a51a3","f2f0f7cbc9e29e9ac8756bb154278f","f2f0f7dadaebbcbddc9e9ac8756bb154278f","f2f0f7dadaebbcbddc9e9ac8807dba6a51a34a1486","fcfbfdefedf5dadaebbcbddc9e9ac8807dba6a51a34a1486","fcfbfdefedf5dadaebbcbddc9e9ac8807dba6a51a354278f3f007d").map(zv),Og=Iv(Ug),Bg=new Array(3).concat("fee0d2fc9272de2d26","fee5d9fcae91fb6a4acb181d","fee5d9fcae91fb6a4ade2d26a50f15","fee5d9fcbba1fc9272fb6a4ade2d26a50f15","fee5d9fcbba1fc9272fb6a4aef3b2ccb181d99000d","fff5f0fee0d2fcbba1fc9272fb6a4aef3b2ccb181d99000d","fff5f0fee0d2fcbba1fc9272fb6a4aef3b2ccb181da50f1567000d").map(zv),Yg=Iv(Bg),Fg=new Array(3).concat("fee6cefdae6be6550d","feeddefdbe85fd8d3cd94701","feeddefdbe85fd8d3ce6550da63603","feeddefdd0a2fdae6bfd8d3ce6550da63603","feeddefdd0a2fdae6bfd8d3cf16913d948018c2d04","fff5ebfee6cefdd0a2fdae6bfd8d3cf16913d948018c2d04","fff5ebfee6cefdd0a2fdae6bfd8d3cf16913d94801a636037f2704").map(zv),Ig=Iv(Fg),jg=He(Qn(300,.5,0),Qn(-240,.5,1)),Hg=He(Qn(-100,.75,.35),Qn(80,1.5,.8)),Xg=He(Qn(260,.75,.35),Qn(80,1.5,.8)),Gg=Qn();var Vg=gn(),$g=Math.PI/3,Wg=2*Math.PI/3;function Zg(t){var n=t.length;return function(e){return t[Math.max(0,Math.min(n-1,Math.floor(e*n)))]}}var Qg=Zg(zv("44015444025645045745055946075a46085c460a5d460b5e470d60470e6147106347116447136548146748166848176948186a481a6c481b6d481c6e481d6f481f70482071482173482374482475482576482677482878482979472a7a472c7a472d7b472e7c472f7d46307e46327e46337f463480453581453781453882443983443a83443b84433d84433e85423f854240864241864142874144874045884046883f47883f48893e49893e4a893e4c8a3d4d8a3d4e8a3c4f8a3c508b3b518b3b528b3a538b3a548c39558c39568c38588c38598c375a8c375b8d365c8d365d8d355e8d355f8d34608d34618d33628d33638d32648e32658e31668e31678e31688e30698e306a8e2f6b8e2f6c8e2e6d8e2e6e8e2e6f8e2d708e2d718e2c718e2c728e2c738e2b748e2b758e2a768e2a778e2a788e29798e297a8e297b8e287c8e287d8e277e8e277f8e27808e26818e26828e26828e25838e25848e25858e24868e24878e23888e23898e238a8d228b8d228c8d228d8d218e8d218f8d21908d21918c20928c20928c20938c1f948c1f958b1f968b1f978b1f988b1f998a1f9a8a1e9b8a1e9c891e9d891f9e891f9f881fa0881fa1881fa1871fa28720a38620a48621a58521a68522a78522a88423a98324aa8325ab8225ac8226ad8127ad8128ae8029af7f2ab07f2cb17e2db27d2eb37c2fb47c31b57b32b67a34b67935b77937b87838b9773aba763bbb753dbc743fbc7340bd7242be7144bf7046c06f48c16e4ac16d4cc26c4ec36b50c46a52c56954c56856c66758c7655ac8645cc8635ec96260ca6063cb5f65cb5e67cc5c69cd5b6ccd5a6ece5870cf5773d05675d05477d1537ad1517cd2507fd34e81d34d84d44b86d54989d5488bd6468ed64590d74393d74195d84098d83e9bd93c9dd93ba0da39a2da37a5db36a8db34aadc32addc30b0dd2fb2dd2db5de2bb8de29bade28bddf26c0df25c2df23c5e021c8e020cae11fcde11dd0e11cd2e21bd5e21ad8e219dae319dde318dfe318e2e418e5e419e7e419eae51aece51befe51cf1e51df4e61ef6e620f8e621fbe723fde725")),Jg=Zg(zv("00000401000501010601010802010902020b02020d03030f03031204041405041606051806051a07061c08071e0907200a08220b09240c09260d0a290e0b2b100b2d110c2f120d31130d34140e36150e38160f3b180f3d19103f1a10421c10441d11471e114920114b21114e22115024125325125527125829115a2a115c2c115f2d11612f116331116533106734106936106b38106c390f6e3b0f703d0f713f0f72400f74420f75440f764510774710784910784a10794c117a4e117b4f127b51127c52137c54137d56147d57157e59157e5a167e5c167f5d177f5f187f601880621980641a80651a80671b80681c816a1c816b1d816d1d816e1e81701f81721f817320817521817621817822817922827b23827c23827e24828025828125818326818426818627818827818928818b29818c29818e2a81902a81912b81932b80942c80962c80982d80992d809b2e7f9c2e7f9e2f7fa02f7fa1307ea3307ea5317ea6317da8327daa337dab337cad347cae347bb0357bb2357bb3367ab5367ab73779b83779ba3878bc3978bd3977bf3a77c03a76c23b75c43c75c53c74c73d73c83e73ca3e72cc3f71cd4071cf4070d0416fd2426fd3436ed5446dd6456cd8456cd9466bdb476adc4869de4968df4a68e04c67e24d66e34e65e44f64e55064e75263e85362e95462ea5661eb5760ec5860ed5a5fee5b5eef5d5ef05f5ef1605df2625df2645cf3655cf4675cf4695cf56b5cf66c5cf66e5cf7705cf7725cf8745cf8765cf9785df9795df97b5dfa7d5efa7f5efa815ffb835ffb8560fb8761fc8961fc8a62fc8c63fc8e64fc9065fd9266fd9467fd9668fd9869fd9a6afd9b6bfe9d6cfe9f6dfea16efea36ffea571fea772fea973feaa74feac76feae77feb078feb27afeb47bfeb67cfeb77efeb97ffebb81febd82febf84fec185fec287fec488fec68afec88cfeca8dfecc8ffecd90fecf92fed194fed395fed597fed799fed89afdda9cfddc9efddea0fde0a1fde2a3fde3a5fde5a7fde7a9fde9aafdebacfcecaefceeb0fcf0b2fcf2b4fcf4b6fcf6b8fcf7b9fcf9bbfcfbbdfcfdbf")),Kg=Zg(zv("00000401000501010601010802010a02020c02020e03021004031204031405041706041907051b08051d09061f0a07220b07240c08260d08290e092b10092d110a30120a32140b34150b37160b39180c3c190c3e1b0c411c0c431e0c451f0c48210c4a230c4c240c4f260c51280b53290b552b0b572d0b592f0a5b310a5c320a5e340a5f3609613809623909633b09643d09653e0966400a67420a68440a68450a69470b6a490b6a4a0c6b4c0c6b4d0d6c4f0d6c510e6c520e6d540f6d550f6d57106e59106e5a116e5c126e5d126e5f136e61136e62146e64156e65156e67166e69166e6a176e6c186e6d186e6f196e71196e721a6e741a6e751b6e771c6d781c6d7a1d6d7c1d6d7d1e6d7f1e6c801f6c82206c84206b85216b87216b88226a8a226a8c23698d23698f24699025689225689326679526679727669827669a28659b29649d29649f2a63a02a63a22b62a32c61a52c60a62d60a82e5fa92e5eab2f5ead305dae305cb0315bb1325ab3325ab43359b63458b73557b93556ba3655bc3754bd3853bf3952c03a51c13a50c33b4fc43c4ec63d4dc73e4cc83f4bca404acb4149cc4248ce4347cf4446d04545d24644d34743d44842d54a41d74b3fd84c3ed94d3dda4e3cdb503bdd513ade5238df5337e05536e15635e25734e35933e45a31e55c30e65d2fe75e2ee8602de9612bea632aeb6429eb6628ec6726ed6925ee6a24ef6c23ef6e21f06f20f1711ff1731df2741cf3761bf37819f47918f57b17f57d15f67e14f68013f78212f78410f8850ff8870ef8890cf98b0bf98c0af98e09fa9008fa9207fa9407fb9606fb9706fb9906fb9b06fb9d07fc9f07fca108fca309fca50afca60cfca80dfcaa0ffcac11fcae12fcb014fcb216fcb418fbb61afbb81dfbba1ffbbc21fbbe23fac026fac228fac42afac62df9c72ff9c932f9cb35f8cd37f8cf3af7d13df7d340f6d543f6d746f5d949f5db4cf4dd4ff4df53f4e156f3e35af3e55df2e661f2e865f2ea69f1ec6df1ed71f1ef75f1f179f2f27df2f482f3f586f3f68af4f88ef5f992f6fa96f8fb9af9fc9dfafda1fcffa4")),ty=Zg(zv("0d088710078813078916078a19068c1b068d1d068e20068f2206902406912605912805922a05932c05942e05952f059631059733059735049837049938049a3a049a3c049b3e049c3f049c41049d43039e44039e46039f48039f4903a04b03a14c02a14e02a25002a25102a35302a35502a45601a45801a45901a55b01a55c01a65e01a66001a66100a76300a76400a76600a76700a86900a86a00a86c00a86e00a86f00a87100a87201a87401a87501a87701a87801a87a02a87b02a87d03a87e03a88004a88104a78305a78405a78606a68707a68808a68a09a58b0aa58d0ba58e0ca48f0da4910ea3920fa39410a29511a19613a19814a099159f9a169f9c179e9d189d9e199da01a9ca11b9ba21d9aa31e9aa51f99a62098a72197a82296aa2395ab2494ac2694ad2793ae2892b02991b12a90b22b8fb32c8eb42e8db52f8cb6308bb7318ab83289ba3388bb3488bc3587bd3786be3885bf3984c03a83c13b82c23c81c33d80c43e7fc5407ec6417dc7427cc8437bc9447aca457acb4679cc4778cc4977cd4a76ce4b75cf4c74d04d73d14e72d24f71d35171d45270d5536fd5546ed6556dd7566cd8576bd9586ada5a6ada5b69db5c68dc5d67dd5e66de5f65de6164df6263e06363e16462e26561e26660e3685fe4695ee56a5de56b5de66c5ce76e5be76f5ae87059e97158e97257ea7457eb7556eb7655ec7754ed7953ed7a52ee7b51ef7c51ef7e50f07f4ff0804ef1814df1834cf2844bf3854bf3874af48849f48948f58b47f58c46f68d45f68f44f79044f79143f79342f89441f89540f9973ff9983ef99a3efa9b3dfa9c3cfa9e3bfb9f3afba139fba238fca338fca537fca636fca835fca934fdab33fdac33fdae32fdaf31fdb130fdb22ffdb42ffdb52efeb72dfeb82cfeba2cfebb2bfebd2afebe2afec029fdc229fdc328fdc527fdc627fdc827fdca26fdcb26fccd25fcce25fcd025fcd225fbd324fbd524fbd724fad824fada24f9dc24f9dd25f8df25f8e125f7e225f7e425f6e626f6e826f5e926f5eb27f4ed27f3ee27f3f027f2f227f1f426f1f525f0f724f0f921"));function ny(t){return function(){return t}}var ey=Math.abs,ry=Math.atan2,iy=Math.cos,oy=Math.max,ay=Math.min,uy=Math.sin,cy=Math.sqrt,fy=1e-12,sy=Math.PI,ly=sy/2,hy=2*sy;function dy(t){return t>=1?ly:t<=-1?-ly:Math.asin(t)}function py(t){return t.innerRadius}function vy(t){return t.outerRadius}function gy(t){return t.startAngle}function yy(t){return t.endAngle}function _y(t){return t&&t.padAngle}function by(t,n,e,r,i,o,a){var u=t-e,c=n-r,f=(a?o:-o)/cy(u*u+c*c),s=f*c,l=-f*u,h=t+s,d=n+l,p=e+s,v=r+l,g=(h+p)/2,y=(d+v)/2,_=p-h,b=v-d,m=_*_+b*b,x=i-o,w=h*v-p*d,M=(b<0?-1:1)*cy(oy(0,x*x*m-w*w)),N=(w*b-_*M)/m,A=(-w*_-b*M)/m,T=(w*b+_*M)/m,S=(-w*_+b*M)/m,k=N-g,E=A-y,C=T-g,P=S-y;return k*k+E*E>C*C+P*P&&(N=T,A=S),{cx:N,cy:A,x01:-s,y01:-l,x11:N*(i/x-1),y11:A*(i/x-1)}}function my(t){this._context=t}function xy(t){return new my(t)}function wy(t){return t[0]}function My(t){return t[1]}function Ny(){var t=wy,n=My,e=ny(!0),r=null,i=xy,o=null;function a(a){var u,c,f,s=a.length,l=!1;for(null==r&&(o=i(f=Xi())),u=0;u<=s;++u)!(u<s&&e(c=a[u],u,a))===l&&((l=!l)?o.lineStart():o.lineEnd()),l&&o.point(+t(c,u,a),+n(c,u,a));if(f)return o=null,f+""||null}return a.x=function(n){return arguments.length?(t="function"==typeof n?n:ny(+n),a):t},a.y=function(t){return arguments.length?(n="function"==typeof t?t:ny(+t),a):n},a.defined=function(t){return arguments.length?(e="function"==typeof t?t:ny(!!t),a):e},a.curve=function(t){return arguments.length?(i=t,null!=r&&(o=i(r)),a):i},a.context=function(t){return arguments.length?(null==t?r=o=null:o=i(r=t),a):r},a}function Ay(){var t=wy,n=null,e=ny(0),r=My,i=ny(!0),o=null,a=xy,u=null;function c(c){var f,s,l,h,d,p=c.length,v=!1,g=new Array(p),y=new Array(p);for(null==o&&(u=a(d=Xi())),f=0;f<=p;++f){if(!(f<p&&i(h=c[f],f,c))===v)if(v=!v)s=f,u.areaStart(),u.lineStart();else{for(u.lineEnd(),u.lineStart(),l=f-1;l>=s;--l)u.point(g[l],y[l]);u.lineEnd(),u.areaEnd()}v&&(g[f]=+t(h,f,c),y[f]=+e(h,f,c),u.point(n?+n(h,f,c):g[f],r?+r(h,f,c):y[f]))}if(d)return u=null,d+""||null}function f(){return Ny().defined(i).curve(a).context(o)}return c.x=function(e){return arguments.length?(t="function"==typeof e?e:ny(+e),n=null,c):t},c.x0=function(n){return arguments.length?(t="function"==typeof n?n:ny(+n),c):t},c.x1=function(t){return arguments.length?(n=null==t?null:"function"==typeof t?t:ny(+t),c):n},c.y=function(t){return arguments.length?(e="function"==typeof t?t:ny(+t),r=null,c):e},c.y0=function(t){return arguments.length?(e="function"==typeof t?t:ny(+t),c):e},c.y1=function(t){return arguments.length?(r=null==t?null:"function"==typeof t?t:ny(+t),c):r},c.lineX0=c.lineY0=function(){return f().x(t).y(e)},c.lineY1=function(){return f().x(t).y(r)},c.lineX1=function(){return f().x(n).y(e)},c.defined=function(t){return arguments.length?(i="function"==typeof t?t:ny(!!t),c):i},c.curve=function(t){return arguments.length?(a=t,null!=o&&(u=a(o)),c):a},c.context=function(t){return arguments.length?(null==t?o=u=null:u=a(o=t),c):o},c}function Ty(t,n){return n<t?-1:n>t?1:n>=t?0:NaN}function Sy(t){return t}my.prototype={areaStart:function(){this._line=0},areaEnd:function(){this._line=NaN},lineStart:function(){this._point=0},lineEnd:function(){(this._line||0!==this._line&&1===this._point)&&this._context.closePath(),this._line=1-this._line},point:function(t,n){switch(t=+t,n=+n,this._point){case 0:this._point=1,this._line?this._context.lineTo(t,n):this._context.moveTo(t,n);break;case 1:this._point=2;default:this._context.lineTo(t,n)}}};var ky=Cy(xy);function Ey(t){this._curve=t}function Cy(t){function n(n){return new Ey(t(n))}return n._curve=t,n}function Py(t){var n=t.curve;return t.angle=t.x,delete t.x,t.radius=t.y,delete t.y,t.curve=function(t){return arguments.length?n(Cy(t)):n()._curve},t}function zy(){return Py(Ny().curve(ky))}function Ry(){var t=Ay().curve(ky),n=t.curve,e=t.lineX0,r=t.lineX1,i=t.lineY0,o=t.lineY1;return t.angle=t.x,delete t.x,t.startAngle=t.x0,delete t.x0,t.endAngle=t.x1,delete t.x1,t.radius=t.y,delete t.y,t.innerRadius=t.y0,delete t.y0,t.outerRadius=t.y1,delete t.y1,t.lineStartAngle=function(){return Py(e())},delete t.lineX0,t.lineEndAngle=function(){return Py(r())},delete t.lineX1,t.lineInnerRadius=function(){return Py(i())},delete t.lineY0,t.lineOuterRadius=function(){return Py(o())},delete t.lineY1,t.curve=function(t){return arguments.length?n(Cy(t)):n()._curve},t}function Dy(t,n){return[(n=+n)*Math.cos(t-=Math.PI/2),n*Math.sin(t)]}Ey.prototype={areaStart:function(){this._curve.areaStart()},areaEnd:function(){this._curve.areaEnd()},lineStart:function(){this._curve.lineStart()},lineEnd:function(){this._curve.lineEnd()},point:function(t,n){this._curve.point(n*Math.sin(t),n*-Math.cos(t))}};var qy=Array.prototype.slice;function Ly(t){return t.source}function Uy(t){return t.target}function Oy(t){var n=Ly,e=Uy,r=wy,i=My,o=null;function a(){var a,u=qy.call(arguments),c=n.apply(this,u),f=e.apply(this,u);if(o||(o=a=Xi()),t(o,+r.apply(this,(u[0]=c,u)),+i.apply(this,u),+r.apply(this,(u[0]=f,u)),+i.apply(this,u)),a)return o=null,a+""||null}return a.source=function(t){return arguments.length?(n=t,a):n},a.target=function(t){return arguments.length?(e=t,a):e},a.x=function(t){return arguments.length?(r="function"==typeof t?t:ny(+t),a):r},a.y=function(t){return arguments.length?(i="function"==typeof t?t:ny(+t),a):i},a.context=function(t){return arguments.length?(o=null==t?null:t,a):o},a}function By(t,n,e,r,i){t.moveTo(n,e),t.bezierCurveTo(n=(n+r)/2,e,n,i,r,i)}function Yy(t,n,e,r,i){t.moveTo(n,e),t.bezierCurveTo(n,e=(e+i)/2,r,e,r,i)}function Fy(t,n,e,r,i){var o=Dy(n,e),a=Dy(n,e=(e+i)/2),u=Dy(r,e),c=Dy(r,i);t.moveTo(o[0],o[1]),t.bezierCurveTo(a[0],a[1],u[0],u[1],c[0],c[1])}var Iy={draw:function(t,n){var e=Math.sqrt(n/sy);t.moveTo(e,0),t.arc(0,0,e,0,hy)}},jy={draw:function(t,n){var e=Math.sqrt(n/5)/2;t.moveTo(-3*e,-e),t.lineTo(-e,-e),t.lineTo(-e,-3*e),t.lineTo(e,-3*e),t.lineTo(e,-e),t.lineTo(3*e,-e),t.lineTo(3*e,e),t.lineTo(e,e),t.lineTo(e,3*e),t.lineTo(-e,3*e),t.lineTo(-e,e),t.lineTo(-3*e,e),t.closePath()}},Hy=Math.sqrt(1/3),Xy=2*Hy,Gy={draw:function(t,n){var e=Math.sqrt(n/Xy),r=e*Hy;t.moveTo(0,-e),t.lineTo(r,0),t.lineTo(0,e),t.lineTo(-r,0),t.closePath()}},Vy=Math.sin(sy/10)/Math.sin(7*sy/10),$y=Math.sin(hy/10)*Vy,Wy=-Math.cos(hy/10)*Vy,Zy={draw:function(t,n){var e=Math.sqrt(.8908130915292852*n),r=$y*e,i=Wy*e;t.moveTo(0,-e),t.lineTo(r,i);for(var o=1;o<5;++o){var a=hy*o/5,u=Math.cos(a),c=Math.sin(a);t.lineTo(c*e,-u*e),t.lineTo(u*r-c*i,c*r+u*i)}t.closePath()}},Qy={draw:function(t,n){var e=Math.sqrt(n),r=-e/2;t.rect(r,r,e,e)}},Jy=Math.sqrt(3),Ky={draw:function(t,n){var e=-Math.sqrt(n/(3*Jy));t.moveTo(0,2*e),t.lineTo(-Jy*e,-e),t.lineTo(Jy*e,-e),t.closePath()}},t_=Math.sqrt(3)/2,n_=1/Math.sqrt(12),e_=3*(n_/2+1),r_={draw:function(t,n){var e=Math.sqrt(n/e_),r=e/2,i=e*n_,o=r,a=e*n_+e,u=-o,c=a;t.moveTo(r,i),t.lineTo(o,a),t.lineTo(u,c),t.lineTo(-.5*r-t_*i,t_*r+-.5*i),t.lineTo(-.5*o-t_*a,t_*o+-.5*a),t.lineTo(-.5*u-t_*c,t_*u+-.5*c),t.lineTo(-.5*r+t_*i,-.5*i-t_*r),t.lineTo(-.5*o+t_*a,-.5*a-t_*o),t.lineTo(-.5*u+t_*c,-.5*c-t_*u),t.closePath()}},i_=[Iy,jy,Gy,Qy,Zy,Ky,r_];function o_(){}function a_(t,n,e){t._context.bezierCurveTo((2*t._x0+t._x1)/3,(2*t._y0+t._y1)/3,(t._x0+2*t._x1)/3,(t._y0+2*t._y1)/3,(t._x0+4*t._x1+n)/6,(t._y0+4*t._y1+e)/6)}function u_(t){this._context=t}function c_(t){this._context=t}function f_(t){this._context=t}function s_(t,n){this._basis=new u_(t),this._beta=n}u_.prototype={areaStart:function(){this._line=0},areaEnd:function(){this._line=NaN},lineStart:function(){this._x0=this._x1=this._y0=this._y1=NaN,this._point=0},lineEnd:function(){switch(this._point){case 3:a_(this,this._x1,this._y1);case 2:this._context.lineTo(this._x1,this._y1)}(this._line||0!==this._line&&1===this._point)&&this._context.closePath(),this._line=1-this._line},point:function(t,n){switch(t=+t,n=+n,this._point){case 0:this._point=1,this._line?this._context.lineTo(t,n):this._context.moveTo(t,n);break;case 1:this._point=2;break;case 2:this._point=3,this._context.lineTo((5*this._x0+this._x1)/6,(5*this._y0+this._y1)/6);default:a_(this,t,n)}this._x0=this._x1,this._x1=t,this._y0=this._y1,this._y1=n}},c_.prototype={areaStart:o_,areaEnd:o_,lineStart:function(){this._x0=this._x1=this._x2=this._x3=this._x4=this._y0=this._y1=this._y2=this._y3=this._y4=NaN,this._point=0},lineEnd:function(){switch(this._point){case 1:this._context.moveTo(this._x2,this._y2),this._context.closePath();break;case 2:this._context.moveTo((this._x2+2*this._x3)/3,(this._y2+2*this._y3)/3),this._context.lineTo((this._x3+2*this._x2)/3,(this._y3+2*this._y2)/3),this._context.closePath();break;case 3:this.point(this._x2,this._y2),this.point(this._x3,this._y3),this.point(this._x4,this._y4)}},point:function(t,n){switch(t=+t,n=+n,this._point){case 0:this._point=1,this._x2=t,this._y2=n;break;case 1:this._point=2,this._x3=t,this._y3=n;break;case 2:this._point=3,this._x4=t,this._y4=n,this._context.moveTo((this._x0+4*this._x1+t)/6,(this._y0+4*this._y1+n)/6);break;default:a_(this,t,n)}this._x0=this._x1,this._x1=t,this._y0=this._y1,this._y1=n}},f_.prototype={areaStart:function(){this._line=0},areaEnd:function(){this._line=NaN},lineStart:function(){this._x0=this._x1=this._y0=this._y1=NaN,this._point=0},lineEnd:function(){(this._line||0!==this._line&&3===this._point)&&this._context.closePath(),this._line=1-this._line},point:function(t,n){switch(t=+t,n=+n,this._point){case 0:this._point=1;break;case 1:this._point=2;break;case 2:this._point=3;var e=(this._x0+4*this._x1+t)/6,r=(this._y0+4*this._y1+n)/6;this._line?this._context.lineTo(e,r):this._context.moveTo(e,r);break;case 3:this._point=4;default:a_(this,t,n)}this._x0=this._x1,this._x1=t,this._y0=this._y1,this._y1=n}},s_.prototype={lineStart:function(){this._x=[],this._y=[],this._basis.lineStart()},lineEnd:function(){var t=this._x,n=this._y,e=t.length-1;if(e>0)for(var r,i=t[0],o=n[0],a=t[e]-i,u=n[e]-o,c=-1;++c<=e;)r=c/e,this._basis.point(this._beta*t[c]+(1-this._beta)*(i+r*a),this._beta*n[c]+(1-this._beta)*(o+r*u));this._x=this._y=null,this._basis.lineEnd()},point:function(t,n){this._x.push(+t),this._y.push(+n)}};var l_=function t(n){function e(t){return 1===n?new u_(t):new s_(t,n)}return e.beta=function(n){return t(+n)},e}(.85);function h_(t,n,e){t._context.bezierCurveTo(t._x1+t._k*(t._x2-t._x0),t._y1+t._k*(t._y2-t._y0),t._x2+t._k*(t._x1-n),t._y2+t._k*(t._y1-e),t._x2,t._y2)}function d_(t,n){this._context=t,this._k=(1-n)/6}d_.prototype={areaStart:function(){this._line=0},areaEnd:function(){this._line=NaN},lineStart:function(){this._x0=this._x1=this._x2=this._y0=this._y1=this._y2=NaN,this._point=0},lineEnd:function(){switch(this._point){case 2:this._context.lineTo(this._x2,this._y2);break;case 3:h_(this,this._x1,this._y1)}(this._line||0!==this._line&&1===this._point)&&this._context.closePath(),this._line=1-this._line},point:function(t,n){switch(t=+t,n=+n,this._point){case 0:this._point=1,this._line?this._context.lineTo(t,n):this._context.moveTo(t,n);break;case 1:this._point=2,this._x1=t,this._y1=n;break;case 2:this._point=3;default:h_(this,t,n)}this._x0=this._x1,this._x1=this._x2,this._x2=t,this._y0=this._y1,this._y1=this._y2,this._y2=n}};var p_=function t(n){function e(t){return new d_(t,n)}return e.tension=function(n){return t(+n)},e}(0);function v_(t,n){this._context=t,this._k=(1-n)/6}v_.prototype={areaStart:o_,areaEnd:o_,lineStart:function(){this._x0=this._x1=this._x2=this._x3=this._x4=this._x5=this._y0=this._y1=this._y2=this._y3=this._y4=this._y5=NaN,this._point=0},lineEnd:function(){switch(this._point){case 1:this._context.moveTo(this._x3,this._y3),this._context.closePath();break;case 2:this._context.lineTo(this._x3,this._y3),this._context.closePath();break;case 3:this.point(this._x3,this._y3),this.point(this._x4,this._y4),this.point(this._x5,this._y5)}},point:function(t,n){switch(t=+t,n=+n,this._point){case 0:this._point=1,this._x3=t,this._y3=n;break;case 1:this._point=2,this._context.moveTo(this._x4=t,this._y4=n);break;case 2:this._point=3,this._x5=t,this._y5=n;break;default:h_(this,t,n)}this._x0=this._x1,this._x1=this._x2,this._x2=t,this._y0=this._y1,this._y1=this._y2,this._y2=n}};var g_=function t(n){function e(t){return new v_(t,n)}return e.tension=function(n){return t(+n)},e}(0);function y_(t,n){this._context=t,this._k=(1-n)/6}y_.prototype={areaStart:function(){this._line=0},areaEnd:function(){this._line=NaN},lineStart:function(){this._x0=this._x1=this._x2=this._y0=this._y1=this._y2=NaN,this._point=0},lineEnd:function(){(this._line||0!==this._line&&3===this._point)&&this._context.closePath(),this._line=1-this._line},point:function(t,n){switch(t=+t,n=+n,this._point){case 0:this._point=1;break;case 1:this._point=2;break;case 2:this._point=3,this._line?this._context.lineTo(this._x2,this._y2):this._context.moveTo(this._x2,this._y2);break;case 3:this._point=4;default:h_(this,t,n)}this._x0=this._x1,this._x1=this._x2,this._x2=t,this._y0=this._y1,this._y1=this._y2,this._y2=n}};var __=function t(n){function e(t){return new y_(t,n)}return e.tension=function(n){return t(+n)},e}(0);function b_(t,n,e){var r=t._x1,i=t._y1,o=t._x2,a=t._y2;if(t._l01_a>fy){var u=2*t._l01_2a+3*t._l01_a*t._l12_a+t._l12_2a,c=3*t._l01_a*(t._l01_a+t._l12_a);r=(r*u-t._x0*t._l12_2a+t._x2*t._l01_2a)/c,i=(i*u-t._y0*t._l12_2a+t._y2*t._l01_2a)/c}if(t._l23_a>fy){var f=2*t._l23_2a+3*t._l23_a*t._l12_a+t._l12_2a,s=3*t._l23_a*(t._l23_a+t._l12_a);o=(o*f+t._x1*t._l23_2a-n*t._l12_2a)/s,a=(a*f+t._y1*t._l23_2a-e*t._l12_2a)/s}t._context.bezierCurveTo(r,i,o,a,t._x2,t._y2)}function m_(t,n){this._context=t,this._alpha=n}m_.prototype={areaStart:function(){this._line=0},areaEnd:function(){this._line=NaN},lineStart:function(){this._x0=this._x1=this._x2=this._y0=this._y1=this._y2=NaN,this._l01_a=this._l12_a=this._l23_a=this._l01_2a=this._l12_2a=this._l23_2a=this._point=0},lineEnd:function(){switch(this._point){case 2:this._context.lineTo(this._x2,this._y2);break;case 3:this.point(this._x2,this._y2)}(this._line||0!==this._line&&1===this._point)&&this._context.closePath(),this._line=1-this._line},point:function(t,n){if(t=+t,n=+n,this._point){var e=this._x2-t,r=this._y2-n;this._l23_a=Math.sqrt(this._l23_2a=Math.pow(e*e+r*r,this._alpha))}switch(this._point){case 0:this._point=1,this._line?this._context.lineTo(t,n):this._context.moveTo(t,n);break;case 1:this._point=2;break;case 2:this._point=3;default:b_(this,t,n)}this._l01_a=this._l12_a,this._l12_a=this._l23_a,this._l01_2a=this._l12_2a,this._l12_2a=this._l23_2a,this._x0=this._x1,this._x1=this._x2,this._x2=t,this._y0=this._y1,this._y1=this._y2,this._y2=n}};var x_=function t(n){function e(t){return n?new m_(t,n):new d_(t,0)}return e.alpha=function(n){return t(+n)},e}(.5);function w_(t,n){this._context=t,this._alpha=n}w_.prototype={areaStart:o_,areaEnd:o_,lineStart:function(){this._x0=this._x1=this._x2=this._x3=this._x4=this._x5=this._y0=this._y1=this._y2=this._y3=this._y4=this._y5=NaN,this._l01_a=this._l12_a=this._l23_a=this._l01_2a=this._l12_2a=this._l23_2a=this._point=0},lineEnd:function(){switch(this._point){case 1:this._context.moveTo(this._x3,this._y3),this._context.closePath();break;case 2:this._context.lineTo(this._x3,this._y3),this._context.closePath();break;case 3:this.point(this._x3,this._y3),this.point(this._x4,this._y4),this.point(this._x5,this._y5)}},point:function(t,n){if(t=+t,n=+n,this._point){var e=this._x2-t,r=this._y2-n;this._l23_a=Math.sqrt(this._l23_2a=Math.pow(e*e+r*r,this._alpha))}switch(this._point){case 0:this._point=1,this._x3=t,this._y3=n;break;case 1:this._point=2,this._context.moveTo(this._x4=t,this._y4=n);break;case 2:this._point=3,this._x5=t,this._y5=n;break;default:b_(this,t,n)}this._l01_a=this._l12_a,this._l12_a=this._l23_a,this._l01_2a=this._l12_2a,this._l12_2a=this._l23_2a,this._x0=this._x1,this._x1=this._x2,this._x2=t,this._y0=this._y1,this._y1=this._y2,this._y2=n}};var M_=function t(n){function e(t){return n?new w_(t,n):new v_(t,0)}return e.alpha=function(n){return t(+n)},e}(.5);function N_(t,n){this._context=t,this._alpha=n}N_.prototype={areaStart:function(){this._line=0},areaEnd:function(){this._line=NaN},lineStart:function(){this._x0=this._x1=this._x2=this._y0=this._y1=this._y2=NaN,this._l01_a=this._l12_a=this._l23_a=this._l01_2a=this._l12_2a=this._l23_2a=this._point=0},lineEnd:function(){(this._line||0!==this._line&&3===this._point)&&this._context.closePath(),this._line=1-this._line},point:function(t,n){if(t=+t,n=+n,this._point){var e=this._x2-t,r=this._y2-n;this._l23_a=Math.sqrt(this._l23_2a=Math.pow(e*e+r*r,this._alpha))}switch(this._point){case 0:this._point=1;break;case 1:this._point=2;break;case 2:this._point=3,this._line?this._context.lineTo(this._x2,this._y2):this._context.moveTo(this._x2,this._y2);break;case 3:this._point=4;default:b_(this,t,n)}this._l01_a=this._l12_a,this._l12_a=this._l23_a,this._l01_2a=this._l12_2a,this._l12_2a=this._l23_2a,this._x0=this._x1,this._x1=this._x2,this._x2=t,this._y0=this._y1,this._y1=this._y2,this._y2=n}};var A_=function t(n){function e(t){return n?new N_(t,n):new y_(t,0)}return e.alpha=function(n){return t(+n)},e}(.5);function T_(t){this._context=t}function S_(t){return t<0?-1:1}function k_(t,n,e){var r=t._x1-t._x0,i=n-t._x1,o=(t._y1-t._y0)/(r||i<0&&-0),a=(e-t._y1)/(i||r<0&&-0),u=(o*i+a*r)/(r+i);return(S_(o)+S_(a))*Math.min(Math.abs(o),Math.abs(a),.5*Math.abs(u))||0}function E_(t,n){var e=t._x1-t._x0;return e?(3*(t._y1-t._y0)/e-n)/2:n}function C_(t,n,e){var r=t._x0,i=t._y0,o=t._x1,a=t._y1,u=(o-r)/3;t._context.bezierCurveTo(r+u,i+u*n,o-u,a-u*e,o,a)}function P_(t){this._context=t}function z_(t){this._context=new R_(t)}function R_(t){this._context=t}function D_(t){this._context=t}function q_(t){var n,e,r=t.length-1,i=new Array(r),o=new Array(r),a=new Array(r);for(i[0]=0,o[0]=2,a[0]=t[0]+2*t[1],n=1;n<r-1;++n)i[n]=1,o[n]=4,a[n]=4*t[n]+2*t[n+1];for(i[r-1]=2,o[r-1]=7,a[r-1]=8*t[r-1]+t[r],n=1;n<r;++n)e=i[n]/o[n-1],o[n]-=e,a[n]-=e*a[n-1];for(i[r-1]=a[r-1]/o[r-1],n=r-2;n>=0;--n)i[n]=(a[n]-i[n+1])/o[n];for(o[r-1]=(t[r]+i[r-1])/2,n=0;n<r-1;++n)o[n]=2*t[n+1]-i[n+1];return[i,o]}function L_(t,n){this._context=t,this._t=n}function U_(t,n){if((i=t.length)>1)for(var e,r,i,o=1,a=t[n[0]],u=a.length;o<i;++o)for(r=a,a=t[n[o]],e=0;e<u;++e)a[e][1]+=a[e][0]=isNaN(r[e][1])?r[e][0]:r[e][1]}function O_(t){for(var n=t.length,e=new Array(n);--n>=0;)e[n]=n;return e}function B_(t,n){return t[n]}function Y_(t){var n=t.map(F_);return O_(t).sort(function(t,e){return n[t]-n[e]})}function F_(t){for(var n,e=-1,r=0,i=t.length,o=-1/0;++e<i;)(n=+t[e][1])>o&&(o=n,r=e);return r}function I_(t){var n=t.map(j_);return O_(t).sort(function(t,e){return n[t]-n[e]})}function j_(t){for(var n,e=0,r=-1,i=t.length;++r<i;)(n=+t[r][1])&&(e+=n);return e}function H_(t){return function(){return t}}function X_(t){return t[0]}function G_(t){return t[1]}function V_(){this._=null}function $_(t){t.U=t.C=t.L=t.R=t.P=t.N=null}function W_(t,n){var e=n,r=n.R,i=e.U;i?i.L===e?i.L=r:i.R=r:t._=r,r.U=i,e.U=r,e.R=r.L,e.R&&(e.R.U=e),r.L=e}function Z_(t,n){var e=n,r=n.L,i=e.U;i?i.L===e?i.L=r:i.R=r:t._=r,r.U=i,e.U=r,e.L=r.R,e.L&&(e.L.U=e),r.R=e}function Q_(t){for(;t.L;)t=t.L;return t}function J_(t,n,e,r){var i=[null,null],o=wb.push(i)-1;return i.left=t,i.right=n,e&&tb(i,t,n,e),r&&tb(i,n,t,r),mb[t.index].halfedges.push(o),mb[n.index].halfedges.push(o),i}function K_(t,n,e){var r=[n,e];return r.left=t,r}function tb(t,n,e,r){t[0]||t[1]?t.left===e?t[1]=r:t[0]=r:(t[0]=r,t.left=n,t.right=e)}function nb(t,n,e,r,i){var o,a=t[0],u=t[1],c=a[0],f=a[1],s=0,l=1,h=u[0]-c,d=u[1]-f;if(o=n-c,h||!(o>0)){if(o/=h,h<0){if(o<s)return;o<l&&(l=o)}else if(h>0){if(o>l)return;o>s&&(s=o)}if(o=r-c,h||!(o<0)){if(o/=h,h<0){if(o>l)return;o>s&&(s=o)}else if(h>0){if(o<s)return;o<l&&(l=o)}if(o=e-f,d||!(o>0)){if(o/=d,d<0){if(o<s)return;o<l&&(l=o)}else if(d>0){if(o>l)return;o>s&&(s=o)}if(o=i-f,d||!(o<0)){if(o/=d,d<0){if(o>l)return;o>s&&(s=o)}else if(d>0){if(o<s)return;o<l&&(l=o)}return!(s>0||l<1)||(s>0&&(t[0]=[c+s*h,f+s*d]),l<1&&(t[1]=[c+l*h,f+l*d]),!0)}}}}}function eb(t,n,e,r,i){var o=t[1];if(o)return!0;var a,u,c=t[0],f=t.left,s=t.right,l=f[0],h=f[1],d=s[0],p=s[1],v=(l+d)/2,g=(h+p)/2;if(p===h){if(v<n||v>=r)return;if(l>d){if(c){if(c[1]>=i)return}else c=[v,e];o=[v,i]}else{if(c){if(c[1]<e)return}else c=[v,i];o=[v,e]}}else if(u=g-(a=(l-d)/(p-h))*v,a<-1||a>1)if(l>d){if(c){if(c[1]>=i)return}else c=[(e-u)/a,e];o=[(i-u)/a,i]}else{if(c){if(c[1]<e)return}else c=[(i-u)/a,i];o=[(e-u)/a,e]}else if(h<p){if(c){if(c[0]>=r)return}else c=[n,a*n+u];o=[r,a*r+u]}else{if(c){if(c[0]<n)return}else c=[r,a*r+u];o=[n,a*n+u]}return t[0]=c,t[1]=o,!0}function rb(t,n){var e=t.site,r=n.left,i=n.right;return e===i&&(i=r,r=e),i?Math.atan2(i[1]-r[1],i[0]-r[0]):(e===r?(r=n[1],i=n[0]):(r=n[0],i=n[1]),Math.atan2(r[0]-i[0],i[1]-r[1]))}function ib(t,n){return n[+(n.left!==t.site)]}function ob(t,n){return n[+(n.left===t.site)]}T_.prototype={areaStart:o_,areaEnd:o_,lineStart:function(){this._point=0},lineEnd:function(){this._point&&this._context.closePath()},point:function(t,n){t=+t,n=+n,this._point?this._context.lineTo(t,n):(this._point=1,this._context.moveTo(t,n))}},P_.prototype={areaStart:function(){this._line=0},areaEnd:function(){this._line=NaN},lineStart:function(){this._x0=this._x1=this._y0=this._y1=this._t0=NaN,this._point=0},lineEnd:function(){switch(this._point){case 2:this._context.lineTo(this._x1,this._y1);break;case 3:C_(this,this._t0,E_(this,this._t0))}(this._line||0!==this._line&&1===this._point)&&this._context.closePath(),this._line=1-this._line},point:function(t,n){var e=NaN;if(n=+n,(t=+t)!==this._x1||n!==this._y1){switch(this._point){case 0:this._point=1,this._line?this._context.lineTo(t,n):this._context.moveTo(t,n);break;case 1:this._point=2;break;case 2:this._point=3,C_(this,E_(this,e=k_(this,t,n)),e);break;default:C_(this,this._t0,e=k_(this,t,n))}this._x0=this._x1,this._x1=t,this._y0=this._y1,this._y1=n,this._t0=e}}},(z_.prototype=Object.create(P_.prototype)).point=function(t,n){P_.prototype.point.call(this,n,t)},R_.prototype={moveTo:function(t,n){this._context.moveTo(n,t)},closePath:function(){this._context.closePath()},lineTo:function(t,n){this._context.lineTo(n,t)},bezierCurveTo:function(t,n,e,r,i,o){this._context.bezierCurveTo(n,t,r,e,o,i)}},D_.prototype={areaStart:function(){this._line=0},areaEnd:function(){this._line=NaN},lineStart:function(){this._x=[],this._y=[]},lineEnd:function(){var t=this._x,n=this._y,e=t.length;if(e)if(this._line?this._context.lineTo(t[0],n[0]):this._context.moveTo(t[0],n[0]),2===e)this._context.lineTo(t[1],n[1]);else for(var r=q_(t),i=q_(n),o=0,a=1;a<e;++o,++a)this._context.bezierCurveTo(r[0][o],i[0][o],r[1][o],i[1][o],t[a],n[a]);(this._line||0!==this._line&&1===e)&&this._context.closePath(),this._line=1-this._line,this._x=this._y=null},point:function(t,n){this._x.push(+t),this._y.push(+n)}},L_.prototype={areaStart:function(){this._line=0},areaEnd:function(){this._line=NaN},lineStart:function(){this._x=this._y=NaN,this._point=0},lineEnd:function(){0<this._t&&this._t<1&&2===this._point&&this._context.lineTo(this._x,this._y),(this._line||0!==this._line&&1===this._point)&&this._context.closePath(),this._line>=0&&(this._t=1-this._t,this._line=1-this._line)},point:function(t,n){switch(t=+t,n=+n,this._point){case 0:this._point=1,this._line?this._context.lineTo(t,n):this._context.moveTo(t,n);break;case 1:this._point=2;default:if(this._t<=0)this._context.lineTo(this._x,n),this._context.lineTo(t,n);else{var e=this._x*(1-this._t)+t*this._t;this._context.lineTo(e,this._y),this._context.lineTo(e,n)}}this._x=t,this._y=n}},V_.prototype={constructor:V_,insert:function(t,n){var e,r,i;if(t){if(n.P=t,n.N=t.N,t.N&&(t.N.P=n),t.N=n,t.R){for(t=t.R;t.L;)t=t.L;t.L=n}else t.R=n;e=t}else this._?(t=Q_(this._),n.P=null,n.N=t,t.P=t.L=n,e=t):(n.P=n.N=null,this._=n,e=null);for(n.L=n.R=null,n.U=e,n.C=!0,t=n;e&&e.C;)e===(r=e.U).L?(i=r.R)&&i.C?(e.C=i.C=!1,r.C=!0,t=r):(t===e.R&&(W_(this,e),e=(t=e).U),e.C=!1,r.C=!0,Z_(this,r)):(i=r.L)&&i.C?(e.C=i.C=!1,r.C=!0,t=r):(t===e.L&&(Z_(this,e),e=(t=e).U),e.C=!1,r.C=!0,W_(this,r)),e=t.U;this._.C=!1},remove:function(t){t.N&&(t.N.P=t.P),t.P&&(t.P.N=t.N),t.N=t.P=null;var n,e,r,i=t.U,o=t.L,a=t.R;if(e=o?a?Q_(a):o:a,i?i.L===t?i.L=e:i.R=e:this._=e,o&&a?(r=e.C,e.C=t.C,e.L=o,o.U=e,e!==a?(i=e.U,e.U=t.U,t=e.R,i.L=t,e.R=a,a.U=e):(e.U=i,i=e,t=e.R)):(r=t.C,t=e),t&&(t.U=i),!r)if(t&&t.C)t.C=!1;else{do{if(t===this._)break;if(t===i.L){if((n=i.R).C&&(n.C=!1,i.C=!0,W_(this,i),n=i.R),n.L&&n.L.C||n.R&&n.R.C){n.R&&n.R.C||(n.L.C=!1,n.C=!0,Z_(this,n),n=i.R),n.C=i.C,i.C=n.R.C=!1,W_(this,i),t=this._;break}}else if((n=i.L).C&&(n.C=!1,i.C=!0,Z_(this,i),n=i.L),n.L&&n.L.C||n.R&&n.R.C){n.L&&n.L.C||(n.R.C=!1,n.C=!0,W_(this,n),n=i.L),n.C=i.C,i.C=n.L.C=!1,Z_(this,i),t=this._;break}n.C=!0,t=i,i=i.U}while(!t.C);t&&(t.C=!1)}}};var ab,ub=[];function cb(){$_(this),this.x=this.y=this.arc=this.site=this.cy=null}function fb(t){var n=t.P,e=t.N;if(n&&e){var r=n.site,i=t.site,o=e.site;if(r!==o){var a=i[0],u=i[1],c=r[0]-a,f=r[1]-u,s=o[0]-a,l=o[1]-u,h=2*(c*l-f*s);if(!(h>=-Nb)){var d=c*c+f*f,p=s*s+l*l,v=(l*d-f*p)/h,g=(c*p-s*d)/h,y=ub.pop()||new cb;y.arc=t,y.site=i,y.x=v+a,y.y=(y.cy=g+u)+Math.sqrt(v*v+g*g),t.circle=y;for(var _=null,b=xb._;b;)if(y.y<b.y||y.y===b.y&&y.x<=b.x){if(!b.L){_=b.P;break}b=b.L}else{if(!b.R){_=b;break}b=b.R}xb.insert(_,y),_||(ab=y)}}}}function sb(t){var n=t.circle;n&&(n.P||(ab=n.N),xb.remove(n),ub.push(n),$_(n),t.circle=null)}var lb=[];function hb(){$_(this),this.edge=this.site=this.circle=null}function db(t){var n=lb.pop()||new hb;return n.site=t,n}function pb(t){sb(t),bb.remove(t),lb.push(t),$_(t)}function vb(t){var n=t.circle,e=n.x,r=n.cy,i=[e,r],o=t.P,a=t.N,u=[t];pb(t);for(var c=o;c.circle&&Math.abs(e-c.circle.x)<Mb&&Math.abs(r-c.circle.cy)<Mb;)o=c.P,u.unshift(c),pb(c),c=o;u.unshift(c),sb(c);for(var f=a;f.circle&&Math.abs(e-f.circle.x)<Mb&&Math.abs(r-f.circle.cy)<Mb;)a=f.N,u.push(f),pb(f),f=a;u.push(f),sb(f);var s,l=u.length;for(s=1;s<l;++s)f=u[s],c=u[s-1],tb(f.edge,c.site,f.site,i);c=u[0],(f=u[l-1]).edge=J_(c.site,f.site,null,i),fb(c),fb(f)}function gb(t){for(var n,e,r,i,o=t[0],a=t[1],u=bb._;u;)if((r=yb(u,a)-o)>Mb)u=u.L;else{if(!((i=o-_b(u,a))>Mb)){r>-Mb?(n=u.P,e=u):i>-Mb?(n=u,e=u.N):n=e=u;break}if(!u.R){n=u;break}u=u.R}!function(t){mb[t.index]={site:t,halfedges:[]}}(t);var c=db(t);if(bb.insert(n,c),n||e){if(n===e)return sb(n),e=db(n.site),bb.insert(c,e),c.edge=e.edge=J_(n.site,c.site),fb(n),void fb(e);if(e){sb(n),sb(e);var f=n.site,s=f[0],l=f[1],h=t[0]-s,d=t[1]-l,p=e.site,v=p[0]-s,g=p[1]-l,y=2*(h*g-d*v),_=h*h+d*d,b=v*v+g*g,m=[(g*_-d*b)/y+s,(h*b-v*_)/y+l];tb(e.edge,f,p,m),c.edge=J_(f,t,null,m),e.edge=J_(t,p,null,m),fb(n),fb(e)}else c.edge=J_(n.site,c.site)}}function yb(t,n){var e=t.site,r=e[0],i=e[1],o=i-n;if(!o)return r;var a=t.P;if(!a)return-1/0;var u=(e=a.site)[0],c=e[1],f=c-n;if(!f)return u;var s=u-r,l=1/o-1/f,h=s/f;return l?(-h+Math.sqrt(h*h-2*l*(s*s/(-2*f)-c+f/2+i-o/2)))/l+r:(r+u)/2}function _b(t,n){var e=t.N;if(e)return yb(e,n);var r=t.site;return r[1]===n?r[0]:1/0}var bb,mb,xb,wb,Mb=1e-6,Nb=1e-12;function Ab(t,n){return n[1]-t[1]||n[0]-t[0]}function Tb(t,n){var e,r,i,o=t.sort(Ab).pop();for(wb=[],mb=new Array(t.length),bb=new V_,xb=new V_;;)if(i=ab,o&&(!i||o[1]<i.y||o[1]===i.y&&o[0]<i.x))o[0]===e&&o[1]===r||(gb(o),e=o[0],r=o[1]),o=t.pop();else{if(!i)break;vb(i.arc)}if(function(){for(var t,n,e,r,i=0,o=mb.length;i<o;++i)if((t=mb[i])&&(r=(n=t.halfedges).length)){var a=new Array(r),u=new Array(r);for(e=0;e<r;++e)a[e]=e,u[e]=rb(t,wb[n[e]]);for(a.sort(function(t,n){return u[n]-u[t]}),e=0;e<r;++e)u[e]=n[a[e]];for(e=0;e<r;++e)n[e]=u[e]}}(),n){var a=+n[0][0],u=+n[0][1],c=+n[1][0],f=+n[1][1];!function(t,n,e,r){for(var i,o=wb.length;o--;)eb(i=wb[o],t,n,e,r)&&nb(i,t,n,e,r)&&(Math.abs(i[0][0]-i[1][0])>Mb||Math.abs(i[0][1]-i[1][1])>Mb)||delete wb[o]}(a,u,c,f),function(t,n,e,r){var i,o,a,u,c,f,s,l,h,d,p,v,g=mb.length,y=!0;for(i=0;i<g;++i)if(o=mb[i]){for(a=o.site,u=(c=o.halfedges).length;u--;)wb[c[u]]||c.splice(u,1);for(u=0,f=c.length;u<f;)p=(d=ob(o,wb[c[u]]))[0],v=d[1],l=(s=ib(o,wb[c[++u%f]]))[0],h=s[1],(Math.abs(p-l)>Mb||Math.abs(v-h)>Mb)&&(c.splice(u,0,wb.push(K_(a,d,Math.abs(p-t)<Mb&&r-v>Mb?[t,Math.abs(l-t)<Mb?h:r]:Math.abs(v-r)<Mb&&e-p>Mb?[Math.abs(h-r)<Mb?l:e,r]:Math.abs(p-e)<Mb&&v-n>Mb?[e,Math.abs(l-e)<Mb?h:n]:Math.abs(v-n)<Mb&&p-t>Mb?[Math.abs(h-n)<Mb?l:t,n]:null))-1),++f);f&&(y=!1)}if(y){var _,b,m,x=1/0;for(i=0,y=null;i<g;++i)(o=mb[i])&&(m=(_=(a=o.site)[0]-t)*_+(b=a[1]-n)*b)<x&&(x=m,y=o);if(y){var w=[t,n],M=[t,r],N=[e,r],A=[e,n];y.halfedges.push(wb.push(K_(a=y.site,w,M))-1,wb.push(K_(a,M,N))-1,wb.push(K_(a,N,A))-1,wb.push(K_(a,A,w))-1)}}for(i=0;i<g;++i)(o=mb[i])&&(o.halfedges.length||delete mb[i])}(a,u,c,f)}this.edges=wb,this.cells=mb,bb=xb=wb=mb=null}function Sb(t){return function(){return t}}function kb(t,n,e){this.target=t,this.type=n,this.transform=e}function Eb(t,n,e){this.k=t,this.x=n,this.y=e}Tb.prototype={constructor:Tb,polygons:function(){var t=this.edges;return this.cells.map(function(n){var e=n.halfedges.map(function(e){return ib(n,t[e])});return e.data=n.site.data,e})},triangles:function(){var t=[],n=this.edges;return this.cells.forEach(function(e,r){if(o=(i=e.halfedges).length)for(var i,o,a,u,c,f,s=e.site,l=-1,h=n[i[o-1]],d=h.left===s?h.right:h.left;++l<o;)a=d,d=(h=n[i[l]]).left===s?h.right:h.left,a&&d&&r<a.index&&r<d.index&&(c=a,f=d,((u=s)[0]-f[0])*(c[1]-u[1])-(u[0]-c[0])*(f[1]-u[1])<0)&&t.push([s.data,a.data,d.data])}),t},links:function(){return this.edges.filter(function(t){return t.right}).map(function(t){return{source:t.left.data,target:t.right.data}})},find:function(t,n,e){for(var r,i,o=this,a=o._found||0,u=o.cells.length;!(i=o.cells[a]);)if(++a>=u)return null;var c=t-i.site[0],f=n-i.site[1],s=c*c+f*f;do{i=o.cells[r=a],a=null,i.halfedges.forEach(function(e){var r=o.edges[e],u=r.left;if(u!==i.site&&u||(u=r.right)){var c=t-u[0],f=n-u[1],l=c*c+f*f;l<s&&(s=l,a=u.index)}})}while(null!==a);return o._found=r,null==e||s<=e*e?i.site:null}},Eb.prototype={constructor:Eb,scale:function(t){return 1===t?this:new Eb(this.k*t,this.x,this.y)},translate:function(t,n){return 0===t&0===n?this:new Eb(this.k,this.x+this.k*t,this.y+this.k*n)},apply:function(t){return[t[0]*this.k+this.x,t[1]*this.k+this.y]},applyX:function(t){return t*this.k+this.x},applyY:function(t){return t*this.k+this.y},invert:function(t){return[(t[0]-this.x)/this.k,(t[1]-this.y)/this.k]},invertX:function(t){return(t-this.x)/this.k},invertY:function(t){return(t-this.y)/this.k},rescaleX:function(t){return t.copy().domain(t.range().map(this.invertX,this).map(t.invert,t))},rescaleY:function(t){return t.copy().domain(t.range().map(this.invertY,this).map(t.invert,t))},toString:function(){return"translate("+this.x+","+this.y+") scale("+this.k+")"}};var Cb=new Eb(1,0,0);function Pb(t){return t.__zoom||Cb}function zb(){t.event.stopImmediatePropagation()}function Rb(){t.event.preventDefault(),t.event.stopImmediatePropagation()}function Db(){return!t.event.button}function qb(){var t,n,e=this;return e instanceof SVGElement?(t=(e=e.ownerSVGElement||e).width.baseVal.value,n=e.height.baseVal.value):(t=e.clientWidth,n=e.clientHeight),[[0,0],[t,n]]}function Lb(){return this.__zoom||Cb}function Ub(){return-t.event.deltaY*(t.event.deltaMode?120:1)/500}function Ob(){return"ontouchstart"in this}function Bb(t,n,e){var r=t.invertX(n[0][0])-e[0][0],i=t.invertX(n[1][0])-e[1][0],o=t.invertY(n[0][1])-e[0][1],a=t.invertY(n[1][1])-e[1][1];return t.translate(i>r?(r+i)/2:Math.min(0,r)||Math.max(0,i),a>o?(o+a)/2:Math.min(0,o)||Math.max(0,a))}Pb.prototype=Eb.prototype,t.version="5.9.7",t.bisect=i,t.bisectRight=i,t.bisectLeft=o,t.ascending=n,t.bisector=e,t.cross=function(t,n,e){var r,i,o,u,c=t.length,f=n.length,s=new Array(c*f);for(null==e&&(e=a),r=o=0;r<c;++r)for(u=t[r],i=0;i<f;++i,++o)s[o]=e(u,n[i]);return s},t.descending=function(t,n){return n<t?-1:n>t?1:n>=t?0:NaN},t.deviation=f,t.extent=s,t.histogram=function(){var t=v,n=s,e=M;function r(r){var o,a,u=r.length,c=new Array(u);for(o=0;o<u;++o)c[o]=t(r[o],o,r);var f=n(c),s=f[0],l=f[1],h=e(c,s,l);Array.isArray(h)||(h=w(s,l,h),h=g(Math.ceil(s/h)*h,l,h));for(var d=h.length;h[0]<=s;)h.shift(),--d;for(;h[d-1]>l;)h.pop(),--d;var p,v=new Array(d+1);for(o=0;o<=d;++o)(p=v[o]=[]).x0=o>0?h[o-1]:s,p.x1=o<d?h[o]:l;for(o=0;o<u;++o)s<=(a=c[o])&&a<=l&&v[i(h,a,0,d)].push(r[o]);return v}return r.value=function(n){return arguments.length?(t="function"==typeof n?n:p(n),r):t},r.domain=function(t){return arguments.length?(n="function"==typeof t?t:p([t[0],t[1]]),r):n},r.thresholds=function(t){return arguments.length?(e="function"==typeof t?t:Array.isArray(t)?p(h.call(t)):p(t),r):e},r},t.thresholdFreedmanDiaconis=function(t,e,r){return t=d.call(t,u).sort(n),Math.ceil((r-e)/(2*(N(t,.75)-N(t,.25))*Math.pow(t.length,-1/3)))},t.thresholdScott=function(t,n,e){return Math.ceil((e-n)/(3.5*f(t)*Math.pow(t.length,-1/3)))},t.thresholdSturges=M,t.max=A,t.mean=function(t,n){var e,r=t.length,i=r,o=-1,a=0;if(null==n)for(;++o<r;)isNaN(e=u(t[o]))?--i:a+=e;else for(;++o<r;)isNaN(e=u(n(t[o],o,t)))?--i:a+=e;if(i)return a/i},t.median=function(t,e){var r,i=t.length,o=-1,a=[];if(null==e)for(;++o<i;)isNaN(r=u(t[o]))||a.push(r);else for(;++o<i;)isNaN(r=u(e(t[o],o,t)))||a.push(r);return N(a.sort(n),.5)},t.merge=T,t.min=S,t.pairs=function(t,n){null==n&&(n=a);for(var e=0,r=t.length-1,i=t[0],o=new Array(r<0?0:r);e<r;)o[e]=n(i,i=t[++e]);return o},t.permute=function(t,n){for(var e=n.length,r=new Array(e);e--;)r[e]=t[n[e]];return r},t.quantile=N,t.range=g,t.scan=function(t,e){if(r=t.length){var r,i,o=0,a=0,u=t[a];for(null==e&&(e=n);++o<r;)(e(i=t[o],u)<0||0!==e(u,u))&&(u=i,a=o);return 0===e(u,u)?a:void 0}},t.shuffle=function(t,n,e){for(var r,i,o=(null==e?t.length:e)-(n=null==n?0:+n);o;)i=Math.random()*o--|0,r=t[o+n],t[o+n]=t[i+n],t[i+n]=r;return t},t.sum=function(t,n){var e,r=t.length,i=-1,o=0;if(null==n)for(;++i<r;)(e=+t[i])&&(o+=e);else for(;++i<r;)(e=+n(t[i],i,t))&&(o+=e);return o},t.ticks=m,t.tickIncrement=x,t.tickStep=w,t.transpose=k,t.variance=c,t.zip=function(){return k(arguments)},t.axisTop=function(t){return Y(z,t)},t.axisRight=function(t){return Y(R,t)},t.axisBottom=function(t){return Y(D,t)},t.axisLeft=function(t){return Y(q,t)},t.brush=function(){return zi(xi)},t.brushX=function(){return zi(bi)},t.brushY=function(){return zi(mi)},t.brushSelection=function(t){var n=t.__brush;return n?n.dim.output(n.selection):null},t.chord=function(){var t=0,n=null,e=null,r=null;function i(i){var o,a,u,c,f,s,l=i.length,h=[],d=g(l),p=[],v=[],y=v.groups=new Array(l),_=new Array(l*l);for(o=0,f=-1;++f<l;){for(a=0,s=-1;++s<l;)a+=i[f][s];h.push(a),p.push(g(l)),o+=a}for(n&&d.sort(function(t,e){return n(h[t],h[e])}),e&&p.forEach(function(t,n){t.sort(function(t,r){return e(i[n][t],i[n][r])})}),c=(o=Oi(0,Ui-t*l)/o)?t:Ui/l,a=0,f=-1;++f<l;){for(u=a,s=-1;++s<l;){var b=d[f],m=p[b][s],x=i[b][m],w=a,M=a+=x*o;_[m*l+b]={index:b,subindex:m,startAngle:w,endAngle:M,value:x}}y[b]={index:b,startAngle:u,endAngle:a,value:h[b]},a+=c}for(f=-1;++f<l;)for(s=f-1;++s<l;){var N=_[s*l+f],A=_[f*l+s];(N.value||A.value)&&v.push(N.value<A.value?{source:A,target:N}:{source:N,target:A})}return r?v.sort(r):v}return i.padAngle=function(n){return arguments.length?(t=Oi(0,n),i):t},i.sortGroups=function(t){return arguments.length?(n=t,i):n},i.sortSubgroups=function(t){return arguments.length?(e=t,i):e},i.sortChords=function(t){return arguments.length?(null==t?r=null:(n=t,r=function(t,e){return n(t.source.value+t.target.value,e.source.value+e.target.value)})._=t,i):r&&r._;var n},i},t.ribbon=function(){var t=Gi,n=Vi,e=$i,r=Wi,i=Zi,o=null;function a(){var a,u=Bi.call(arguments),c=t.apply(this,u),f=n.apply(this,u),s=+e.apply(this,(u[0]=c,u)),l=r.apply(this,u)-Li,h=i.apply(this,u)-Li,d=s*Ri(l),p=s*Di(l),v=+e.apply(this,(u[0]=f,u)),g=r.apply(this,u)-Li,y=i.apply(this,u)-Li;if(o||(o=a=Xi()),o.moveTo(d,p),o.arc(0,0,s,l,h),l===g&&h===y||(o.quadraticCurveTo(0,0,v*Ri(g),v*Di(g)),o.arc(0,0,v,g,y)),o.quadraticCurveTo(0,0,d,p),o.closePath(),a)return o=null,a+""||null}return a.radius=function(t){return arguments.length?(e="function"==typeof t?t:Yi(+t),a):e},a.startAngle=function(t){return arguments.length?(r="function"==typeof t?t:Yi(+t),a):r},a.endAngle=function(t){return arguments.length?(i="function"==typeof t?t:Yi(+t),a):i},a.source=function(n){return arguments.length?(t=n,a):t},a.target=function(t){return arguments.length?(n=t,a):n},a.context=function(t){return arguments.length?(o=null==t?null:t,a):o},a},t.nest=function(){var t,n,e,r=[],i=[];function o(e,i,a,u){if(i>=r.length)return null!=t&&e.sort(t),null!=n?n(e):e;for(var c,f,s,l=-1,h=e.length,d=r[i++],p=Ji(),v=a();++l<h;)(s=p.get(c=d(f=e[l])+""))?s.push(f):p.set(c,[f]);return p.each(function(t,n){u(v,n,o(t,i,a,u))}),v}return e={object:function(t){return o(t,0,Ki,to)},map:function(t){return o(t,0,no,eo)},entries:function(t){return function t(e,o){if(++o>r.length)return e;var a,u=i[o-1];return null!=n&&o>=r.length?a=e.entries():(a=[],e.each(function(n,e){a.push({key:e,values:t(n,o)})})),null!=u?a.sort(function(t,n){return u(t.key,n.key)}):a}(o(t,0,no,eo),0)},key:function(t){return r.push(t),e},sortKeys:function(t){return i[r.length-1]=t,e},sortValues:function(n){return t=n,e},rollup:function(t){return n=t,e}}},t.set=oo,t.map=Ji,t.keys=function(t){var n=[];for(var e in t)n.push(e);return n},t.values=function(t){var n=[];for(var e in t)n.push(t[e]);return n},t.entries=function(t){var n=[];for(var e in t)n.push({key:e,value:t[e]});return n},t.color=hn,t.rgb=gn,t.hsl=mn,t.lab=Rn,t.hcl=Yn,t.lch=function(t,n,e,r){return 1===arguments.length?Bn(t):new Fn(e,n,t,null==r?1:r)},t.gray=function(t,n){return new Dn(t,0,0,null==n?1:n)},t.cubehelix=Qn,t.contours=vo,t.contourDensity=function(){var t=_o,n=bo,e=mo,r=960,i=500,o=20,a=2,u=3*o,c=r+2*u>>a,f=i+2*u>>a,s=co(20);function l(r){var i=new Float32Array(c*f),l=new Float32Array(c*f);r.forEach(function(r,o,s){var l=+t(r,o,s)+u>>a,h=+n(r,o,s)+u>>a,d=+e(r,o,s);l>=0&&l<c&&h>=0&&h<f&&(i[l+h*c]+=d)}),go({width:c,height:f,data:i},{width:c,height:f,data:l},o>>a),yo({width:c,height:f,data:l},{width:c,height:f,data:i},o>>a),go({width:c,height:f,data:i},{width:c,height:f,data:l},o>>a),yo({width:c,height:f,data:l},{width:c,height:f,data:i},o>>a),go({width:c,height:f,data:i},{width:c,height:f,data:l},o>>a),yo({width:c,height:f,data:l},{width:c,height:f,data:i},o>>a);var d=s(i);if(!Array.isArray(d)){var p=A(i);d=w(0,p,d),(d=g(0,Math.floor(p/d)*d,d)).shift()}return vo().thresholds(d).size([c,f])(i).map(h)}function h(t){return t.value*=Math.pow(2,-2*a),t.coordinates.forEach(d),t}function d(t){t.forEach(p)}function p(t){t.forEach(v)}function v(t){t[0]=t[0]*Math.pow(2,a)-u,t[1]=t[1]*Math.pow(2,a)-u}function y(){return c=r+2*(u=3*o)>>a,f=i+2*u>>a,l}return l.x=function(n){return arguments.length?(t="function"==typeof n?n:co(+n),l):t},l.y=function(t){return arguments.length?(n="function"==typeof t?t:co(+t),l):n},l.weight=function(t){return arguments.length?(e="function"==typeof t?t:co(+t),l):e},l.size=function(t){if(!arguments.length)return[r,i];var n=Math.ceil(t[0]),e=Math.ceil(t[1]);if(!(n>=0||n>=0))throw new Error("invalid size");return r=n,i=e,y()},l.cellSize=function(t){if(!arguments.length)return 1<<a;if(!((t=+t)>=1))throw new Error("invalid cell size");return a=Math.floor(Math.log(t)/Math.LN2),y()},l.thresholds=function(t){return arguments.length?(s="function"==typeof t?t:Array.isArray(t)?co(ao.call(t)):co(t),l):s},l.bandwidth=function(t){if(!arguments.length)return Math.sqrt(o*(o+1));if(!((t=+t)>=0))throw new Error("invalid bandwidth");return o=Math.round((Math.sqrt(4*t*t+1)-1)/2),y()},l},t.dispatch=I,t.drag=function(){var n,e,r,i,o=Gt,a=Vt,u=$t,c=Wt,f={},s=I("start","drag","end"),l=0,h=0;function d(t){t.on("mousedown.drag",p).filter(c).on("touchstart.drag",y).on("touchmove.drag",_).on("touchend.drag touchcancel.drag",b).style("touch-action","none").style("-webkit-tap-highlight-color","rgba(0,0,0,0)")}function p(){if(!i&&o.apply(this,arguments)){var u=m("mouse",a.apply(this,arguments),Ot,this,arguments);u&&(zt(t.event.view).on("mousemove.drag",v,!0).on("mouseup.drag",g,!0),It(t.event.view),Yt(),r=!1,n=t.event.clientX,e=t.event.clientY,u("start"))}}function v(){if(Ft(),!r){var i=t.event.clientX-n,o=t.event.clientY-e;r=i*i+o*o>h}f.mouse("drag")}function g(){zt(t.event.view).on("mousemove.drag mouseup.drag",null),jt(t.event.view,r),Ft(),f.mouse("end")}function y(){if(o.apply(this,arguments)){var n,e,r=t.event.changedTouches,i=a.apply(this,arguments),u=r.length;for(n=0;n<u;++n)(e=m(r[n].identifier,i,Bt,this,arguments))&&(Yt(),e("start"))}}function _(){var n,e,r=t.event.changedTouches,i=r.length;for(n=0;n<i;++n)(e=f[r[n].identifier])&&(Ft(),e("drag"))}function b(){var n,e,r=t.event.changedTouches,o=r.length;for(i&&clearTimeout(i),i=setTimeout(function(){i=null},500),n=0;n<o;++n)(e=f[r[n].identifier])&&(Yt(),e("end"))}function m(n,e,r,i,o){var a,c,h,p=r(e,n),v=s.copy();if(St(new Xt(d,"beforestart",a,n,l,p[0],p[1],0,0,v),function(){return null!=(t.event.subject=a=u.apply(i,o))&&(c=a.x-p[0]||0,h=a.y-p[1]||0,!0)}))return function t(u){var s,g=p;switch(u){case"start":f[n]=t,s=l++;break;case"end":delete f[n],--l;case"drag":p=r(e,n),s=l}St(new Xt(d,u,a,n,s,p[0]+c,p[1]+h,p[0]-g[0],p[1]-g[1],v),v.apply,v,[u,i,o])}}return d.filter=function(t){return arguments.length?(o="function"==typeof t?t:Ht(!!t),d):o},d.container=function(t){return arguments.length?(a="function"==typeof t?t:Ht(t),d):a},d.subject=function(t){return arguments.length?(u="function"==typeof t?t:Ht(t),d):u},d.touchable=function(t){return arguments.length?(c="function"==typeof t?t:Ht(!!t),d):c},d.on=function(){var t=s.on.apply(s,arguments);return t===s?d:t},d.clickDistance=function(t){return arguments.length?(h=(t=+t)*t,d):Math.sqrt(h)},d},t.dragDisable=It,t.dragEnable=jt,t.dsvFormat=Co,t.csvParse=zo,t.csvParseRows=Ro,t.csvFormat=Do,t.csvFormatBody=qo,t.csvFormatRows=Lo,t.tsvParse=Oo,t.tsvParseRows=Bo,t.tsvFormat=Yo,t.tsvFormatBody=Fo,t.tsvFormatRows=Io,t.autoType=function(t){for(var n in t){var e,r=t[n].trim();if(r)if("true"===r)r=!0;else if("false"===r)r=!1;else if("NaN"===r)r=NaN;else if(isNaN(e=+r)){if(!/^([-+]\d{2})?\d{4}(-\d{2}(-\d{2})?)?(T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?(Z|[-+]\d{2}:\d{2})?)?$/.test(r))continue;r=new Date(r)}else r=e;else r=null;t[n]=r}return t},t.easeLinear=function(t){return+t},t.easeQuad=Dr,t.easeQuadIn=function(t){return t*t},t.easeQuadOut=function(t){return t*(2-t)},t.easeQuadInOut=Dr,t.easeCubic=qr,t.easeCubicIn=function(t){return t*t*t},t.easeCubicOut=function(t){return--t*t*t+1},t.easeCubicInOut=qr,t.easePoly=Or,t.easePolyIn=Lr,t.easePolyOut=Ur,t.easePolyInOut=Or,t.easeSin=Fr,t.easeSinIn=function(t){return 1-Math.cos(t*Yr)},t.easeSinOut=function(t){return Math.sin(t*Yr)},t.easeSinInOut=Fr,t.easeExp=Ir,t.easeExpIn=function(t){return Math.pow(2,10*t-10)},t.easeExpOut=function(t){return 1-Math.pow(2,-10*t)},t.easeExpInOut=Ir,t.easeCircle=jr,t.easeCircleIn=function(t){return 1-Math.sqrt(1-t*t)},t.easeCircleOut=function(t){return Math.sqrt(1- --t*t)},t.easeCircleInOut=jr,t.easeBounce=ti,t.easeBounceIn=function(t){return 1-ti(1-t)},t.easeBounceOut=ti,t.easeBounceInOut=function(t){return((t*=2)<=1?1-ti(1-t):ti(t-1)+1)/2},t.easeBack=ri,t.easeBackIn=ni,t.easeBackOut=ei,t.easeBackInOut=ri,t.easeElastic=ai,t.easeElasticIn=oi,t.easeElasticOut=ai,t.easeElasticInOut=ui,t.blob=function(t,n){return fetch(t,n).then(jo)},t.buffer=function(t,n){return fetch(t,n).then(Ho)},t.dsv=function(t,n,e,r){3===arguments.length&&"function"==typeof e&&(r=e,e=void 0);var i=Co(t);return Go(n,e).then(function(t){return i.parse(t,r)})},t.csv=$o,t.tsv=Wo,t.image=function(t,n){return new Promise(function(e,r){var i=new Image;for(var o in n)i[o]=n[o];i.onerror=r,i.onload=function(){e(i)},i.src=t})},t.json=function(t,n){return fetch(t,n).then(Zo)},t.text=Go,t.xml=Jo,t.html=Ko,t.svg=ta,t.forceCenter=function(t,n){var e;function r(){var r,i,o=e.length,a=0,u=0;for(r=0;r<o;++r)a+=(i=e[r]).x,u+=i.y;for(a=a/o-t,u=u/o-n,r=0;r<o;++r)(i=e[r]).x-=a,i.y-=u}return null==t&&(t=0),null==n&&(n=0),r.initialize=function(t){e=t},r.x=function(n){return arguments.length?(t=+n,r):t},r.y=function(t){return arguments.length?(n=+t,r):n},r},t.forceCollide=function(t){var n,e,r=1,i=1;function o(){for(var t,o,u,c,f,s,l,h=n.length,d=0;d<i;++d)for(o=ua(n,la,ha).visitAfter(a),t=0;t<h;++t)u=n[t],s=e[u.index],l=s*s,c=u.x+u.vx,f=u.y+u.vy,o.visit(p);function p(t,n,e,i,o){var a=t.data,h=t.r,d=s+h;if(!a)return n>c+d||i<c-d||e>f+d||o<f-d;if(a.index>u.index){var p=c-a.x-a.vx,v=f-a.y-a.vy,g=p*p+v*v;g<d*d&&(0===p&&(g+=(p=ea())*p),0===v&&(g+=(v=ea())*v),g=(d-(g=Math.sqrt(g)))/g*r,u.vx+=(p*=g)*(d=(h*=h)/(l+h)),u.vy+=(v*=g)*d,a.vx-=p*(d=1-d),a.vy-=v*d)}}}function a(t){if(t.data)return t.r=e[t.data.index];for(var n=t.r=0;n<4;++n)t[n]&&t[n].r>t.r&&(t.r=t[n].r)}function u(){if(n){var r,i,o=n.length;for(e=new Array(o),r=0;r<o;++r)i=n[r],e[i.index]=+t(i,r,n)}}return"function"!=typeof t&&(t=na(null==t?1:+t)),o.initialize=function(t){n=t,u()},o.iterations=function(t){return arguments.length?(i=+t,o):i},o.strength=function(t){return arguments.length?(r=+t,o):r},o.radius=function(n){return arguments.length?(t="function"==typeof n?n:na(+n),u(),o):t},o},t.forceLink=function(t){var n,e,r,i,o,a=da,u=function(t){return 1/Math.min(i[t.source.index],i[t.target.index])},c=na(30),f=1;function s(r){for(var i=0,a=t.length;i<f;++i)for(var u,c,s,l,h,d,p,v=0;v<a;++v)c=(u=t[v]).source,l=(s=u.target).x+s.vx-c.x-c.vx||ea(),h=s.y+s.vy-c.y-c.vy||ea(),l*=d=((d=Math.sqrt(l*l+h*h))-e[v])/d*r*n[v],h*=d,s.vx-=l*(p=o[v]),s.vy-=h*p,c.vx+=l*(p=1-p),c.vy+=h*p}function l(){if(r){var u,c,f=r.length,s=t.length,l=Ji(r,a);for(u=0,i=new Array(f);u<s;++u)(c=t[u]).index=u,"object"!=typeof c.source&&(c.source=pa(l,c.source)),"object"!=typeof c.target&&(c.target=pa(l,c.target)),i[c.source.index]=(i[c.source.index]||0)+1,i[c.target.index]=(i[c.target.index]||0)+1;for(u=0,o=new Array(s);u<s;++u)c=t[u],o[u]=i[c.source.index]/(i[c.source.index]+i[c.target.index]);n=new Array(s),h(),e=new Array(s),d()}}function h(){if(r)for(var e=0,i=t.length;e<i;++e)n[e]=+u(t[e],e,t)}function d(){if(r)for(var n=0,i=t.length;n<i;++n)e[n]=+c(t[n],n,t)}return null==t&&(t=[]),s.initialize=function(t){r=t,l()},s.links=function(n){return arguments.length?(t=n,l(),s):t},s.id=function(t){return arguments.length?(a=t,s):a},s.iterations=function(t){return arguments.length?(f=+t,s):f},s.strength=function(t){return arguments.length?(u="function"==typeof t?t:na(+t),h(),s):u},s.distance=function(t){return arguments.length?(c="function"==typeof t?t:na(+t),d(),s):c},s},t.forceManyBody=function(){var t,n,e,r,i=na(-30),o=1,a=1/0,u=.81;function c(r){var i,o=t.length,a=ua(t,va,ga).visitAfter(s);for(e=r,i=0;i<o;++i)n=t[i],a.visit(l)}function f(){if(t){var n,e,o=t.length;for(r=new Array(o),n=0;n<o;++n)e=t[n],r[e.index]=+i(e,n,t)}}function s(t){var n,e,i,o,a,u=0,c=0;if(t.length){for(i=o=a=0;a<4;++a)(n=t[a])&&(e=Math.abs(n.value))&&(u+=n.value,c+=e,i+=e*n.x,o+=e*n.y);t.x=i/c,t.y=o/c}else{(n=t).x=n.data.x,n.y=n.data.y;do{u+=r[n.data.index]}while(n=n.next)}t.value=u}function l(t,i,c,f){if(!t.value)return!0;var s=t.x-n.x,l=t.y-n.y,h=f-i,d=s*s+l*l;if(h*h/u<d)return d<a&&(0===s&&(d+=(s=ea())*s),0===l&&(d+=(l=ea())*l),d<o&&(d=Math.sqrt(o*d)),n.vx+=s*t.value*e/d,n.vy+=l*t.value*e/d),!0;if(!(t.length||d>=a)){(t.data!==n||t.next)&&(0===s&&(d+=(s=ea())*s),0===l&&(d+=(l=ea())*l),d<o&&(d=Math.sqrt(o*d)));do{t.data!==n&&(h=r[t.data.index]*e/d,n.vx+=s*h,n.vy+=l*h)}while(t=t.next)}}return c.initialize=function(n){t=n,f()},c.strength=function(t){return arguments.length?(i="function"==typeof t?t:na(+t),f(),c):i},c.distanceMin=function(t){return arguments.length?(o=t*t,c):Math.sqrt(o)},c.distanceMax=function(t){return arguments.length?(a=t*t,c):Math.sqrt(a)},c.theta=function(t){return arguments.length?(u=t*t,c):Math.sqrt(u)},c},t.forceRadial=function(t,n,e){var r,i,o,a=na(.1);function u(t){for(var a=0,u=r.length;a<u;++a){var c=r[a],f=c.x-n||1e-6,s=c.y-e||1e-6,l=Math.sqrt(f*f+s*s),h=(o[a]-l)*i[a]*t/l;c.vx+=f*h,c.vy+=s*h}}function c(){if(r){var n,e=r.length;for(i=new Array(e),o=new Array(e),n=0;n<e;++n)o[n]=+t(r[n],n,r),i[n]=isNaN(o[n])?0:+a(r[n],n,r)}}return"function"!=typeof t&&(t=na(+t)),null==n&&(n=0),null==e&&(e=0),u.initialize=function(t){r=t,c()},u.strength=function(t){return arguments.length?(a="function"==typeof t?t:na(+t),c(),u):a},u.radius=function(n){return arguments.length?(t="function"==typeof n?n:na(+n),c(),u):t},u.x=function(t){return arguments.length?(n=+t,u):n},u.y=function(t){return arguments.length?(e=+t,u):e},u},t.forceSimulation=function(t){var n,e=1,r=.001,i=1-Math.pow(r,1/300),o=0,a=.6,u=Ji(),c=or(s),f=I("tick","end");function s(){l(),f.call("tick",n),e<r&&(c.stop(),f.call("end",n))}function l(r){var c,f,s=t.length;void 0===r&&(r=1);for(var l=0;l<r;++l)for(e+=(o-e)*i,u.each(function(t){t(e)}),c=0;c<s;++c)null==(f=t[c]).fx?f.x+=f.vx*=a:(f.x=f.fx,f.vx=0),null==f.fy?f.y+=f.vy*=a:(f.y=f.fy,f.vy=0);return n}function h(){for(var n,e=0,r=t.length;e<r;++e){if((n=t[e]).index=e,null!=n.fx&&(n.x=n.fx),null!=n.fy&&(n.y=n.fy),isNaN(n.x)||isNaN(n.y)){var i=ya*Math.sqrt(e),o=e*_a;n.x=i*Math.cos(o),n.y=i*Math.sin(o)}(isNaN(n.vx)||isNaN(n.vy))&&(n.vx=n.vy=0)}}function d(n){return n.initialize&&n.initialize(t),n}return null==t&&(t=[]),h(),n={tick:l,restart:function(){return c.restart(s),n},stop:function(){return c.stop(),n},nodes:function(e){return arguments.length?(t=e,h(),u.each(d),n):t},alpha:function(t){return arguments.length?(e=+t,n):e},alphaMin:function(t){return arguments.length?(r=+t,n):r},alphaDecay:function(t){return arguments.length?(i=+t,n):+i},alphaTarget:function(t){return arguments.length?(o=+t,n):o},velocityDecay:function(t){return arguments.length?(a=1-t,n):1-a},force:function(t,e){return arguments.length>1?(null==e?u.remove(t):u.set(t,d(e)),n):u.get(t)},find:function(n,e,r){var i,o,a,u,c,f=0,s=t.length;for(null==r?r=1/0:r*=r,f=0;f<s;++f)(a=(i=n-(u=t[f]).x)*i+(o=e-u.y)*o)<r&&(c=u,r=a);return c},on:function(t,e){return arguments.length>1?(f.on(t,e),n):f.on(t)}}},t.forceX=function(t){var n,e,r,i=na(.1);function o(t){for(var i,o=0,a=n.length;o<a;++o)(i=n[o]).vx+=(r[o]-i.x)*e[o]*t}function a(){if(n){var o,a=n.length;for(e=new Array(a),r=new Array(a),o=0;o<a;++o)e[o]=isNaN(r[o]=+t(n[o],o,n))?0:+i(n[o],o,n)}}return"function"!=typeof t&&(t=na(null==t?0:+t)),o.initialize=function(t){n=t,a()},o.strength=function(t){return arguments.length?(i="function"==typeof t?t:na(+t),a(),o):i},o.x=function(n){return arguments.length?(t="function"==typeof n?n:na(+n),a(),o):t},o},t.forceY=function(t){var n,e,r,i=na(.1);function o(t){for(var i,o=0,a=n.length;o<a;++o)(i=n[o]).vy+=(r[o]-i.y)*e[o]*t}function a(){if(n){var o,a=n.length;for(e=new Array(a),r=new Array(a),o=0;o<a;++o)e[o]=isNaN(r[o]=+t(n[o],o,n))?0:+i(n[o],o,n)}}return"function"!=typeof t&&(t=na(null==t?0:+t)),o.initialize=function(t){n=t,a()},o.strength=function(t){return arguments.length?(i="function"==typeof t?t:na(+t),a(),o):i},o.y=function(n){return arguments.length?(t="function"==typeof n?n:na(+n),a(),o):t},o},t.formatDefaultLocale=Pa,t.formatLocale=Ca,t.formatSpecifier=Ma,t.precisionFixed=za,t.precisionPrefix=Ra,t.precisionRound=Da,t.geoArea=function(t){return xu.reset(),pu(t,wu),2*xu},t.geoBounds=function(t){var n,e,r,i,o,a,u;if(Uu=Lu=-(Du=qu=1/0),Iu=[],pu(t,uc),e=Iu.length){for(Iu.sort(gc),n=1,o=[r=Iu[0]];n<e;++n)yc(r,(i=Iu[n])[0])||yc(r,i[1])?(vc(r[0],i[1])>vc(r[0],r[1])&&(r[1]=i[1]),vc(i[0],r[1])>vc(r[0],r[1])&&(r[0]=i[0])):o.push(r=i);for(a=-1/0,n=0,r=o[e=o.length-1];n<=e;r=i,++n)i=o[n],(u=vc(r[1],i[0]))>a&&(a=u,Du=i[0],Lu=r[1])}return Iu=ju=null,Du===1/0||qu===1/0?[[NaN,NaN],[NaN,NaN]]:[[Du,qu],[Lu,Uu]]},t.geoCentroid=function(t){Hu=Xu=Gu=Vu=$u=Wu=Zu=Qu=Ju=Ku=tc=0,pu(t,_c);var n=Ju,e=Ku,r=tc,i=n*n+e*e+r*r;return i<Ya&&(n=Wu,e=Zu,r=Qu,Xu<Ba&&(n=Gu,e=Vu,r=$u),(i=n*n+e*e+r*r)<Ya)?[NaN,NaN]:[Wa(e,n)*Xa,au(r/ru(i))*Xa]},t.geoCircle=function(){var t,n,e=Ec([0,0]),r=Ec(90),i=Ec(6),o={point:function(e,r){t.push(e=n(e,r)),e[0]*=Xa,e[1]*=Xa}};function a(){var a=e.apply(this,arguments),u=r.apply(this,arguments)*Ga,c=i.apply(this,arguments)*Ga;return t=[],n=zc(-a[0]*Ga,-a[1]*Ga,0).invert,Uc(o,u,c,1),a={type:"Polygon",coordinates:[t]},t=n=null,a}return a.center=function(t){return arguments.length?(e="function"==typeof t?t:Ec([+t[0],+t[1]]),a):e},a.radius=function(t){return arguments.length?(r="function"==typeof t?t:Ec(+t),a):r},a.precision=function(t){return arguments.length?(i="function"==typeof t?t:Ec(+t),a):i},a},t.geoClipAntimeridian=Zc,t.geoClipCircle=Qc,t.geoClipExtent=function(){var t,n,e,r=0,i=0,o=960,a=500;return e={stream:function(e){return t&&n===e?t:t=tf(r,i,o,a)(n=e)},extent:function(u){return arguments.length?(r=+u[0][0],i=+u[0][1],o=+u[1][0],a=+u[1][1],t=n=null,e):[[r,i],[o,a]]}}},t.geoClipRectangle=tf,t.geoContains=function(t,n){return(t&&pf.hasOwnProperty(t.type)?pf[t.type]:gf)(t,n)},t.geoDistance=df,t.geoGraticule=Nf,t.geoGraticule10=function(){return Nf()()},t.geoInterpolate=function(t,n){var e=t[0]*Ga,r=t[1]*Ga,i=n[0]*Ga,o=n[1]*Ga,a=Za(r),u=nu(r),c=Za(o),f=nu(o),s=a*Za(e),l=a*nu(e),h=c*Za(i),d=c*nu(i),p=2*au(ru(uu(o-r)+a*c*uu(i-e))),v=nu(p),g=p?function(t){var n=nu(t*=p)/v,e=nu(p-t)/v,r=e*s+n*h,i=e*l+n*d,o=e*u+n*f;return[Wa(i,r)*Xa,Wa(o,ru(r*r+i*i))*Xa]}:function(){return[e*Xa,r*Xa]};return g.distance=p,g},t.geoLength=sf,t.geoPath=function(t,n){var e,r,i=4.5;function o(t){return t&&("function"==typeof i&&r.pointRadius(+i.apply(this,arguments)),pu(t,e(r))),r.result()}return o.area=function(t){return pu(t,e(zf)),zf.result()},o.measure=function(t){return pu(t,e(_s)),_s.result()},o.bounds=function(t){return pu(t,e(Ff)),Ff.result()},o.centroid=function(t){return pu(t,e(ns)),ns.result()},o.projection=function(n){return arguments.length?(e=null==n?(t=null,Af):(t=n).stream,o):t},o.context=function(t){return arguments.length?(r=null==t?(n=null,new xs):new ls(n=t),"function"!=typeof i&&r.pointRadius(i),o):n},o.pointRadius=function(t){return arguments.length?(i="function"==typeof t?t:(r.pointRadius(+t),+t),o):i},o.projection(t).context(n)},t.geoAlbers=Ys,t.geoAlbersUsa=function(){var t,n,e,r,i,o,a=Ys(),u=Bs().rotate([154,0]).center([-2,58.5]).parallels([55,65]),c=Bs().rotate([157,0]).center([-3,19.9]).parallels([8,18]),f={point:function(t,n){o=[t,n]}};function s(t){var n=t[0],a=t[1];return o=null,e.point(n,a),o||(r.point(n,a),o)||(i.point(n,a),o)}function l(){return t=n=null,s}return s.invert=function(t){var n=a.scale(),e=a.translate(),r=(t[0]-e[0])/n,i=(t[1]-e[1])/n;return(i>=.12&&i<.234&&r>=-.425&&r<-.214?u:i>=.166&&i<.234&&r>=-.214&&r<-.115?c:a).invert(t)},s.stream=function(e){return t&&n===e?t:(r=[a.stream(n=e),u.stream(e),c.stream(e)],i=r.length,t={point:function(t,n){for(var e=-1;++e<i;)r[e].point(t,n)},sphere:function(){for(var t=-1;++t<i;)r[t].sphere()},lineStart:function(){for(var t=-1;++t<i;)r[t].lineStart()},lineEnd:function(){for(var t=-1;++t<i;)r[t].lineEnd()},polygonStart:function(){for(var t=-1;++t<i;)r[t].polygonStart()},polygonEnd:function(){for(var t=-1;++t<i;)r[t].polygonEnd()}});var r,i},s.precision=function(t){return arguments.length?(a.precision(t),u.precision(t),c.precision(t),l()):a.precision()},s.scale=function(t){return arguments.length?(a.scale(t),u.scale(.35*t),c.scale(t),s.translate(a.translate())):a.scale()},s.translate=function(t){if(!arguments.length)return a.translate();var n=a.scale(),o=+t[0],s=+t[1];return e=a.translate(t).clipExtent([[o-.455*n,s-.238*n],[o+.455*n,s+.238*n]]).stream(f),r=u.translate([o-.307*n,s+.201*n]).clipExtent([[o-.425*n+Ba,s+.12*n+Ba],[o-.214*n-Ba,s+.234*n-Ba]]).stream(f),i=c.translate([o-.205*n,s+.212*n]).clipExtent([[o-.214*n+Ba,s+.166*n+Ba],[o-.115*n-Ba,s+.234*n-Ba]]).stream(f),l()},s.fitExtent=function(t,n){return Ts(s,t,n)},s.fitSize=function(t,n){return Ss(s,t,n)},s.fitWidth=function(t,n){return ks(s,t,n)},s.fitHeight=function(t,n){return Es(s,t,n)},s.scale(1070)},t.geoAzimuthalEqualArea=function(){return qs(js).scale(124.75).clipAngle(179.999)},t.geoAzimuthalEqualAreaRaw=js,t.geoAzimuthalEquidistant=function(){return qs(Hs).scale(79.4188).clipAngle(179.999)},t.geoAzimuthalEquidistantRaw=Hs,t.geoConicConformal=function(){return Us($s).scale(109.5).parallels([30,30])},t.geoConicConformalRaw=$s,t.geoConicEqualArea=Bs,t.geoConicEqualAreaRaw=Os,t.geoConicEquidistant=function(){return Us(Zs).scale(131.154).center([0,13.9389])},t.geoConicEquidistantRaw=Zs,t.geoEqualEarth=function(){return qs(el).scale(177.158)},t.geoEqualEarthRaw=el,t.geoEquirectangular=function(){return qs(Ws).scale(152.63)},t.geoEquirectangularRaw=Ws,t.geoGnomonic=function(){return qs(rl).scale(144.049).clipAngle(60)},t.geoGnomonicRaw=rl,t.geoIdentity=function(){var t,n,e,r,i,o,a=1,u=0,c=0,f=1,s=1,l=Af,h=null,d=Af;function p(){return r=i=null,o}return o={stream:function(t){return r&&i===t?r:r=l(d(i=t))},postclip:function(r){return arguments.length?(d=r,h=t=n=e=null,p()):d},clipExtent:function(r){return arguments.length?(d=null==r?(h=t=n=e=null,Af):tf(h=+r[0][0],t=+r[0][1],n=+r[1][0],e=+r[1][1]),p()):null==h?null:[[h,t],[n,e]]},scale:function(t){return arguments.length?(l=il((a=+t)*f,a*s,u,c),p()):a},translate:function(t){return arguments.length?(l=il(a*f,a*s,u=+t[0],c=+t[1]),p()):[u,c]},reflectX:function(t){return arguments.length?(l=il(a*(f=t?-1:1),a*s,u,c),p()):f<0},reflectY:function(t){return arguments.length?(l=il(a*f,a*(s=t?-1:1),u,c),p()):s<0},fitExtent:function(t,n){return Ts(o,t,n)},fitSize:function(t,n){return Ss(o,t,n)},fitWidth:function(t,n){return ks(o,t,n)},fitHeight:function(t,n){return Es(o,t,n)}}},t.geoProjection=qs,t.geoProjectionMutator=Ls,t.geoMercator=function(){return Gs(Xs).scale(961/Ha)},t.geoMercatorRaw=Xs,t.geoNaturalEarth1=function(){return qs(ol).scale(175.295)},t.geoNaturalEarth1Raw=ol,t.geoOrthographic=function(){return qs(al).scale(249.5).clipAngle(90+Ba)},t.geoOrthographicRaw=al,t.geoStereographic=function(){return qs(ul).scale(250).clipAngle(142)},t.geoStereographicRaw=ul,t.geoTransverseMercator=function(){var t=Gs(cl),n=t.center,e=t.rotate;return t.center=function(t){return arguments.length?n([-t[1],t[0]]):[(t=n())[1],-t[0]]},t.rotate=function(t){return arguments.length?e([t[0],t[1],t.length>2?t[2]+90:90]):[(t=e())[0],t[1],t[2]-90]},e([0,0,90]).scale(159.155)},t.geoTransverseMercatorRaw=cl,t.geoRotation=Lc,t.geoStream=pu,t.geoTransform=function(t){return{stream:Ms(t)}},t.cluster=function(){var t=fl,n=1,e=1,r=!1;function i(i){var o,a=0;i.eachAfter(function(n){var e=n.children;e?(n.x=function(t){return t.reduce(sl,0)/t.length}(e),n.y=function(t){return 1+t.reduce(ll,0)}(e)):(n.x=o?a+=t(n,o):0,n.y=0,o=n)});var u=function(t){for(var n;n=t.children;)t=n[0];return t}(i),c=function(t){for(var n;n=t.children;)t=n[n.length-1];return t}(i),f=u.x-t(u,c)/2,s=c.x+t(c,u)/2;return i.eachAfter(r?function(t){t.x=(t.x-i.x)*n,t.y=(i.y-t.y)*e}:function(t){t.x=(t.x-f)/(s-f)*n,t.y=(1-(i.y?t.y/i.y:1))*e})}return i.separation=function(n){return arguments.length?(t=n,i):t},i.size=function(t){return arguments.length?(r=!1,n=+t[0],e=+t[1],i):r?null:[n,e]},i.nodeSize=function(t){return arguments.length?(r=!0,n=+t[0],e=+t[1],i):r?[n,e]:null},i},t.hierarchy=dl,t.pack=function(){var t=null,n=1,e=1,r=Rl;function i(i){return i.x=n/2,i.y=e/2,t?i.eachBefore(Ll(t)).eachAfter(Ul(r,.5)).eachBefore(Ol(1)):i.eachBefore(Ll(ql)).eachAfter(Ul(Rl,1)).eachAfter(Ul(r,i.r/Math.min(n,e))).eachBefore(Ol(Math.min(n,e)/(2*i.r))),i}return i.radius=function(n){return arguments.length?(t=null==(e=n)?null:zl(e),i):t;var e},i.size=function(t){return arguments.length?(n=+t[0],e=+t[1],i):[n,e]},i.padding=function(t){return arguments.length?(r="function"==typeof t?t:Dl(+t),i):r},i},t.packSiblings=function(t){return Pl(t),t},t.packEnclose=bl,t.partition=function(){var t=1,n=1,e=0,r=!1;function i(i){var o=i.height+1;return i.x0=i.y0=e,i.x1=t,i.y1=n/o,i.eachBefore(function(t,n){return function(r){r.children&&Yl(r,r.x0,t*(r.depth+1)/n,r.x1,t*(r.depth+2)/n);var i=r.x0,o=r.y0,a=r.x1-e,u=r.y1-e;a<i&&(i=a=(i+a)/2),u<o&&(o=u=(o+u)/2),r.x0=i,r.y0=o,r.x1=a,r.y1=u}}(n,o)),r&&i.eachBefore(Bl),i}return i.round=function(t){return arguments.length?(r=!!t,i):r},i.size=function(e){return arguments.length?(t=+e[0],n=+e[1],i):[t,n]},i.padding=function(t){return arguments.length?(e=+t,i):e},i},t.stratify=function(){var t=Hl,n=Xl;function e(e){var r,i,o,a,u,c,f,s=e.length,l=new Array(s),h={};for(i=0;i<s;++i)r=e[i],u=l[i]=new yl(r),null!=(c=t(r,i,e))&&(c+="")&&(h[f=Fl+(u.id=c)]=f in h?jl:u);for(i=0;i<s;++i)if(u=l[i],null!=(c=n(e[i],i,e))&&(c+="")){if(!(a=h[Fl+c]))throw new Error("missing: "+c);if(a===jl)throw new Error("ambiguous: "+c);a.children?a.children.push(u):a.children=[u],u.parent=a}else{if(o)throw new Error("multiple roots");o=u}if(!o)throw new Error("no root");if(o.parent=Il,o.eachBefore(function(t){t.depth=t.parent.depth+1,--s}).eachBefore(gl),o.parent=null,s>0)throw new Error("cycle");return o}return e.id=function(n){return arguments.length?(t=zl(n),e):t},e.parentId=function(t){return arguments.length?(n=zl(t),e):n},e},t.tree=function(){var t=Gl,n=1,e=1,r=null;function i(i){var c=function(t){for(var n,e,r,i,o,a=new Ql(t,0),u=[a];n=u.pop();)if(r=n._.children)for(n.children=new Array(o=r.length),i=o-1;i>=0;--i)u.push(e=n.children[i]=new Ql(r[i],i)),e.parent=n;return(a.parent=new Ql(null,0)).children=[a],a}(i);if(c.eachAfter(o),c.parent.m=-c.z,c.eachBefore(a),r)i.eachBefore(u);else{var f=i,s=i,l=i;i.eachBefore(function(t){t.x<f.x&&(f=t),t.x>s.x&&(s=t),t.depth>l.depth&&(l=t)});var h=f===s?1:t(f,s)/2,d=h-f.x,p=n/(s.x+h+d),v=e/(l.depth||1);i.eachBefore(function(t){t.x=(t.x+d)*p,t.y=t.depth*v})}return i}function o(n){var e=n.children,r=n.parent.children,i=n.i?r[n.i-1]:null;if(e){!function(t){for(var n,e=0,r=0,i=t.children,o=i.length;--o>=0;)(n=i[o]).z+=e,n.m+=e,e+=n.s+(r+=n.c)}(n);var o=(e[0].z+e[e.length-1].z)/2;i?(n.z=i.z+t(n._,i._),n.m=n.z-o):n.z=o}else i&&(n.z=i.z+t(n._,i._));n.parent.A=function(n,e,r){if(e){for(var i,o=n,a=n,u=e,c=o.parent.children[0],f=o.m,s=a.m,l=u.m,h=c.m;u=$l(u),o=Vl(o),u&&o;)c=Vl(c),(a=$l(a)).a=n,(i=u.z+l-o.z-f+t(u._,o._))>0&&(Wl(Zl(u,n,r),n,i),f+=i,s+=i),l+=u.m,f+=o.m,h+=c.m,s+=a.m;u&&!$l(a)&&(a.t=u,a.m+=l-s),o&&!Vl(c)&&(c.t=o,c.m+=f-h,r=n)}return r}(n,i,n.parent.A||r[0])}function a(t){t._.x=t.z+t.parent.m,t.m+=t.parent.m}function u(t){t.x*=n,t.y=t.depth*e}return i.separation=function(n){return arguments.length?(t=n,i):t},i.size=function(t){return arguments.length?(r=!1,n=+t[0],e=+t[1],i):r?null:[n,e]},i.nodeSize=function(t){return arguments.length?(r=!0,n=+t[0],e=+t[1],i):r?[n,e]:null},i},t.treemap=function(){var t=nh,n=!1,e=1,r=1,i=[0],o=Rl,a=Rl,u=Rl,c=Rl,f=Rl;function s(t){return t.x0=t.y0=0,t.x1=e,t.y1=r,t.eachBefore(l),i=[0],n&&t.eachBefore(Bl),t}function l(n){var e=i[n.depth],r=n.x0+e,s=n.y0+e,l=n.x1-e,h=n.y1-e;l<r&&(r=l=(r+l)/2),h<s&&(s=h=(s+h)/2),n.x0=r,n.y0=s,n.x1=l,n.y1=h,n.children&&(e=i[n.depth+1]=o(n)/2,r+=f(n)-e,s+=a(n)-e,(l-=u(n)-e)<r&&(r=l=(r+l)/2),(h-=c(n)-e)<s&&(s=h=(s+h)/2),t(n,r,s,l,h))}return s.round=function(t){return arguments.length?(n=!!t,s):n},s.size=function(t){return arguments.length?(e=+t[0],r=+t[1],s):[e,r]},s.tile=function(n){return arguments.length?(t=zl(n),s):t},s.padding=function(t){return arguments.length?s.paddingInner(t).paddingOuter(t):s.paddingInner()},s.paddingInner=function(t){return arguments.length?(o="function"==typeof t?t:Dl(+t),s):o},s.paddingOuter=function(t){return arguments.length?s.paddingTop(t).paddingRight(t).paddingBottom(t).paddingLeft(t):s.paddingTop()},s.paddingTop=function(t){return arguments.length?(a="function"==typeof t?t:Dl(+t),s):a},s.paddingRight=function(t){return arguments.length?(u="function"==typeof t?t:Dl(+t),s):u},s.paddingBottom=function(t){return arguments.length?(c="function"==typeof t?t:Dl(+t),s):c},s.paddingLeft=function(t){return arguments.length?(f="function"==typeof t?t:Dl(+t),s):f},s},t.treemapBinary=function(t,n,e,r,i){var o,a,u=t.children,c=u.length,f=new Array(c+1);for(f[0]=a=o=0;o<c;++o)f[o+1]=a+=u[o].value;!function t(n,e,r,i,o,a,c){if(n>=e-1){var s=u[n];return s.x0=i,s.y0=o,s.x1=a,void(s.y1=c)}for(var l=f[n],h=r/2+l,d=n+1,p=e-1;d<p;){var v=d+p>>>1;f[v]<h?d=v+1:p=v}h-f[d-1]<f[d]-h&&n+1<d&&--d;var g=f[d]-l,y=r-g;if(a-i>c-o){var _=(i*y+a*g)/r;t(n,d,g,i,o,_,c),t(d,e,y,_,o,a,c)}else{var b=(o*y+c*g)/r;t(n,d,g,i,o,a,b),t(d,e,y,i,b,a,c)}}(0,c,t.value,n,e,r,i)},t.treemapDice=Yl,t.treemapSlice=Jl,t.treemapSliceDice=function(t,n,e,r,i){(1&t.depth?Jl:Yl)(t,n,e,r,i)},t.treemapSquarify=nh,t.treemapResquarify=eh,t.interpolate=_e,t.interpolateArray=le,t.interpolateBasis=te,t.interpolateBasisClosed=ne,t.interpolateDate=he,t.interpolateDiscrete=function(t){var n=t.length;return function(e){return t[Math.max(0,Math.min(n-1,Math.floor(e*n)))]}},t.interpolateHue=function(t,n){var e=ie(+t,+n);return function(t){var n=e(t);return n-360*Math.floor(n/360)}},t.interpolateNumber=de,t.interpolateObject=pe,t.interpolateRound=be,t.interpolateString=ye,t.interpolateTransformCss=ke,t.interpolateTransformSvg=Ee,t.interpolateZoom=qe,t.interpolateRgb=ue,t.interpolateRgbBasis=fe,t.interpolateRgbBasisClosed=se,t.interpolateHsl=Ue,t.interpolateHslLong=Oe,t.interpolateLab=function(t,n){var e=ae((t=Rn(t)).l,(n=Rn(n)).l),r=ae(t.a,n.a),i=ae(t.b,n.b),o=ae(t.opacity,n.opacity);return function(n){return t.l=e(n),t.a=r(n),t.b=i(n),t.opacity=o(n),t+""}},t.interpolateHcl=Ye,t.interpolateHclLong=Fe,t.interpolateCubehelix=je,t.interpolateCubehelixLong=He,t.piecewise=function(t,n){for(var e=0,r=n.length-1,i=n[0],o=new Array(r<0?0:r);e<r;)o[e]=t(i,i=n[++e]);return function(t){var n=Math.max(0,Math.min(r-1,Math.floor(t*=r)));return o[n](t-n)}},t.quantize=function(t,n){for(var e=new Array(n),r=0;r<n;++r)e[r]=t(r/(n-1));return e},t.path=Xi,t.polygonArea=function(t){for(var n,e=-1,r=t.length,i=t[r-1],o=0;++e<r;)n=i,i=t[e],o+=n[1]*i[0]-n[0]*i[1];return o/2},t.polygonCentroid=function(t){for(var n,e,r=-1,i=t.length,o=0,a=0,u=t[i-1],c=0;++r<i;)n=u,u=t[r],c+=e=n[0]*u[1]-u[0]*n[1],o+=(n[0]+u[0])*e,a+=(n[1]+u[1])*e;return[o/(c*=3),a/c]},t.polygonHull=function(t){if((e=t.length)<3)return null;var n,e,r=new Array(e),i=new Array(e);for(n=0;n<e;++n)r[n]=[+t[n][0],+t[n][1],n];for(r.sort(rh),n=0;n<e;++n)i[n]=[r[n][0],-r[n][1]];var o=ih(r),a=ih(i),u=a[0]===o[0],c=a[a.length-1]===o[o.length-1],f=[];for(n=o.length-1;n>=0;--n)f.push(t[r[o[n]][2]]);for(n=+u;n<a.length-c;++n)f.push(t[r[a[n]][2]]);return f},t.polygonContains=function(t,n){for(var e,r,i=t.length,o=t[i-1],a=n[0],u=n[1],c=o[0],f=o[1],s=!1,l=0;l<i;++l)e=(o=t[l])[0],(r=o[1])>u!=f>u&&a<(c-e)*(u-r)/(f-r)+e&&(s=!s),c=e,f=r;return s},t.polygonLength=function(t){for(var n,e,r=-1,i=t.length,o=t[i-1],a=o[0],u=o[1],c=0;++r<i;)n=a,e=u,n-=a=(o=t[r])[0],e-=u=o[1],c+=Math.sqrt(n*n+e*e);return c},t.quadtree=ua,t.randomUniform=ah,t.randomNormal=uh,t.randomLogNormal=ch,t.randomBates=sh,t.randomIrwinHall=fh,t.randomExponential=lh,t.scaleBand=bh,t.scalePoint=function(){return function t(n){var e=n.copy;return n.padding=n.paddingOuter,delete n.paddingInner,delete n.paddingOuter,n.copy=function(){return t(e())},n}(bh.apply(null,arguments).paddingInner(1))},t.scaleIdentity=function t(n){var e;function r(t){return isNaN(t=+t)?e:t}return r.invert=r,r.domain=r.range=function(t){return arguments.length?(n=vh.call(t,mh),r):n.slice()},r.unknown=function(t){return arguments.length?(e=t,r):e},r.copy=function(){return t(n).unknown(e)},n=arguments.length?vh.call(n,mh):[0,1],Ph(r)},t.scaleLinear=function t(){var n=Eh(wh,wh);return n.copy=function(){return Sh(n,t())},hh.apply(n,arguments),Ph(n)},t.scaleLog=function t(){var n=Bh(kh()).domain([1,10]);return n.copy=function(){return Sh(n,t()).base(n.base())},hh.apply(n,arguments),n},t.scaleSymlog=function t(){var n=Ih(kh());return n.copy=function(){return Sh(n,t()).constant(n.constant())},hh.apply(n,arguments)},t.scaleOrdinal=_h,t.scaleImplicit=yh,t.scalePow=Vh,t.scaleSqrt=function(){return Vh.apply(null,arguments).exponent(.5)},t.scaleQuantile=function t(){var e,r=[],o=[],a=[];function u(){var t=0,n=Math.max(1,o.length);for(a=new Array(n-1);++t<n;)a[t-1]=N(r,t/n);return c}function c(t){return isNaN(t=+t)?e:o[i(a,t)]}return c.invertExtent=function(t){var n=o.indexOf(t);return n<0?[NaN,NaN]:[n>0?a[n-1]:r[0],n<a.length?a[n]:r[r.length-1]]},c.domain=function(t){if(!arguments.length)return r.slice();r=[];for(var e,i=0,o=t.length;i<o;++i)null==(e=t[i])||isNaN(e=+e)||r.push(e);return r.sort(n),u()},c.range=function(t){return arguments.length?(o=gh.call(t),u()):o.slice()},c.unknown=function(t){return arguments.length?(e=t,c):e},c.quantiles=function(){return a.slice()},c.copy=function(){return t().domain(r).range(o).unknown(e)},hh.apply(c,arguments)},t.scaleQuantize=function t(){var n,e=0,r=1,o=1,a=[.5],u=[0,1];function c(t){return t<=t?u[i(a,t,0,o)]:n}function f(){var t=-1;for(a=new Array(o);++t<o;)a[t]=((t+1)*r-(t-o)*e)/(o+1);return c}return c.domain=function(t){return arguments.length?(e=+t[0],r=+t[1],f()):[e,r]},c.range=function(t){return arguments.length?(o=(u=gh.call(t)).length-1,f()):u.slice()},c.invertExtent=function(t){var n=u.indexOf(t);return n<0?[NaN,NaN]:n<1?[e,a[0]]:n>=o?[a[o-1],r]:[a[n-1],a[n]]},c.unknown=function(t){return arguments.length?(n=t,c):c},c.thresholds=function(){return a.slice()},c.copy=function(){return t().domain([e,r]).range(u).unknown(n)},hh.apply(Ph(c),arguments)},t.scaleThreshold=function t(){var n,e=[.5],r=[0,1],o=1;function a(t){return t<=t?r[i(e,t,0,o)]:n}return a.domain=function(t){return arguments.length?(e=gh.call(t),o=Math.min(e.length,r.length-1),a):e.slice()},a.range=function(t){return arguments.length?(r=gh.call(t),o=Math.min(e.length,r.length-1),a):r.slice()},a.invertExtent=function(t){var n=r.indexOf(t);return[e[n-1],e[n]]},a.unknown=function(t){return arguments.length?(n=t,a):n},a.copy=function(){return t().domain(e).range(r).unknown(n)},hh.apply(a,arguments)},t.scaleTime=function(){return hh.apply(Tv(Td,Nd,sd,ud,od,rd,nd,Qh,t.timeFormat).domain([new Date(2e3,0,1),new Date(2e3,0,2)]),arguments)},t.scaleUtc=function(){return hh.apply(Tv(Qd,Wd,qd,zd,Cd,kd,nd,Qh,t.utcFormat).domain([Date.UTC(2e3,0,1),Date.UTC(2e3,0,2)]),arguments)},t.scaleSequential=function t(){var n=Ph(Sv()(wh));return n.copy=function(){return kv(n,t())},dh.apply(n,arguments)},t.scaleSequentialLog=function t(){var n=Bh(Sv()).domain([1,10]);return n.copy=function(){return kv(n,t()).base(n.base())},dh.apply(n,arguments)},t.scaleSequentialPow=Ev,t.scaleSequentialSqrt=function(){return Ev.apply(null,arguments).exponent(.5)},t.scaleSequentialSymlog=function t(){var n=Ih(Sv());return n.copy=function(){return kv(n,t()).constant(n.constant())},dh.apply(n,arguments)},t.scaleSequentialQuantile=function t(){var e=[],r=wh;function o(t){if(!isNaN(t=+t))return r((i(e,t)-1)/(e.length-1))}return o.domain=function(t){if(!arguments.length)return e.slice();e=[];for(var r,i=0,a=t.length;i<a;++i)null==(r=t[i])||isNaN(r=+r)||e.push(r);return e.sort(n),o},o.interpolator=function(t){return arguments.length?(r=t,o):r},o.copy=function(){return t(r).domain(e)},dh.apply(o,arguments)},t.scaleDiverging=function t(){var n=Ph(Cv()(wh));return n.copy=function(){return kv(n,t())},dh.apply(n,arguments)},t.scaleDivergingLog=function t(){var n=Bh(Cv()).domain([.1,1,10]);return n.copy=function(){return kv(n,t()).base(n.base())},dh.apply(n,arguments)},t.scaleDivergingPow=Pv,t.scaleDivergingSqrt=function(){return Pv.apply(null,arguments).exponent(.5)},t.scaleDivergingSymlog=function t(){var n=Ih(Cv());return n.copy=function(){return kv(n,t()).constant(n.constant())},dh.apply(n,arguments)},t.tickFormat=Ch,t.schemeCategory10=Rv,t.schemeAccent=Dv,t.schemeDark2=qv,t.schemePaired=Lv,t.schemePastel1=Uv,t.schemePastel2=Ov,t.schemeSet1=Bv,t.schemeSet2=Yv,t.schemeSet3=Fv,t.interpolateBrBG=Hv,t.schemeBrBG=jv,t.interpolatePRGn=Gv,t.schemePRGn=Xv,t.interpolatePiYG=$v,t.schemePiYG=Vv,t.interpolatePuOr=Zv,t.schemePuOr=Wv,t.interpolateRdBu=Jv,t.schemeRdBu=Qv,t.interpolateRdGy=tg,t.schemeRdGy=Kv,t.interpolateRdYlBu=eg,t.schemeRdYlBu=ng,t.interpolateRdYlGn=ig,t.schemeRdYlGn=rg,t.interpolateSpectral=ag,t.schemeSpectral=og,t.interpolateBuGn=cg,t.schemeBuGn=ug,t.interpolateBuPu=sg,t.schemeBuPu=fg,t.interpolateGnBu=hg,t.schemeGnBu=lg,t.interpolateOrRd=pg,t.schemeOrRd=dg,t.interpolatePuBuGn=gg,t.schemePuBuGn=vg,t.interpolatePuBu=_g,t.schemePuBu=yg,t.interpolatePuRd=mg,t.schemePuRd=bg,t.interpolateRdPu=wg,t.schemeRdPu=xg,t.interpolateYlGnBu=Ng,t.schemeYlGnBu=Mg,t.interpolateYlGn=Tg,t.schemeYlGn=Ag,t.interpolateYlOrBr=kg,t.schemeYlOrBr=Sg,t.interpolateYlOrRd=Cg,t.schemeYlOrRd=Eg,t.interpolateBlues=zg,t.schemeBlues=Pg,t.interpolateGreens=Dg,t.schemeGreens=Rg,t.interpolateGreys=Lg,t.schemeGreys=qg,t.interpolatePurples=Og,t.schemePurples=Ug,t.interpolateReds=Yg,t.schemeReds=Bg,t.interpolateOranges=Ig,t.schemeOranges=Fg,t.interpolateCubehelixDefault=jg,t.interpolateRainbow=function(t){(t<0||t>1)&&(t-=Math.floor(t));var n=Math.abs(t-.5);return Gg.h=360*t-100,Gg.s=1.5-1.5*n,Gg.l=.8-.9*n,Gg+""},t.interpolateWarm=Hg,t.interpolateCool=Xg,t.interpolateSinebow=function(t){var n;return t=(.5-t)*Math.PI,Vg.r=255*(n=Math.sin(t))*n,Vg.g=255*(n=Math.sin(t+$g))*n,Vg.b=255*(n=Math.sin(t+Wg))*n,Vg+""},t.interpolateViridis=Qg,t.interpolateMagma=Jg,t.interpolateInferno=Kg,t.interpolatePlasma=ty,t.create=function(t){return zt(W(t).call(document.documentElement))},t.creator=W,t.local=Dt,t.matcher=tt,t.mouse=Ot,t.namespace=$,t.namespaces=V,t.clientPoint=Ut,t.select=zt,t.selectAll=function(t){return"string"==typeof t?new Ct([document.querySelectorAll(t)],[document.documentElement]):new Ct([null==t?[]:t],Et)},t.selection=Pt,t.selector=Q,t.selectorAll=K,t.style=ct,t.touch=Bt,t.touches=function(t,n){null==n&&(n=Lt().touches);for(var e=0,r=n?n.length:0,i=new Array(r);e<r;++e)i[e]=Ut(t,n[e]);return i},t.window=ut,t.customEvent=St,t.arc=function(){var t=py,n=vy,e=ny(0),r=null,i=gy,o=yy,a=_y,u=null;function c(){var c,f,s,l=+t.apply(this,arguments),h=+n.apply(this,arguments),d=i.apply(this,arguments)-ly,p=o.apply(this,arguments)-ly,v=ey(p-d),g=p>d;if(u||(u=c=Xi()),h<l&&(f=h,h=l,l=f),h>fy)if(v>hy-fy)u.moveTo(h*iy(d),h*uy(d)),u.arc(0,0,h,d,p,!g),l>fy&&(u.moveTo(l*iy(p),l*uy(p)),u.arc(0,0,l,p,d,g));else{var y,_,b=d,m=p,x=d,w=p,M=v,N=v,A=a.apply(this,arguments)/2,T=A>fy&&(r?+r.apply(this,arguments):cy(l*l+h*h)),S=ay(ey(h-l)/2,+e.apply(this,arguments)),k=S,E=S;if(T>fy){var C=dy(T/l*uy(A)),P=dy(T/h*uy(A));(M-=2*C)>fy?(x+=C*=g?1:-1,w-=C):(M=0,x=w=(d+p)/2),(N-=2*P)>fy?(b+=P*=g?1:-1,m-=P):(N=0,b=m=(d+p)/2)}var z=h*iy(b),R=h*uy(b),D=l*iy(w),q=l*uy(w);if(S>fy){var L,U=h*iy(m),O=h*uy(m),B=l*iy(x),Y=l*uy(x);if(v<sy&&(L=function(t,n,e,r,i,o,a,u){var c=e-t,f=r-n,s=a-i,l=u-o,h=l*c-s*f;if(!(h*h<fy))return[t+(h=(s*(n-o)-l*(t-i))/h)*c,n+h*f]}(z,R,B,Y,U,O,D,q))){var F=z-L[0],I=R-L[1],j=U-L[0],H=O-L[1],X=1/uy(((s=(F*j+I*H)/(cy(F*F+I*I)*cy(j*j+H*H)))>1?0:s<-1?sy:Math.acos(s))/2),G=cy(L[0]*L[0]+L[1]*L[1]);k=ay(S,(l-G)/(X-1)),E=ay(S,(h-G)/(X+1))}}N>fy?E>fy?(y=by(B,Y,z,R,h,E,g),_=by(U,O,D,q,h,E,g),u.moveTo(y.cx+y.x01,y.cy+y.y01),E<S?u.arc(y.cx,y.cy,E,ry(y.y01,y.x01),ry(_.y01,_.x01),!g):(u.arc(y.cx,y.cy,E,ry(y.y01,y.x01),ry(y.y11,y.x11),!g),u.arc(0,0,h,ry(y.cy+y.y11,y.cx+y.x11),ry(_.cy+_.y11,_.cx+_.x11),!g),u.arc(_.cx,_.cy,E,ry(_.y11,_.x11),ry(_.y01,_.x01),!g))):(u.moveTo(z,R),u.arc(0,0,h,b,m,!g)):u.moveTo(z,R),l>fy&&M>fy?k>fy?(y=by(D,q,U,O,l,-k,g),_=by(z,R,B,Y,l,-k,g),u.lineTo(y.cx+y.x01,y.cy+y.y01),k<S?u.arc(y.cx,y.cy,k,ry(y.y01,y.x01),ry(_.y01,_.x01),!g):(u.arc(y.cx,y.cy,k,ry(y.y01,y.x01),ry(y.y11,y.x11),!g),u.arc(0,0,l,ry(y.cy+y.y11,y.cx+y.x11),ry(_.cy+_.y11,_.cx+_.x11),g),u.arc(_.cx,_.cy,k,ry(_.y11,_.x11),ry(_.y01,_.x01),!g))):u.arc(0,0,l,w,x,g):u.lineTo(D,q)}else u.moveTo(0,0);if(u.closePath(),c)return u=null,c+""||null}return c.centroid=function(){var e=(+t.apply(this,arguments)+ +n.apply(this,arguments))/2,r=(+i.apply(this,arguments)+ +o.apply(this,arguments))/2-sy/2;return[iy(r)*e,uy(r)*e]},c.innerRadius=function(n){return arguments.length?(t="function"==typeof n?n:ny(+n),c):t},c.outerRadius=function(t){return arguments.length?(n="function"==typeof t?t:ny(+t),c):n},c.cornerRadius=function(t){return arguments.length?(e="function"==typeof t?t:ny(+t),c):e},c.padRadius=function(t){return arguments.length?(r=null==t?null:"function"==typeof t?t:ny(+t),c):r},c.startAngle=function(t){return arguments.length?(i="function"==typeof t?t:ny(+t),c):i},c.endAngle=function(t){return arguments.length?(o="function"==typeof t?t:ny(+t),c):o},c.padAngle=function(t){return arguments.length?(a="function"==typeof t?t:ny(+t),c):a},c.context=function(t){return arguments.length?(u=null==t?null:t,c):u},c},t.area=Ay,t.line=Ny,t.pie=function(){var t=Sy,n=Ty,e=null,r=ny(0),i=ny(hy),o=ny(0);function a(a){var u,c,f,s,l,h=a.length,d=0,p=new Array(h),v=new Array(h),g=+r.apply(this,arguments),y=Math.min(hy,Math.max(-hy,i.apply(this,arguments)-g)),_=Math.min(Math.abs(y)/h,o.apply(this,arguments)),b=_*(y<0?-1:1);for(u=0;u<h;++u)(l=v[p[u]=u]=+t(a[u],u,a))>0&&(d+=l);for(null!=n?p.sort(function(t,e){return n(v[t],v[e])}):null!=e&&p.sort(function(t,n){return e(a[t],a[n])}),u=0,f=d?(y-h*b)/d:0;u<h;++u,g=s)c=p[u],s=g+((l=v[c])>0?l*f:0)+b,v[c]={data:a[c],index:u,value:l,startAngle:g,endAngle:s,padAngle:_};return v}return a.value=function(n){return arguments.length?(t="function"==typeof n?n:ny(+n),a):t},a.sortValues=function(t){return arguments.length?(n=t,e=null,a):n},a.sort=function(t){return arguments.length?(e=t,n=null,a):e},a.startAngle=function(t){return arguments.length?(r="function"==typeof t?t:ny(+t),a):r},a.endAngle=function(t){return arguments.length?(i="function"==typeof t?t:ny(+t),a):i},a.padAngle=function(t){return arguments.length?(o="function"==typeof t?t:ny(+t),a):o},a},t.areaRadial=Ry,t.radialArea=Ry,t.lineRadial=zy,t.radialLine=zy,t.pointRadial=Dy,t.linkHorizontal=function(){return Oy(By)},t.linkVertical=function(){return Oy(Yy)},t.linkRadial=function(){var t=Oy(Fy);return t.angle=t.x,delete t.x,t.radius=t.y,delete t.y,t},t.symbol=function(){var t=ny(Iy),n=ny(64),e=null;function r(){var r;if(e||(e=r=Xi()),t.apply(this,arguments).draw(e,+n.apply(this,arguments)),r)return e=null,r+""||null}return r.type=function(n){return arguments.length?(t="function"==typeof n?n:ny(n),r):t},r.size=function(t){return arguments.length?(n="function"==typeof t?t:ny(+t),r):n},r.context=function(t){return arguments.length?(e=null==t?null:t,r):e},r},t.symbols=i_,t.symbolCircle=Iy,t.symbolCross=jy,t.symbolDiamond=Gy,t.symbolSquare=Qy,t.symbolStar=Zy,t.symbolTriangle=Ky,t.symbolWye=r_,t.curveBasisClosed=function(t){return new c_(t)},t.curveBasisOpen=function(t){return new f_(t)},t.curveBasis=function(t){return new u_(t)},t.curveBundle=l_,t.curveCardinalClosed=g_,t.curveCardinalOpen=__,t.curveCardinal=p_,t.curveCatmullRomClosed=M_,t.curveCatmullRomOpen=A_,t.curveCatmullRom=x_,t.curveLinearClosed=function(t){return new T_(t)},t.curveLinear=xy,t.curveMonotoneX=function(t){return new P_(t)},t.curveMonotoneY=function(t){return new z_(t)},t.curveNatural=function(t){return new D_(t)},t.curveStep=function(t){return new L_(t,.5)},t.curveStepAfter=function(t){return new L_(t,1)},t.curveStepBefore=function(t){return new L_(t,0)},t.stack=function(){var t=ny([]),n=O_,e=U_,r=B_;function i(i){var o,a,u=t.apply(this,arguments),c=i.length,f=u.length,s=new Array(f);for(o=0;o<f;++o){for(var l,h=u[o],d=s[o]=new Array(c),p=0;p<c;++p)d[p]=l=[0,+r(i[p],h,p,i)],l.data=i[p];d.key=h}for(o=0,a=n(s);o<f;++o)s[a[o]].index=o;return e(s,a),s}return i.keys=function(n){return arguments.length?(t="function"==typeof n?n:ny(qy.call(n)),i):t},i.value=function(t){return arguments.length?(r="function"==typeof t?t:ny(+t),i):r},i.order=function(t){return arguments.length?(n=null==t?O_:"function"==typeof t?t:ny(qy.call(t)),i):n},i.offset=function(t){return arguments.length?(e=null==t?U_:t,i):e},i},t.stackOffsetExpand=function(t,n){if((r=t.length)>0){for(var e,r,i,o=0,a=t[0].length;o<a;++o){for(i=e=0;e<r;++e)i+=t[e][o][1]||0;if(i)for(e=0;e<r;++e)t[e][o][1]/=i}U_(t,n)}},t.stackOffsetDiverging=function(t,n){if((u=t.length)>0)for(var e,r,i,o,a,u,c=0,f=t[n[0]].length;c<f;++c)for(o=a=0,e=0;e<u;++e)(i=(r=t[n[e]][c])[1]-r[0])>=0?(r[0]=o,r[1]=o+=i):i<0?(r[1]=a,r[0]=a+=i):r[0]=o},t.stackOffsetNone=U_,t.stackOffsetSilhouette=function(t,n){if((e=t.length)>0){for(var e,r=0,i=t[n[0]],o=i.length;r<o;++r){for(var a=0,u=0;a<e;++a)u+=t[a][r][1]||0;i[r][1]+=i[r][0]=-u/2}U_(t,n)}},t.stackOffsetWiggle=function(t,n){if((i=t.length)>0&&(r=(e=t[n[0]]).length)>0){for(var e,r,i,o=0,a=1;a<r;++a){for(var u=0,c=0,f=0;u<i;++u){for(var s=t[n[u]],l=s[a][1]||0,h=(l-(s[a-1][1]||0))/2,d=0;d<u;++d){var p=t[n[d]];h+=(p[a][1]||0)-(p[a-1][1]||0)}c+=l,f+=h*l}e[a-1][1]+=e[a-1][0]=o,c&&(o-=f/c)}e[a-1][1]+=e[a-1][0]=o,U_(t,n)}},t.stackOrderAppearance=Y_,t.stackOrderAscending=I_,t.stackOrderDescending=function(t){return I_(t).reverse()},t.stackOrderInsideOut=function(t){var n,e,r=t.length,i=t.map(j_),o=Y_(t),a=0,u=0,c=[],f=[];for(n=0;n<r;++n)e=o[n],a<u?(a+=i[e],c.push(e)):(u+=i[e],f.push(e));return f.reverse().concat(c)},t.stackOrderNone=O_,t.stackOrderReverse=function(t){return O_(t).reverse()},t.timeInterval=Zh,t.timeMillisecond=Qh,t.timeMilliseconds=Jh,t.utcMillisecond=Qh,t.utcMilliseconds=Jh,t.timeSecond=nd,t.timeSeconds=ed,t.utcSecond=nd,t.utcSeconds=ed,t.timeMinute=rd,t.timeMinutes=id,t.timeHour=od,t.timeHours=ad,t.timeDay=ud,t.timeDays=cd,t.timeWeek=sd,t.timeWeeks=yd,t.timeSunday=sd,t.timeSundays=yd,t.timeMonday=ld,t.timeMondays=_d,t.timeTuesday=hd,t.timeTuesdays=bd,t.timeWednesday=dd,t.timeWednesdays=md,t.timeThursday=pd,t.timeThursdays=xd,t.timeFriday=vd,t.timeFridays=wd,t.timeSaturday=gd,t.timeSaturdays=Md,t.timeMonth=Nd,t.timeMonths=Ad,t.timeYear=Td,t.timeYears=Sd,t.utcMinute=kd,t.utcMinutes=Ed,t.utcHour=Cd,t.utcHours=Pd,t.utcDay=zd,t.utcDays=Rd,t.utcWeek=qd,t.utcWeeks=Id,t.utcSunday=qd,t.utcSundays=Id,t.utcMonday=Ld,t.utcMondays=jd,t.utcTuesday=Ud,t.utcTuesdays=Hd,t.utcWednesday=Od,t.utcWednesdays=Xd,t.utcThursday=Bd,t.utcThursdays=Gd,t.utcFriday=Yd,t.utcFridays=Vd,t.utcSaturday=Fd,t.utcSaturdays=$d,t.utcMonth=Wd,t.utcMonths=Zd,t.utcYear=Qd,t.utcYears=Jd,t.timeFormatDefaultLocale=pv,t.timeFormatLocale=ep,t.isoFormat=vv,t.isoParse=gv,t.now=er,t.timer=or,t.timerFlush=ar,t.timeout=sr,t.interval=function(t,n,e){var r=new ir,i=n;return null==n?(r.restart(t,n,e),r):(n=+n,e=null==e?er():+e,r.restart(function o(a){a+=i,r.restart(o,i+=n,e),t(a)},n,e),r)},t.transition=Pr,t.active=function(t,n){var e,r,i=t.__transition;if(i)for(r in n=null==n?null:n+"",i)if((e=i[r]).state>pr&&e.name===n)return new Cr([[t]],si,n,+r);return null},t.interrupt=Nr,t.voronoi=function(){var t=X_,n=G_,e=null;function r(r){return new Tb(r.map(function(e,i){var o=[Math.round(t(e,i,r)/Mb)*Mb,Math.round(n(e,i,r)/Mb)*Mb];return o.index=i,o.data=e,o}),e)}return r.polygons=function(t){return r(t).polygons()},r.links=function(t){return r(t).links()},r.triangles=function(t){return r(t).triangles()},r.x=function(n){return arguments.length?(t="function"==typeof n?n:H_(+n),r):t},r.y=function(t){return arguments.length?(n="function"==typeof t?t:H_(+t),r):n},r.extent=function(t){return arguments.length?(e=null==t?null:[[+t[0][0],+t[0][1]],[+t[1][0],+t[1][1]]],r):e&&[[e[0][0],e[0][1]],[e[1][0],e[1][1]]]},r.size=function(t){return arguments.length?(e=null==t?null:[[0,0],[+t[0],+t[1]]],r):e&&[e[1][0]-e[0][0],e[1][1]-e[0][1]]},r},t.zoom=function(){var n,e,r=Db,i=qb,o=Bb,a=Ub,u=Ob,c=[0,1/0],f=[[-1/0,-1/0],[1/0,1/0]],s=250,l=qe,h=[],d=I("start","zoom","end"),p=500,v=150,g=0;function y(t){t.property("__zoom",Lb).on("wheel.zoom",N).on("mousedown.zoom",A).on("dblclick.zoom",T).filter(u).on("touchstart.zoom",S).on("touchmove.zoom",k).on("touchend.zoom touchcancel.zoom",E).style("touch-action","none").style("-webkit-tap-highlight-color","rgba(0,0,0,0)")}function _(t,n){return(n=Math.max(c[0],Math.min(c[1],n)))===t.k?t:new Eb(n,t.x,t.y)}function b(t,n,e){var r=n[0]-e[0]*t.k,i=n[1]-e[1]*t.k;return r===t.x&&i===t.y?t:new Eb(t.k,r,i)}function m(t){return[(+t[0][0]+ +t[1][0])/2,(+t[0][1]+ +t[1][1])/2]}function x(t,n,e){t.on("start.zoom",function(){w(this,arguments).start()}).on("interrupt.zoom end.zoom",function(){w(this,arguments).end()}).tween("zoom",function(){var t=arguments,r=w(this,t),o=i.apply(this,t),a=e||m(o),u=Math.max(o[1][0]-o[0][0],o[1][1]-o[0][1]),c=this.__zoom,f="function"==typeof n?n.apply(this,t):n,s=l(c.invert(a).concat(u/c.k),f.invert(a).concat(u/f.k));return function(t){if(1===t)t=f;else{var n=s(t),e=u/n[2];t=new Eb(e,a[0]-n[0]*e,a[1]-n[1]*e)}r.zoom(null,t)}})}function w(t,n){for(var e,r=0,i=h.length;r<i;++r)if((e=h[r]).that===t)return e;return new M(t,n)}function M(t,n){this.that=t,this.args=n,this.index=-1,this.active=0,this.extent=i.apply(t,n)}function N(){if(r.apply(this,arguments)){var t=w(this,arguments),n=this.__zoom,e=Math.max(c[0],Math.min(c[1],n.k*Math.pow(2,a.apply(this,arguments)))),i=Ot(this);if(t.wheel)t.mouse[0][0]===i[0]&&t.mouse[0][1]===i[1]||(t.mouse[1]=n.invert(t.mouse[0]=i)),clearTimeout(t.wheel);else{if(n.k===e)return;t.mouse=[i,n.invert(i)],Nr(this),t.start()}Rb(),t.wheel=setTimeout(function(){t.wheel=null,t.end()},v),t.zoom("mouse",o(b(_(n,e),t.mouse[0],t.mouse[1]),t.extent,f))}}function A(){if(!e&&r.apply(this,arguments)){var n=w(this,arguments),i=zt(t.event.view).on("mousemove.zoom",function(){if(Rb(),!n.moved){var e=t.event.clientX-u,r=t.event.clientY-c;n.moved=e*e+r*r>g}n.zoom("mouse",o(b(n.that.__zoom,n.mouse[0]=Ot(n.that),n.mouse[1]),n.extent,f))},!0).on("mouseup.zoom",function(){i.on("mousemove.zoom mouseup.zoom",null),jt(t.event.view,n.moved),Rb(),n.end()},!0),a=Ot(this),u=t.event.clientX,c=t.event.clientY;It(t.event.view),zb(),n.mouse=[a,this.__zoom.invert(a)],Nr(this),n.start()}}function T(){if(r.apply(this,arguments)){var n=this.__zoom,e=Ot(this),a=n.invert(e),u=n.k*(t.event.shiftKey?.5:2),c=o(b(_(n,u),e,a),i.apply(this,arguments),f);Rb(),s>0?zt(this).transition().duration(s).call(x,c,e):zt(this).call(y.transform,c)}}function S(){if(r.apply(this,arguments)){var e,i,o,a,u=w(this,arguments),c=t.event.changedTouches,f=c.length;for(zb(),i=0;i<f;++i)a=[a=Bt(this,c,(o=c[i]).identifier),this.__zoom.invert(a),o.identifier],u.touch0?u.touch1||(u.touch1=a):(u.touch0=a,e=!0);if(n&&(n=clearTimeout(n),!u.touch1))return u.end(),void((a=zt(this).on("dblclick.zoom"))&&a.apply(this,arguments));e&&(n=setTimeout(function(){n=null},p),Nr(this),u.start())}}function k(){var e,r,i,a,u=w(this,arguments),c=t.event.changedTouches,s=c.length;for(Rb(),n&&(n=clearTimeout(n)),e=0;e<s;++e)i=Bt(this,c,(r=c[e]).identifier),u.touch0&&u.touch0[2]===r.identifier?u.touch0[0]=i:u.touch1&&u.touch1[2]===r.identifier&&(u.touch1[0]=i);if(r=u.that.__zoom,u.touch1){var l=u.touch0[0],h=u.touch0[1],d=u.touch1[0],p=u.touch1[1],v=(v=d[0]-l[0])*v+(v=d[1]-l[1])*v,g=(g=p[0]-h[0])*g+(g=p[1]-h[1])*g;r=_(r,Math.sqrt(v/g)),i=[(l[0]+d[0])/2,(l[1]+d[1])/2],a=[(h[0]+p[0])/2,(h[1]+p[1])/2]}else{if(!u.touch0)return;i=u.touch0[0],a=u.touch0[1]}u.zoom("touch",o(b(r,i,a),u.extent,f))}function E(){var n,r,i=w(this,arguments),o=t.event.changedTouches,a=o.length;for(zb(),e&&clearTimeout(e),e=setTimeout(function(){e=null},p),n=0;n<a;++n)r=o[n],i.touch0&&i.touch0[2]===r.identifier?delete i.touch0:i.touch1&&i.touch1[2]===r.identifier&&delete i.touch1;i.touch1&&!i.touch0&&(i.touch0=i.touch1,delete i.touch1),i.touch0?i.touch0[1]=this.__zoom.invert(i.touch0[0]):i.end()}return y.transform=function(t,n){var e=t.selection?t.selection():t;e.property("__zoom",Lb),t!==e?x(t,n):e.interrupt().each(function(){w(this,arguments).start().zoom(null,"function"==typeof n?n.apply(this,arguments):n).end()})},y.scaleBy=function(t,n){y.scaleTo(t,function(){return this.__zoom.k*("function"==typeof n?n.apply(this,arguments):n)})},y.scaleTo=function(t,n){y.transform(t,function(){var t=i.apply(this,arguments),e=this.__zoom,r=m(t),a=e.invert(r),u="function"==typeof n?n.apply(this,arguments):n;return o(b(_(e,u),r,a),t,f)})},y.translateBy=function(t,n,e){y.transform(t,function(){return o(this.__zoom.translate("function"==typeof n?n.apply(this,arguments):n,"function"==typeof e?e.apply(this,arguments):e),i.apply(this,arguments),f)})},y.translateTo=function(t,n,e){y.transform(t,function(){var t=i.apply(this,arguments),r=this.__zoom,a=m(t);return o(Cb.translate(a[0],a[1]).scale(r.k).translate("function"==typeof n?-n.apply(this,arguments):-n,"function"==typeof e?-e.apply(this,arguments):-e),t,f)})},M.prototype={start:function(){return 1==++this.active&&(this.index=h.push(this)-1,this.emit("start")),this},zoom:function(t,n){return this.mouse&&"mouse"!==t&&(this.mouse[1]=n.invert(this.mouse[0])),this.touch0&&"touch"!==t&&(this.touch0[1]=n.invert(this.touch0[0])),this.touch1&&"touch"!==t&&(this.touch1[1]=n.invert(this.touch1[0])),this.that.__zoom=n,this.emit("zoom"),this},end:function(){return 0==--this.active&&(h.splice(this.index,1),this.index=-1,this.emit("end")),this},emit:function(t){St(new kb(y,t,this.that.__zoom),d.apply,d,[t,this.that,this.args])}},y.wheelDelta=function(t){return arguments.length?(a="function"==typeof t?t:Sb(+t),y):a},y.filter=function(t){return arguments.length?(r="function"==typeof t?t:Sb(!!t),y):r},y.touchable=function(t){return arguments.length?(u="function"==typeof t?t:Sb(!!t),y):u},y.extent=function(t){return arguments.length?(i="function"==typeof t?t:Sb([[+t[0][0],+t[0][1]],[+t[1][0],+t[1][1]]]),y):i},y.scaleExtent=function(t){return arguments.length?(c[0]=+t[0],c[1]=+t[1],y):[c[0],c[1]]},y.translateExtent=function(t){return arguments.length?(f[0][0]=+t[0][0],f[1][0]=+t[1][0],f[0][1]=+t[0][1],f[1][1]=+t[1][1],y):[[f[0][0],f[0][1]],[f[1][0],f[1][1]]]},y.constrain=function(t){return arguments.length?(o=t,y):o},y.duration=function(t){return arguments.length?(s=+t,y):s},y.interpolate=function(t){return arguments.length?(l=t,y):l},y.on=function(){var t=d.on.apply(d,arguments);return t===d?y:t},y.clickDistance=function(t){return arguments.length?(g=(t=+t)*t,y):Math.sqrt(g)},y},t.zoomTransform=Pb,t.zoomIdentity=Cb,Object.defineProperty(t,"__esModule",{value:!0})});
