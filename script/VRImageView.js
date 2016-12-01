(function() {
	var clazz = {};

	clazz.constructor = function(element) {
		this.element = element;
		this.src = element.getAttribute("data-src");
		this.jsonp = element.getAttribute("data-jsonp");

		this.scene = new THREE.Scene(); // Create a Three.js scene object.
		this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000); // Define the perspective camera's attributes.

		this.renderer = window.WebGLRenderingContext? new THREE.WebGLRenderer(): new THREE.CanvasRenderer(); // Fallback to canvas renderer, if necessary.
		this.renderer.setSize(window.innerWidth, window.innerHeight); // Set the size of the WebGL viewport.

		element.appendChild(this.renderer.domElement); // Append the WebGL viewport to the DOM.

		initializeCamera(this);
		initializeSphere(this);
		initializeRenderLoop(this);
		initializeEvents(this);
	};

	var initializeCamera = function(obj) {
		obj.camera.position.z = 0; // Move the camera away from the origin, down the positive z-axis.
	};

	var initializeSphere = function(obj) {
		if (obj.jsonp) {
			var script = document.createElement('script');
			script.type = 'text/javascript';
			script.src = obj.jsonp;
			window.jsonp = function(jso) {
				initializeSphere(jso.data);
			};
			document.head.appendChild(script);
			return;
		}

		var texture = new THREE.TextureLoader().load(obj.src);
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		texture.repeat.set( -1, -2 );

		var geometry = new THREE.SphereGeometry(100, 40, 40, 0, Math.PI * 2, 0, Math.PI * 2);
		var material = new THREE.MeshBasicMaterial({map: texture}); // Skin the cube with 100% blue.
		obj.mesh = new THREE.Mesh(geometry, material); // Create a mesh based on the specified geometry (cube) and material (blue skin).
		obj.scene.add(obj.mesh); // Add the sphere at (0, 0, 0).
	};

	var initializeRenderLoop = function(obj) {
		var render = function() {
			obj.renderer.render(obj.scene, obj.camera); // Each time we change the position of the cube object, we must re-render it.
			requestAnimationFrame(render); // Call the render() function up to 60 times per second (i.e., up to 60 animation frames per second).
		};
		render();
	};

	var initializeEvents = function(obj) {
		var dragging = false;
		var startX = 0;
		var startY = 0;
		var rx, ry;

		var onDown = function(e) {
			e.preventDefault();//for Mobile

			if (e.target != obj.renderer.domElement) return;

			var pointer = event.targetTouches? event.targetTouches[0] : event;//for Mobile

			dragging = true;
			startX = pointer.pageX;
			startY = pointer.pageY;
		};

		var onMove = function(e) {
			if (!dragging) return;

			var pointer = event.targetTouches? event.targetTouches[0] : event;//for Mobile

			rx = obj.mesh.rotation.x - (pointer.pageY - startY) / 360;
			ry = obj.mesh.rotation.y - (pointer.pageX - startX) / 360;

			if (rx < -Math.PI / 2) rx = -Math.PI / 2;
			else if (rx > Math.PI / 2) rx = Math.PI / 2;

			obj.mesh.rotation.x = rx;
			obj.mesh.rotation.y = ry;

			startX = pointer.pageX;
			startY = pointer.pageY;
		};
	
		var onUp = function(e) {
			dragging = false;
		};

		window.addEventListener('mousedown', onDown, false);
		window.addEventListener('mousemove', onMove, false);
		window.addEventListener('mouseup', onUp, false);
		obj.element.addEventListener("touchstart", onDown);
		obj.element.addEventListener("touchmove", onMove);
		obj.element.addEventListener("touchend", onUp);
		window.addEventListener('resize', function() {
			obj.renderer.setSize(window.innerWidth, window.innerHeight);

			obj.camera.aspect = window.innerWidth / window.innerHeight;
			obj.camera.updateProjectionMatrix();
		}, false);
	};

	window.VRImageViewer = clazz;
	window.addEventListener("load", function() {
		var elements = document.querySelectorAll("[data-view=\'vr-image\']");
		var i;
		for (i = 0; i < elements.length; i++) {
			new clazz.constructor(elements[i]);
		}
	});
})();