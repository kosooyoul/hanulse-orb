function downloadJSAtOnload(src) {var element = document.createElement("script"); element.src = src; (document.head || document.body).appendChild(element);}
function evalWithinContext(context, code) {(function(code) {eval(code);}).call(context, code);}
downloadJSAtOnload('http://www.ahyane.net/vr/js/Projector.js');
downloadJSAtOnload('http://www.ahyane.net/vr/js/CanvasRenderer.js');

if (!window.URL) {
	window.URL = {};
	window.URL.revokeObjectURL = function() {
		// Do nothing
	};
	window.URL.createObjectURL = function() {
		// Do nothing
	};
}

window.requestAnimFrame = (function(){
  return  window.requestAnimationFrame       ||
          window.webkitRequestAnimationFrame ||
          window.mozRequestAnimationFrame    ||
          function( callback ){
            window.setTimeout(callback, 1000 / 60);
          };
})();

(function() {
	var clazz = {};
	var _objects = {};

	var DIVIDE_WIDTH = 8;
	var DIVIDE_HEIGHT = 4;

	clazz.get = function (name) {
		return _objects[name];
	};

	clazz.constructor = function(element) {
		this.element = element;
		this.jsonp = element.getAttribute('data-jsonp');
		this.prop = {
			angleX: Number(element.getAttribute('data-anglex')),
			angleY: Number(element.getAttribute('data-angley')),
			fov: Number(element.getAttribute('data-fov')),
			onload: element.getAttribute('data-onload')
		};

		this.isLoading = false;

		try {
			if (!window.WebGLRenderingContext) throw new Error('WebGLRenderingContext is undefined.');
			this.renderer = new THREE.WebGLRenderer({antialias: false})
			this.webGLContext = this.renderer.getContext();
		} catch(e) {
			this.renderer = new THREE.CanvasRenderer(); // Fallback to canvas renderer, if necessary.
			this.webGLContext = null;
		}
		this.renderer.setSize(window.innerWidth, window.innerHeight); // Set the size of the WebGL viewport.
		this.renderer.setClearColor(0x000000, 1);
		this.element.appendChild(this.renderer.domElement); // Append the WebGL viewport to the DOM.

		this.scene = new THREE.Scene(); // Create a Three.js scene object.
		this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000); // Define the perspective camera's attributes.

		// Sphere for ready
		// this.meshForReady = getMeshForReady();
		// this.meshForReady.visible = true;
		// this.sphere.add(this.meshForReady);

		initializeEvents(this);
		initializeRenderLoop(this);

		loadData(this);
	};

	function getMeshForSphere() {
		var geometry = new THREE.SphereGeometry(100, 40, 20, 0, Math.PI * 2, 0, Math.PI);
		return new THREE.Mesh(geometry);
	}

	function getMeshPartForSphere(x, y, divideX, divideY) {
		var geometry = new THREE.SphereGeometry(100, 80 / divideX, 40 / divideY, Math.PI * 2 / divideX * x, Math.PI * 2 / divideX, Math.PI / divideY * (divideY - y - 1), Math.PI / divideY);
		var material = new THREE.MeshBasicMaterial({color: 0x000000, side: THREE.BackSide});
		return new THREE.Mesh(geometry, material);
	}

	function getMeshForReady() {
		var geometry = new THREE.SphereGeometry(99, 40, 20, 0, Math.PI * 2, 0, Math.PI);
		var material = new THREE.MeshBasicMaterial({color: 0xE0E0E0, wireframe: true, side: THREE.BackSide});
		return new THREE.Mesh(geometry, material);
	}

	/*
	function getMeshForLoading() {
		var geometry = new THREE.CylinderGeometry(90, 90, 2, 40, 1, true);
		var texture = new THREE.Texture(generateGradient('#00C8FF', '#FFC800', '#00C8FF', 16, 1));
		texture.needsUpdate = true;
		var material = new THREE.MeshBasicMaterial({map: texture, side: THREE.DoubleSide});
		return new THREE.Mesh(geometry, material);
	}
	*/

	clazz.constructor.prototype.loadFromFile = function(file) {
		var obj = this;
		var reader  = new FileReader();

		reader.addEventListener('load', function () {
			obj.loadFromDataURI(reader.result);
		}, false);

		reader.readAsDataURL(file);
	};

	clazz.constructor.prototype.loadFromDataURI = function(uri) {
		this.data = uri;
		loadData(this);
	};

	clazz.constructor.prototype.invalidate = function() {
		if (!this.dirty) {
			this.dirty = true;
			this.requestRender && this.requestRender();
		}
	};

	clazz.constructor.prototype.loadPart = function(mesh) {
		var self = this;

		if (mesh.partLoaded == true) return;
		mesh.partLoaded = true;

		if (mesh.data) {
			this.textureLoader.load(mesh.data, function(texture) {
				texture.wrapS = THREE.ClampToEdgeWrapping;
				texture.wrapT = THREE.ClampToEdgeWrapping;
				texture.repeat.set(-1, 1);
				texture.offset.set(0.5, 0);

				var material = new THREE.MeshBasicMaterial({map: texture, side: THREE.BackSide}); // Skin the cube with 100% blue.

				mesh.material = material;
				mesh.visible = true;

				self.invalidate();
			});
			return;
		}

		if (mesh.jsonp) {
			var script = document.createElement('script');
			script.type = 'text/javascript';
			script.src = mesh.jsonp;
			document.head.appendChild(script);
		}
	};

	clazz.constructor.prototype.onLoadPartData = function(data) {
		var self = this;
		var mesh = this.meshPartForSpheres[data.key];

		// Load Texture
		this.textureLoader.load(data.data || data.uri, function(texture) {
			texture.wrapS = THREE.ClampToEdgeWrapping;
			texture.wrapT = THREE.ClampToEdgeWrapping;
			texture.magFilter = THREE.LinearFilter;
			texture.minFilter = THREE.LinearFilter;
			texture.flipY = false;
			// texture.repeat.set(-1, 1);
			// texture.offset.set(0.5, 0 - 1 / divideY * (partY + 1));

			var material = new THREE.MeshBasicMaterial({map: texture, side: THREE.BackSide}); // Skin the cube with 100% blue.

			mesh.material = material;
			mesh.visible = true;

			console.log('loaded ' + data.key);

			self.invalidate();
		});
	};

	var loadData = function(obj) {
		obj.name = obj.name || 'Untitled';
		obj.filename = obj.filename || 'VRImage.png';

		if (obj.angle) {
			obj.angle = {'x': obj.angle.x || 0, 'y': obj.angle.y || 0};
		} else {
			obj.angle = {'x': 0, 'y': 0};
		}
		obj.fov = obj.fov || 60;
		obj.magiceye = obj.magiceye; //[null = none, sbs, tb]

		//override prop
		if (isFinite(obj.prop.angleX)) {
			obj.angle.x = obj.prop.angleX;
			console.log('obj.angle.x', obj.angle.x);
		}
		if (isFinite(obj.prop.angleY)) {
			obj.angle.y = obj.prop.angleY;
			console.log('obj.angle.y', obj.angle.y);
		}
		if (isFinite(obj.prop.fov)) {
			obj.fov = obj.prop.fov;
			console.log('obj.fov', obj.fov);
		}

		if (obj.data) {
			initialize(obj);
		} else if (obj.jsonp) {
			var script = document.createElement('script');
			script.type = 'text/javascript';
			script.src = obj.jsonp;
			
			window.jsonp = function(jso) {
				var type = jso && jso.type;
				if (type == 'part') {
					obj.onLoadPartData(jso);
				} else {
					obj.data = jso.data; // Single mode
					obj.datas = jso.datas; // Partial mode
					if (obj.datas) {
						obj.divideSphereX = jso.divideSphereX || 8;
						obj.divideSphereY = jso.divideSphereY || 4;
					}

					initialize(obj);
					obj.isLoading = false;

					var code = obj.prop.onload;
					if (window[obj.prop.onload] instanceof Function) {
						window[obj.prop.onload].call(obj);
					} else {
						evalWithinContext(obj, code);
					}
				}
			};
			obj.isLoading = true;

			document.head.appendChild(script);
		}
	};

	var initialize = function(obj) {
		initializeMesh(obj);
		initializeTexture(obj);
		initializeCamera(obj);

		obj.sphere.rotation.x = obj.angle.x * Math.PI / 180;
		obj.sphere.rotation.y = obj.angle.y * Math.PI / 180;
		obj.camera.fov = obj.fov;
		obj.camera.updateProjectionMatrix();

		obj.invalidate();
	};

	var initializeMesh = function(obj) {
		// Clear sphere
		obj.scene.remove(obj.sphere);
		obj.sphere = new THREE.Group();
		obj.scene.add(obj.sphere);

		obj.meshForSphere = null;
		obj.meshPartForSpheres = {};

		// Single mode
		if (obj.data) {
			console.log(1);
			obj.meshForSphere = getMeshForSphere();
			obj.meshForSphere.data = obj.data;
			obj.sphere.add(obj.meshForSphere);
			return;
		}

		// Partial mode
		if (obj.datas) {
			obj.sphereParts = new THREE.Group();
			obj.sphere.add(obj.sphereParts);
			obj.sphereParts.rotateX(Math.PI);
			obj.sphereParts.rotateY(Math.PI * 1.25);
			for (var x = 0; x < obj.divideSphereX; x++) {
				for (var y = 0; y < obj.divideSphereY; y++) {
					var meshPartOfSphere = getMeshPartForSphere(x, y, obj.divideSphereX, obj.divideSphereY);
					meshPartOfSphere.visible = false;
					obj.sphereParts.add(meshPartOfSphere);

					var key = x + '-' + y;
					meshPartOfSphere.jsonp = obj.datas[x + '-' + y];
					console.log(meshPartOfSphere.jsonp);
					obj.meshPartForSpheres[key] = meshPartOfSphere;
				}
			}
			return;
		}
	};

	var initializeTexture = function(obj) {
		obj.textureLoader = new THREE.TextureLoader();
	};

	var initializeCamera = function(obj) {
		obj.camera.position.z = 20; // Move the camera away from the origin, down the positive z-axis.
	};

	var initializeRenderLoop = function(obj) {
		obj.requestRender = function() {
			requestAnimFrame(onRender);
		};

		var onRender = function(timems) {
			if (!obj.dirty) return; // requestAnimFrame(onRender);

			check();

			render();

			obj.dirty = false;

			// Call the render() function up to 60 times per second (i.e., up to 60 animation frames per second).
			requestAnimFrame(onRender);
		};

		var check = function() {
			var frustum = new THREE.Frustum();
			var cameraViewProjectionMatrix = new THREE.Matrix4();
			obj.camera.updateMatrixWorld();
			obj.camera.matrixWorldInverse.getInverse(obj.camera.matrixWorld);
			cameraViewProjectionMatrix.multiplyMatrices(obj.camera.projectionMatrix, obj.camera.matrixWorldInverse);
			// cameraViewProjectionMatrix.multiply(new THREE.Matrix4().makeTranslation(0, 0, 100))
			frustum.setFromMatrix(cameraViewProjectionMatrix);
			obj.sphere.children.forEach(function(mesh) {
				if (mesh.isMesh) {
					mesh.visible = frustum.intersectsObject(mesh);
					if (mesh.visible) {
						obj.loadPart(mesh);
					}
				} else if (mesh.isGroup) {
					mesh.children.forEach(function(mesh) {
						if (mesh.isMesh) {
							mesh.visible = frustum.intersectsObject(mesh);
							if (mesh.visible) {
								obj.loadPart(mesh);
							}
						}
					});
				}
			});
		};

		var render = function() {

			/*
			obj.meshForLoading.visible = obj.isLoading;
			if (obj.isLoading) {
				obj.meshForLoading.rotation.y -= Math.PI / 40;
			}
			*/

			obj.renderer.render(obj.scene, obj.camera); // Each time we change the position of the cube object, we must re-render it.

			if (obj.webGLContext && obj.webGLContext.getError()) {
				//If error is occured, change renderer to canvas renderer.
				obj.webGLContext = null;
				obj.renderer.domElement.remove();

				obj.renderer = new THREE.CanvasRenderer();
				obj.renderer.setSize(window.innerWidth, window.innerHeight); // Set the size of the WebGL viewport.
				obj.renderer.setClearColor(0xF9F9F9, 1);
				obj.element.appendChild(obj.renderer.domElement); // Append the WebGL viewport to the DOM.
			}
		};

		onRender(0);
	};

	var initializeEvents = function(obj) {
		var dragging = false;
		var startX = 0;
		var startY = 0;
		var rx, ry;

		var onDown = function(e) {
			if (obj.element != e.target) {
				if (!~Array.prototype.indexOf.call(obj.element.childNodes, e.target)) {
					return;
				}
			}

			if (e.type == 'touchstart') {
				e.preventDefault();//for Mobile
			}

			if (e.target != obj.renderer.domElement) return;

			var pointer = event.targetTouches? event.targetTouches[0] : event;//for Mobile

			dragging = true;
			startX = pointer.pageX;
			startY = pointer.pageY;
		};

		var onMove = function(e) {
			if (!dragging) return;

			var pointer = event.targetTouches? event.targetTouches[0] : event;//for Mobile

			rx = obj.sphere.rotation.x - (pointer.pageY - startY) / 360;
			ry = obj.sphere.rotation.y - (pointer.pageX - startX) / 360;

			if (rx < -Math.PI / 2) rx = -Math.PI / 2;
			else if (rx > Math.PI / 2) rx = Math.PI / 2;

			obj.sphere.rotation.x = rx;
			obj.sphere.rotation.y = ry;

			if (window['__DEBUG_MODE__']) {
				console.log('rotateX: ' + (rx / Math.PI * 180) + ', rotateY: ' + (ry / Math.PI * 180) + ', fovy: ' + obj.camera.fov);
			}

			startX = pointer.pageX;
			startY = pointer.pageY;

			//if (window.console) {
			//	console.log(rx / 3.14 * 180, ry / 3.14 * 180);
			//}

			obj.invalidate();
		};
	
		var onUp = function(e) {
			dragging = false;
		};

		window.addEventListener('mousedown', onDown, false);
		window.addEventListener('mousemove', onMove, false);
		window.addEventListener('mouseup', onUp, false);
		obj.element.addEventListener('touchstart', onDown);
		obj.element.addEventListener('touchmove', onMove);
		obj.element.addEventListener('touchend', onUp);
		window.addEventListener('wheel', function(e) {
			if (e.deltaY < 0) {
				obj.fov = Math.max(obj.fov - 1, 10);
			} else if (e.deltaY > 0) {
				obj.fov = Math.min(obj.fov + 1, 120);
			}
			obj.camera.fov = obj.fov;
			obj.camera.updateProjectionMatrix();
			obj.invalidate();
		}, false);
		window.addEventListener('resize', function() {
			obj.renderer.setSize(window.innerWidth, window.innerHeight);

			obj.camera.aspect = window.innerWidth / window.innerHeight;
			obj.camera.updateProjectionMatrix();
			obj.invalidate();
		}, false);

		window.addEventListener('drop', function(e) {
			if (obj.element != e.target) {
				if (!~Array.prototype.indexOf.call(obj.element.childNodes, e.target)) {
					return;
				}
			}
			obj.loadFromFile(e.dataTransfer.files[0]);
			e.preventDefault();
		}, false);
		window.addEventListener('dragover', function(e) {
			e.preventDefault();
		}, false);
	};

	/*
	var generateGradient = function(start, center, end, width, height) {
		var w = width || 512;
		var h = height || 512;

		// create canvas
		canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;

		// get context
		var context = canvas.getContext('2d');

		// draw gradient
		context.rect(0, 0, w, h);
		var gradient = context.createLinearGradient(0, 0, w, h);
		gradient.addColorStop(0, start);
		gradient.addColorStop(0.5, center);
		gradient.addColorStop(1, end);
		context.fillStyle = gradient;
		context.fill();

		return canvas;
	};
	*/

	function dataURIToBlob(dataURI) {
		var binStr = atob(dataURI.split(',')[1]), len = binStr.length, arr = new Uint8Array(len), mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]

		for (var i = 0; i < len; i++) {
			arr[i] = binStr.charCodeAt(i);
		}

		return new Blob([arr], {type: mimeString});
	}

	window.VRImageViewer = clazz;
	window.addEventListener('load', function() {
		var elements = document.querySelectorAll('[data-view=\'vr-image\']');
		var i, name, obj;
		for (i = 0; i < elements.length; i++) {
			obj = new clazz.constructor(elements[i]);

			name = elements[i].getAttribute('name');
			if (name) {
				_objects[name] = obj;
			}
			
		}
	});
})();